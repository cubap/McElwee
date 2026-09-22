// Cross-match the scraped Find a Grave memorials against the burials-evidence
// catalog records. Which of our 117 catalog rows have a FGrave page (and
// therefore photos + a citable source), and which FGrave pages are relatives
// *not* in the catalog (descendants, in-laws).
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const fa = JSON.parse(readFileSync(join(here, 'memorials.json'), 'utf8'))
const ev = JSON.parse(readFileSync(join(root, 'burials-evidence/burials-evidence.json'), 'utf8'))
export const recs = ev.records || []

const norm = s => String(s || '').toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim()
const year = s => { const m = String(s || '').match(/(\d{4})/); return m ? Number(m[1]) : null }

// catalog key: normalized "surname givenName" -> record
const catByKey = {}
for (const r of recs) {
  const key = norm(r.surname + ' ' + r.givenName)
  ;(catByKey[key] ||= []).push(r)
}

// Catalog names are surname-first ("CARR Elizabeth C.") and abbreviate given
// names to initials; FGrave names are given-first and fully spelled out.
// Strategy per FGrave page:
//   1. exact : FGrave name equals a catalog "givenName surname" key
//   2. year  : surname matches AND birth or death year is in the catalog row
//   3. name  : surname matches AND every catalog given-name token (including
//              initials) is present in the FGrave given names
//   4. surnameOnly : a row with that surname exists but no year/name evidence
//   5. none  : no catalog row for that surname at all
const fagOf = (m) => {
  const t = norm(m.name).split(' ').filter(Boolean)
  return { surname: t[t.length - 1], given: t.slice(0, -1) }
}
const catGivenTokens = (r) => norm(r.givenName).split(' ').filter(Boolean)
const tokMatch = (f, t, fSur) => {
  if (f === t) return true
  if (f[0] !== t[0]) return false
  if (t.length === 1 || f.length === 1) return true
  return f.slice(0, 2) === t.slice(0, 2)
}
const catBirthYear = (r) => r.fields?.bornYear ?? year(r.fields?.born)
const catDeathYear = (r) => r.fields?.diedYear ?? year(r.fields?.died)

const results = []
for (const m of fa) {
  const { surname: fSur, given: fGiven } = fagOf(m)
  const mBirth = year(m.birthDate)
  const mDeath = year(m.deathDate)
  let hits = catByKey[norm(m.name)] || []
  let stage = 'exact'
  if (!hits.length) {
    // Stage 2: year-based
    const byYear = recs.filter((r) => {
      if (norm(r.surname) !== fSur) return false
      const cb = catBirthYear(r)
      const cd = catDeathYear(r)
      if (mBirth && cb && cb === mBirth) return true
      if (mDeath && cd && cd === mDeath) return true
      return false
    })
    if (byYear.length) {
      // if the year alone is ambiguous, let name tokens break the tie
      const named = byYear.filter((r) => {
        const toks = catGivenTokens(r).filter((t) => t !== fSur && t !== 'infant')
        if (!toks.length) return false
        return toks.every((t) => fGiven.some((f) => tokMatch(f, t, fSur)))
      })
      hits = named.length ? named : byYear
      stage = 'year'
    }
  }
  if (!hits.length) {
    // Stage 3: name-based. A catalog given-name token matches a FGrave token
    // when equal, when either is a single-letter initial sharing the other's
    // first letter, or (leniently) when the first two characters agree.
    // Catalog tokens that repeat the surname, or 'infant', are ignored.
    const byName = recs.filter((r) => {
      if (norm(r.surname) !== fSur) return false
      const toks = catGivenTokens(r).filter((t) => t !== fSur && t !== 'infant')
      return toks.length > 0 && toks.every((t) =>
        fGiven.some((f) => tokMatch(f, t, fSur))
      )
    })
    if (byName.length) { hits = byName; stage = 'name' }
  }
  if (!hits.length) {
    // Stage 4: surname-only (descendants / unrelated in-laws)
    if (recs.some((r) => norm(r.surname) === fSur)) { stage = 'surname-only' } else { stage = 'none' }
  }

  results.push({
    fagId: m.id,
    name: m.name,
    url: m.url,
    birth: m.birthDate || null,
    death: m.deathDate || null,
    photos: m.photoCount || 0,
    stage,
    match: hits.length ? hits.map(h => ({ id: h.id, catalogName: `${h.givenName} ${h.surname}`, born: h.fields?.born || null, died: h.fields?.died || null })) : null,
    matchCertainty: hits.length === 1 ? stage : hits.length > 1 ? 'ambiguous' : stage
  })
}

const byCert = (k) => results.filter((r) => r.matchCertainty === k)
const exact = byCert('exact')
const yearM = byCert('year')
const nameM = byCert('name')
const surnameOnly = byCert('surname-only')
const ambiguous = byCert('ambiguous')
const none = byCert('none')
const withPhotos = results.filter((r) => r.photos > 0)
const matchedRowIds = new Set([...exact, ...yearM, ...nameM, ...ambiguous].flatMap((r) => (r.match || []).map((x) => x.id)))

console.log(`FGrave pages: ${results.length}`)
console.log(`  exact name match    : ${exact.length}`)
console.log(`  year match          : ${yearM.length}`)
console.log(`  name-token match    : ${nameM.length}`)
console.log(`  ambiguous           : ${ambiguous.length}`)
console.log(`  surname-only        : ${surnameOnly.length}`)
console.log(`  no catalog match    : ${none.length}`)
console.log(`  pages with photos   : ${withPhotos.length} (${withPhotos.reduce((a, r) => a + r.photos, 0)} photos)`)
console.log(`  catalog rows        : ${recs.length}; rows with a FGrave page: ${matchedRowIds.size}; unmatched rows: ${recs.length - matchedRowIds.size}`)

writeFileSync(join(here, 'match.json'), JSON.stringify({
  note: 'Cross-match of the Find a Grave memorials in McElwee Cemetery against the catalog rows. matchCertainty: exact | year | name = confident same person (single row); ambiguous = two catalog rows, needs a human; surname-only = a family page with no confident row; none = no catalog surname at all.',
  generated: new Date().toISOString(),
  stats: { total: results.length, exact: exact.length, year: yearM.length, name: nameM.length, ambiguous: ambiguous.length, surnameOnly: surnameOnly.length, none: none.length, withPhotos: withPhotos.length, catalogRows: recs.length, matchedRows: matchedRowIds.size },
  results
}, null, 2))

console.log('\nExact matches:')
for (const r of exact) console.log(`  ${r.name}  ${r.birth || '?'} – ${r.death || '?'}  [${r.photos} photos] -> ${r.match.map(x => x.id).join(', ')}`)

console.log('\nAmbiguous (needs review):')
for (const r of ambiguous) console.log(`  ${r.name}  ${r.birth || '?'} – ${r.death || '?'}  ->  ${r.match.map(x => `${x.id} (${x.catalogName}, d. ${x.died})`).join(' | ')}`)

console.log('\nNo-match (relatives / descendants outside catalog):')
for (const r of none) console.log(`  ${r.name}  ${r.birth || '?'} – ${r.death || '?'}  [${r.photos} photos]`)
