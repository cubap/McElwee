/**
 * Publishes the burial index transcription as static exhibit data.
 *
 * This is the same transform the RERUM loader uses (scripts/burials-payloads.js), reduced to
 * what a browser needs, and it deliberately keeps the loader's claim vocabulary: description,
 * birthDate, deathDate, ageAtDeath, relationship, relatedTo, engravingText, familyGroup. When
 * the records move into the store, the exhibit reads the same keys from the same objects and
 * nothing here has to be rewritten.
 *
 * The index is a typescript with no named compiler, so the only honest citation is a pointer
 * at the page it was read from. Every record therefore carries the image and the pixel
 * rectangle of its own line, which is what makes the whole thing checkable.
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const EVIDENCE = path.join(ROOT, "source", "burials-evidence", "burials-evidence.json")
const ROWS = path.join(ROOT, "source", "handoff", "burials", "rows.json")
const OUT = path.join(ROOT, "web", "data", "burials.json")

/** Claim keys in the order a reader should meet them. */
const CLAIM_ORDER = ["description", "birthDate", "deathDate", "ageAtDeath", "relationship", "relatedTo", "engravingText", "familyGroup"]

function read(file) {
  if (!fs.existsSync(file)) throw new Error(`missing ${path.relative(ROOT, file)}`)
  return JSON.parse(fs.readFileSync(file, "utf8"))
}

/** Page id -> the image and geometry the evidence rectangles were measured against. */
function pageMap(rows) {
  const pages = {}
  for (const page of rows.pages || []) {
    if (!page.id) continue
    pages[page.id] = {
      // rows.json records paths from the repository root, but this file is read by
      // web/index.html, so the leading web/ has to come off or it doubles up.
      image: typeof page.image === "string" ? page.image.replace(/^\.?\/?web\//, "") : null,
      width: page.width || 600,
      height: page.height || 800,
      skew: page.skew || 0,
      credit: page.credit || null
    }
  }
  return pages
}

function claimsFor(record) {
  const f = record.fields || {}
  const claims = {}
  if (record.entryText) claims.description = record.entryText
  if (f.born) claims.birthDate = f.born
  if (f.died) claims.deathDate = f.died
  if (f.aged) claims.ageAtDeath = f.aged
  if (f.relationship) claims.relationship = f.relationship
  if (f.parents) claims.relatedTo = f.parents
  if (record.engraving?.entryText) claims.engravingText = record.engraving.entryText
  if (f.refId) {
    claims.familyGroup = {
      value: f.refName || f.refId,
      headOf: f.refId,
      certainty: f.refCertainty || null
    }
  }
  return claims
}

/** Ordered so the renderer walks one array instead of re-deciding priority per row. */
function orderClaims(claims) {
  return CLAIM_ORDER.filter((k) => claims[k]).map((k) => ({ key: k, value: claims[k] }))
}

export function build(evidence, rows) {
  const pages = pageMap(rows)
  const records = (evidence.records || []).map((record) => {
    const claims = claimsFor(record)
    const engraving = record.engraving
      ? { page: record.engraving.sourcePage, rect: record.engraving.rect, text: record.engraving.entryText }
      : null
    const fa = record.findagrave
    const findagrave = fa ? {
      url: fa.url,
      memorialId: fa.id,
      photo: fa.photo || null,
      photoCount: fa.photoCount || 0,
      citation: fa.citation,
      accessed: fa.accessed,
      maintainer: fa.maintainer || "Find a Grave"
    } : null
    return {
      id: record.id,
      surname: record.surname || "",
      givenName: record.givenName || "",
      page: record.sourcePage,
      seq: record.seq,
      rect: record.evidence?.rect || null,
      claims,
      claimList: orderClaims(claims),
      engraving,
      findagrave
    }
  })

  records.sort((a, b) => {
    const s = a.surname.localeCompare(b.surname, "en")
    return s !== 0 ? s : String(a.givenName).localeCompare(String(b.givenName), "en")
  })

  const used = new Set()
  records.forEach((r) => {
    if (r.page) used.add(r.page)
    if (r.engraving?.page) used.add(r.engraving.page)
  })
  const cited = {}
  Object.keys(pages).forEach((id) => {
    if (used.has(id)) cited[id] = pages[id]
  })

  return { generated: new Date().toISOString().slice(0, 10), count: records.length, pages: cited, records }
}

function generate() {
  const data = build(read(EVIDENCE), read(ROWS))

  // A rectangle pointing at a page we did not ship would open a blank proof.
  const orphans = data.records.filter((r) => r.rect && !data.pages[r.page])
  if (orphans.length) {
    throw new Error(`${orphans.length} records cite a page with no image, e.g. ${orphans[0].page}`)
  }
  const missing = data.records.filter((r) => !r.rect)
  if (missing.length) {
    console.warn(`note: ${missing.length} records have no line rectangle and will cite the page only`)
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(data))
  return { data }
}

/** Called by scripts/build.js so the published site always matches the committed evidence. */
export function run() {
  const { data } = generate()
  const kb = (fs.statSync(OUT).size / 1024).toFixed(1)
  console.log(`  burials ${data.count} records, ${Object.keys(data.pages).length} pages, ${kb} KB -> web/data/burials.json`)
  return data
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run()
}
