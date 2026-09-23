/*
 * Turn the burial evidence store into the record shapes this app already writes.
 *
 * The exhibit renders a person by querying annotations whose `target` is the person's IRI
 * and reading `body[].<key>.value` (see web/app.js). The entry form creates a Person with
 * `@context: http://schema.org` and then one describing Annotation per claim, each carrying
 * `evidence`. This module produces exactly that, so a bulk load is indistinguishable from
 * careful manual entry - except that every claim also carries the rectangle of the page
 * photograph it was read from.
 *
 * Output is a list of operations with local placeholders (`@person:BurialsAlpha001_1`)
 * instead of store IRIs. The loader creates records in dependency order and substitutes
 * the real IRIs, which is what makes the whole thing re-runnable.
 */

import fs from "node:fs"
import path from "node:path"

const SCHEMA = "http://schema.org"
const ANNO = "http://www.w3.org/ns/anno.jsonld"

/** The burial index is its own source; it is not the 2018 headstone catalog. */
export const BURIAL_INDEX_DOC = {
  "@context": SCHEMA,
  "@type": "Document",
  name: "McElwee Cemetery Burial Index",
  label: "McElwee Cemetery Burial Index",
  description:
    "Typescript index of burials in McElwee Cemetery, Pike County, Missouri, held as an undated desk copy at the Lay Center with no attribution within it. " +
    "Rows were read from page photographs; the transcription records what is printed, including its errors.",
  "dcterms:license": "Educational use permitted by the photographer",
  attribution: "Page photographs by iowaz.info, used for educational purposes with credit"
}

/**
 * Display name. The index prints the family surname once at the head of a group and leaves
 * it blank underneath, so the transcription carries it down into `surname` even when the
 * given-name field already ends with it ("A. A. HOUCHINS" + "HOUCHINS"). Naive concatenation
 * produces "A. A. HOUCHINS HOUCHINS", so append the surname only when it is genuinely missing.
 */
function personName(record) {
  const given = (record.givenName || "").trim()
  const surname = (record.surname || "").trim()
  if (!given) return surname || "(unrecorded)"
  if (!surname) return given
  const lastWord = given.split(/\s+/).pop().toUpperCase()
  if (lastWord === surname.toUpperCase()) return given
  return `${given} ${surname}`
}

/**
 * One claim, in the shape the exhibit reads: an object with `value` and `evidence`.
 * Extra keys are ignored by the renderer, so the provenance rectangle rides along without
 * turning into a spurious field on the specimen sheet.
 */
function claim(value, evidenceIri, record, extraProvenance = null) {
  if (value === null || value === undefined || String(value).trim() === "") return null
  const rect = record?.evidence?.rect
  const provenance = extraProvenance || (rect ? { sourceImage: record.sourceImage || null, rect } : null)
  return {
    value: String(value).trim(),
    evidence: evidenceIri,
    // The renderer only reads `value` and `evidence` out of this object, so the rectangle
    // of the page photograph the claim was read from rides along as machine-checkable
    // provenance without appearing as a spurious field on the specimen sheet.
    ...(provenance ? { provenance } : {})
  }
}

function annotationFor(record, evidenceIri, nameOf) {
  const f = record.fields || {}
  const body = []

  const push = (key, value) => {
    const c = claim(value, evidenceIri, record)
    if (c) body.push({ [key]: c })
  }

  // The verbatim index line is the most important assertion: it is what a reviewer
  // checks the stone or the desk copy against.
  push("description", record.entryText)
  push("birthDate", f.born)
  push("deathDate", f.died)
  push("ageAtDeath", f.aged)
  if (f.relationship) push("relationship", f.relationship)
  if (f.parents) push("relatedTo", f.parents)

  // Where the inscription pages carry the same person, that is a second, independent
  // witness. It is asserted as its own claim so the exhibit shows the disagreement
  // instead of us choosing a winner.
  if (record.engraving?.entryText) push("engravingText", record.engraving.entryText)

  // The index groups a family under one head row and leaves the surname blank underneath.
  // `refId` names that head row, so carry it as an explicit link - otherwise the dependents
  // become unrelated people and the grouping the compiler drew is thrown away.
  if (f.refId) {
    const c = claim(nameOf(f.refId) || f.refName || f.refId, evidenceIri, record)
    if (c) {
      c.provenance = { ...(c.provenance || {}), familyHeadOf: `@person:${f.refId}` }
      if (f.refCertainty) c.provenance.certainty = f.refCertainty
      body.push({ familyGroup: c })
    }
  }

  if (!body.length) return null

  return {
    "@context": ANNO,
    "@type": "Annotation",
    motivation: "describing",
    target: `@person:${record.id}`,
    body
  }
}

/**
 * Find a Grave is a second witness for the same person: the memorial page carries its own
 * name, dates, grave photograph and citation. It is asserted as a separate annotation so
 * the exhibit can show it alongside the index claims rather than folding it into them.
 */
function findagraveAnnotationFor(record) {
  const fa = record.findagrave
  if (!fa || !fa.url) return null

  const provenance = {
    citation: fa.citation || null,
    accessed: fa.accessed || null,
    maintainer: fa.maintainer || null
  }

  const body = []
  const seeAlso = claim(fa.url, fa.url, null, provenance)
  if (seeAlso) body.push({ seeAlso })

  if (fa.photo) {
    const depiction = claim(fa.photo, fa.url, null, provenance)
    if (depiction) body.push({ depiction })
  }

  if (!body.length) return null

  return {
    "@context": ANNO,
    "@type": "Annotation",
    motivation: "describing",
    target: `@person:${record.id}`,
    body
  }
}

/**
 * @param {object} evidence parsed burials-evidence.json
 * @returns {{document: object, operations: Array<{ref?: string, payload: object, kind: string}>}}
 */
export function buildOperations(evidence, pageImages = {}) {
  const records = evidence.records || []
  const operations = []

  operations.push({ kind: "document", ref: "@burialIndex", payload: { ...BURIAL_INDEX_DOC } })

  const names = new Map(records.map((r) => [r.id, personName(r)]))
  const nameOf = (id) => names.get(id)

  // Every person first, then every annotation. A family-head `refId` can point at a row
  // further down the page, so if the two kinds interleaved the annotation would be written
  // before the person it links to existed and would be skipped as an unresolved placeholder.
  for (const record of records) {
    const name = personName(record)
    const given = (record.givenName || "").trim()
    const family = (record.surname || "").trim()
    operations.push({
      kind: "person",
      ref: `@person:${record.id}`,
      localId: record.id,
      payload: {
        "@context": SCHEMA,
        "@type": "Person",
        name,
        ...(given ? { givenName: given } : {}),
        ...(family ? { familyName: family } : {})
      }
    })
  }

  for (const record of records) {
    const stamped = { ...record, sourceImage: pageImages[record.sourcePage] || null }
    const anno = annotationFor(stamped, "@burialIndex", nameOf)
    if (anno) operations.push({ kind: "annotation", payload: anno, localId: record.id })
  }

  // Find a Grave annotations come after the index annotations so their person target is
  // guaranteed to exist; the loader skips them if they are already in the ledger.
  for (const record of records) {
    const fa = findagraveAnnotationFor(record)
    if (fa) operations.push({ kind: "findagrave", payload: fa, localId: record.id })
  }

  const members = records.map((r) => ({ "@id": `@person:${r.id}`, "@type": "Person", name: personName(r) }))
  operations.push({ kind: "list-append", payload: { members } })
  return { document: BURIAL_INDEX_DOC, operations }
}

/**
 * Page id -> the photograph it was read from, taken from the handoff row scaffold.
 *
 * rows.json records paths from the repository root, but this provenance is published into a
 * linked-data store where "web/manifest/fotki/x.jpg" cannot be opened by anyone. Resolve it
 * against the deployed site so a consumer can fetch the page a claim was read from.
 */
export function pageIndexImages(rows) {
  const map = {}
  for (const page of rows.pages || []) map[page.id] = page.image ? publicImageUrl(page.image) : null
  return map
}

export const SITE_BASE = (process.env.SITE_BASE || "https://cubap.github.io/McElwee/web/").replace(/\/?$/, "/")

export function publicImageUrl(repoPath) {
  if (/^https?:\/\//i.test(repoPath)) return repoPath
  return SITE_BASE + repoPath.replace(/^\.?\/?(web\/)?/, "")
}

export function loadEvidence(file) {
  const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")
  return JSON.parse(raw)
}

export function defaultEvidencePath(root = process.cwd()) {
  return path.join(root, "source", "burials-evidence", "burials-evidence.json")
}
