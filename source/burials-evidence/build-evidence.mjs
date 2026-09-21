// Assemble the McElwee burials evidence dataset.
// Combines manual visual transcriptions (index + inscription/engraving pages),
// measured row rectangles, and derived structured fields, then resolves
// intra-dataset relationships. Output is the evidence store that the Eventities
// / Web-Annotation transform consumes.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const index = JSON.parse(readFileSync(join(here, 'index-transcriptions.json'), 'utf8'))
const script = JSON.parse(readFileSync(join(here, 'script-transcriptions.json'), 'utf8'))
const bounds = JSON.parse(readFileSync(join(here, 'row-bounds.json'), 'utf8'))

function yearOf(dateStr) {
  if (!dateStr) return null
  const m = String(dateStr).match(/(\d{4})/)
  return m ? Number(m[1]) : null
}

function parseEntry(entry) {
  const text = entry.trim()
  let relationship = null
  let parents = null
  // The referenced name runs until a fact-marker or a boundary. The marker can
  // be "born"/"died", the abbreviation "b."/"d." (inscription pages), a paren,
  // a comma, or end of string.
  const relMatch = text.match(/\b(S\/O|D\/O|W\/O|H\/O|F\/W|M\/W|F\/B)\s+([A-Za-z][A-Za-z.\s'&-]*?)(?=\s+(?:born|b)\.?\s|\s+(?:died|d)\.?\s|\s*\(|,|$)/i)
  if (relMatch) {
    relationship = relMatch[1].toUpperCase()
    parents = relMatch[2].replace(/[.\s]+$/, '').trim()
  }
  // born/died spelled out, or abbreviated b./d. (the inscription pages use the
  // latter). Both may be followed by a full month-day-year date.
  const bornM = text.match(/\b(?:born|b\.)\s+([A-Z][a-z]{2,9}\.?\s+\d{1,2},?\s+\d{4})/i)
  const diedM = text.match(/\b(?:died|d\.)\s+([A-Z][a-z]{2,9}\.?\s+\d{1,2},?\s+\d{4})/i)
  const born = bornM ? bornM[1].trim() : null
  const died = diedM ? diedM[1].trim() : null
  const agedM = text.match(/aged\s+([^,;]+?)(?:[.,]|$)/i)
  let aged = null
  if (agedM) {
    const a = agedM[1].replace(/\s+/g, ' ').trim()
    if (/[YyMmDd]/.test(a)) aged = a
  }
  const ym = text.match(/\b(?:born|b\.)\s+(?:[A-Z][a-z]{2,9}\.?\s+)?(\d{4})\b/i)
  const dm = text.match(/\b(?:died|d\.)\s+(?:[A-Z][a-z]{2,9}\.?\s+)?(\d{4})\b/i)
  let bornYear = ym ? Number(ym[1]) : (yearOf(born) || null)
  let diedYear = dm ? Number(dm[1]) : (yearOf(died) || null)
  const rangeM = text.match(/(\d{4})\s*[-–]\s*(\d{4})/)
  if (rangeM) {
    const rB = Number(rangeM[1]); const rD = Number(rangeM[2])
    if (bornYear === null) bornYear = rB
    if (diedYear === null) diedYear = rD
  }
  return { relationship, parents, born, died, aged, bornYear, diedYear }
}

function givenNameOf(entry) {
  let s = entry.trim()
  // Cut at a relationship marker, born/died, comma or parenthesis —
  // case-insensitively so both "W/O" and "w/o" are handled.
  const cut = s.search(/\s(s\/o|d\/o|w\/o|h\/o|f\/w|m\/w|f\/b)\b|\sborn\b|\sdied\b|,|\(/i)
  if (cut > 0) s = s.slice(0, cut)
  return s.trim()
}

function nameTokens(nameStr) {
  const clean = (nameStr || '').replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim()
  const parts = clean.split(' ')
  const surnameCandidates = parts.filter(p => /^[A-Z]{2,}$/.test(p))
  return { parts, surnameCandidates }
}

function referencedPeople(parentsStr, surname) {
  const s = (parentsStr || '').trim()
  const parts = s.split(/\s+and\s+|\s*&\s*/i)
  return parts.map(p => {
    const t = p.trim()
    return surname && !new RegExp(surname + '$', 'i').test(t) ? `${t} ${surname}` : t
  })
}

function initialsOf(name, surname) {
  // Given-name initials, dropping a trailing token that is the surname.
  let tokens = (name || '').replace(/[.,]/g, '').split(/\s+/).filter(Boolean)
  if (surname) {
    const last = tokens[tokens.length - 1]
    if (last && last.toLowerCase() === surname.toLowerCase()) tokens = tokens.slice(0, -1)
  }
  return tokens.filter(Boolean).map(t => t.toLowerCase())
}

function givenMatches(personGiven, refName) {
  // both reduced to initials; surname context already filtered outside.
  const pInit = initialsOf(personGiven)
  const rInit = initialsOf(refName)
  if (rInit.length === 0) return false
  const pShort = pInit.map(t => t[0])
  const rShort = rInit.map(t => t[0])
  if (pShort.length !== rShort.length) return false
  return pShort.every((c, i) => c === rShort[i])
}

// ---- build index records -------------------------------------------------
const records = []
const pages = ['BurialsAlpha001', 'BurialsAlpha002', 'BurialsAlpha003', 'BurialsAlpha004', 'BurialsAlpha005']
for (const page of pages) {
  const pageRows = (index.pages[page] || {}).rows || []
  const boundsFor = bounds[page] || []
  for (const row of pageRows) {
    const b = boundsFor.find(x => x.seq === row.seq) || {}
    const fields = parseEntry(row.entry)
    const rec = {
      id: `${page}_${row.seq}`,
      sourcePage: page,
      seq: row.seq,
      surname: row.surname,
      givenName: givenNameOf(row.entry),
      entryText: row.entry,
      evidence: {
        text: row.entry,
        rect: { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, skew: b.skew, source: 'source-image-pixels-600x800' }
      },
      fields
    }
    records.push(rec)
  }
}

// ---- resolve relationships ----------------------------------------------
records.forEach(rec => {
  const f = rec.fields
  if (!f.parents) return
  const { surnameCandidates } = nameTokens(f.parents)
  const surname = surnameCandidates[surnameCandidates.length - 1] || rec.surname
  const referenced = referencedPeople(f.parents, surname)
  const resolved = []
  for (const refName of referenced) {
    const pool = records.filter(other => {
      if (other.id === rec.id) return false
      if (surname && !other.surname.toLowerCase().includes(surname.toLowerCase())) return false
      return givenMatches(other.givenName, refName)
    })
    for (const hit of pool) {
      if (!resolved.find(x => x.id === hit.id)) resolved.push(hit)
    }
  }
  if (resolved.length === 1) {
    f.refId = resolved[0].id
    f.refName = resolved[0].givenName + ' ' + resolved[0].surname
    f.refCertainty = 'high'
  } else if (resolved.length > 1) {
    f.refId = resolved.map(r => r.id)
    f.refName = resolved.map(r => r.givenName + ' ' + r.surname)
    f.refCertainty = 'ambiguous'
  }
})

// ---- build & align inscription (engraving) transcription records ---------
const scriptRecords = []
for (const page of Object.keys(script.pages)) {
  const rows = (script.pages[page] || {}).rows || []
  for (const row of rows) {
    const fields = parseEntry(row.entry)
    const rec = {
      id: `${page}_${row.seq}`,
      sourcePage: page,
      seq: row.seq,
      surname: row.surname,
      givenName: givenNameOf(row.entry),
      entryText: row.entry,
      fields
    }
    scriptRecords.push(rec)
  }
}

function samePerson(idxRec, scrRec) {
  if (idxRec.surname.toLowerCase() !== scrRec.surname.toLowerCase()) return false
  const p = initialsOf(idxRec.givenName, idxRec.surname)
  const s = initialsOf(scrRec.givenName, scrRec.surname)
  if (p.length === 0 || s.length === 0) return false
  if (p.length !== s.length) return false
  if (!p.every((c, i) => c === s[i])) return false
  const iy = idxRec.fields.diedYear
  const sy = scrRec.fields.diedYear
  if (iy && sy && iy !== sy) return false
  return true
}
const unmatchedScript = []
for (const scrRec of scriptRecords) {
  const match = records.filter(r => samePerson(r, scrRec))
  const scrBounds = bounds[scrRec.sourcePage] || []
  const sb = scrBounds.find(x => x.seq === scrRec.seq) || {}
  if (match.length === 1) {
    match[0].engraving = {
      id: scrRec.id,
      sourcePage: scrRec.sourcePage,
      givenName: scrRec.givenName,
      surname: scrRec.surname,
      entryText: scrRec.entryText,
      rect: { x0: sb.x0, y0: sb.y0, x1: sb.x1, y1: sb.y1, skew: sb.skew, source: 'source-image-pixels-600x800' },
      fields: scrRec.fields
    }
  } else if (match.length > 1) {
    scrRec.alignedTo = match.map(m => m.id)
    unmatchedScript.push(scrRec)
  } else {
    unmatchedScript.push(scrRec)
  }
}

// ---- inference & disagreement -------------------------------------------
// 1) If a birth year is missing but a death year and an age are both recorded,
//    derive a birth-year range. The index spells age as "aged 4y 3m 18d" etc.
//    We use the death year and the whole-year part of the age: birthYear is in
//    [deathYear - (ageYears + 1), deathYear - ageYears]. This is an inference
//    and is always flagged as such.
function ageYears(aged) {
  if (!aged) return null
  const m = String(aged).match(/(\d+)\s*[Yy]/)
  return m ? Number(m[1]) : null
}
const inferences = []
records.forEach(rec => {
  const f = rec.fields
  if (!f.born && !f.bornYear && f.diedYear && f.aged) {
    const y = ageYears(f.aged)
    if (y !== null) {
      const lo = f.diedYear - (y + 1)
      const hi = f.diedYear - y
      f.inferredBirthYear = { lo, hi, basis: `death ${f.diedYear} minus age ${f.aged}` }
      inferences.push({ id: rec.id, givenName: rec.givenName, surname: rec.surname, ...f.inferredBirthYear, basis: f.inferredBirthYear.basis })
    }
  }
})

// 2) Disagreements between the index record and its aligned engraving text.
const disagreements = []
records.forEach(rec => {
  if (!rec.engraving) return
  const f = rec.fields
  const e = rec.engraving.fields
  if (f.diedYear && e.diedYear && f.diedYear !== e.diedYear) {
    disagreements.push({ id: rec.id, name: rec.givenName + ' ' + rec.surname, field: 'diedYear', index: f.diedYear, engraving: e.diedYear })
  }
  if (f.bornYear && e.bornYear && f.bornYear !== e.bornYear) {
    disagreements.push({ id: rec.id, name: rec.givenName + ' ' + rec.surname, field: 'bornYear', index: f.bornYear, engraving: e.bornYear })
  }
})

const out = {
  '@context': 'mcelwee-burials-evidence-v1',
  note: 'Evidence dataset over the McElwee Cemetery burial catalog. Records are the alphabetical-index transcriptions (one per person). Each assertion carries the verbatim index text and the source-image rectangle. Engraving-text transcriptions from the Inscription pages are aligned where a confident same-person match exists. Structured fields (birth, death, age, relationship, parents) are derived from the index text; relationship links resolve to other records in this dataset. Where a detail is missing but inferable (death year minus age), an inferred value with its basis is supplied and flagged. Disagreements between the index and its aligned engraving text are listed separately for human review.',
  records,
  engravingUnmatched: unmatchedScript,
  inferredBirths: inferences,
  disagreements
}
writeFileSync(join(here, 'burials-evidence.json'), JSON.stringify(out, null, 2))
console.log(`records=${records.length}, engraving aligned=${records.filter(r => r.engraving).length}, engraving unmatched=${unmatchedScript.length}, inferred births=${inferences.length}, disagreements=${disagreements.length}`)
