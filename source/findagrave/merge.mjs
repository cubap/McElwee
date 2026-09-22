// Merge Find a Grave memorial data into burials-evidence.json.
//
// For every catalog row that has one confident FGrave page (see match.mjs: stage
// exact/year/name, single hit), attach a `findagrave` block:
//
//   {
//     id, url, memorialName, dateRange,        // what FGrave asserts
//     death,                                    // FGrave death date verbatim
//     photo,                                    // one grave photograph (the first)
//     citation, accessed, maintainer,           // the page's own "Source citation",
//     catalogId                                  //   with the accessed date filled in
//   }
//
// Rows matched only by surname (descendants of our people, buried here but not in
// the index) are NOT merged: they are not catalog rows. They stay in
// catalog-memorials.json alongside the catalog-matched ones, for the record.
//
// Ambiguous matches (two catalog rows, same year) are dropped, per project
// decision 22 Sep 2026 - anything worth finding will surface again.
//
// Run:  node source/findagrave/merge.mjs
//
// burials-evidence/build-evidence.mjs regenerates burials-evidence.json from the
// transcriptions and would drop these blocks. The evidence build is the upstream
// tool; this merge is the last step before scripts/build-burials.js or
// scripts/build-burials.js-style payloads consume it. Re-run this file after
// re-running build-evidence.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const evidence = JSON.parse(readFileSync(join(root, 'burials-evidence', 'burials-evidence.json'), 'utf8'))
const match = JSON.parse(readFileSync(join(here, 'match.json'), 'utf8'))
const citations = new Map(
  JSON.parse(readFileSync(join(here, 'citations.json'), 'utf8')).map((c) => [c.id, c])
)
// match.json only carries a photo count; the actual URLs live on the scraped memorial
const memorials = new Map(
  JSON.parse(readFileSync(join(here, 'memorials.json'), 'utf8')).map((m) => [m.id, m])
)

const records = evidence.records || []
const byId = new Map(records.map((r) => [r.id, r]))

const merged = []
const catalogMemorials = []
const droppedAmbiguous = []
let missingCitation = []

for (const m of match.results) {
  const cit = citations.get(m.fagId)
  const mem = memorials.get(m.fagId)
  if (!cit || !cit.citation) { missingCitation.push(m.fagId); continue }

  const photos = (mem && mem.photos) || []
  const entry = {
    id: m.fagId,
    url: m.url,
    memorialName: m.name,
    birth: m.birth || null,
    death: m.death || null,
    photo: photos[0] || null,
    photoCount: photos.length,
    accessed: cit.accessed,
    maintainer: cit.maintainer,
    citation: cit.citation
  }

  if (m.matchCertainty === 'ambiguous') {
    entry.dropped = true
    droppedAmbiguous.push({ memorial: entry, candidates: m.match.map((x) => x.id) })
    continue
  }

  if (m.matchCertainty === 'exact' || m.matchCertainty === 'year' || m.matchCertainty === 'name') {
    const rec = byId.get(m.match[0].id)
    if (!rec) { missingCitation.push(m.fagId); continue }
    rec.findagrave = { ...entry, catalogId: rec.id }
    merged.push({ catalogId: rec.id, ...entry })
  } else {
    // surname-only: a FGrave page for some member of the family, not tied to a row
    catalogMemorials.push(entry)
  }
}

// Drop the stale match stats file from the output: keep the three result files.
writeFileSync(join(root, 'burials-evidence', 'burials-evidence.json'), JSON.stringify(evidence, null, 2))
writeFileSync(join(here, 'catalog-memorials.json'), JSON.stringify({
  note: 'Find a Grave memorials in McElwee Cemetery that are NOT one-to-one with a row in the catalog index: surname matches but no confident same-person tie, or matched to a row that was dropped as ambiguous. Kept for the record.',
  generated: new Date().toISOString().slice(0, 10),
  catalogMatched: merged,
  droppedAmbiguous,
  surnameOnly: catalogMemorials
}, null, 2))

console.log(`merged into catalog rows: ${merged.length}`)
console.log(`  with a grave photo:     ${merged.filter((m) => m.photo).length}`)
console.log(`surname-only (kept):      ${catalogMemorials.length}`)
console.log(`dropped (ambiguous):      ${droppedAmbiguous.length}`)
if (missingCitation.length) console.log(`WARNING: no citation for: ${missingCitation.join(', ')}`)
