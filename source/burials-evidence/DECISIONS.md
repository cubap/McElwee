# Decisions & Review Notes — Burials Evidence Extraction

This directory holds the evidence-extraction pass over the McElwee Cemetery burial
catalog photographs in `web/manifest/fotki/burials/` (15 pages, 600×800 px). It turns the
photographs into a dataset where every assertion about a buried person carries its source
text and the exact rectangle of the photograph it came from, ready for transformation into
Web Annotations in the Eventities model.

This document records the decisions made along the way and the places where a human review
is owed. **Everything here is a proposal, not a fact about the dead.** The catalog's own
origin is unrecorded; these transcriptions are one reading of it.

---

## 1. Scope and what was read

| Page group | Pages | What they are | Used as |
|---|---|---|---|
| Alphabetical index | `Alpha001`–`Alpha005` | Two-column surname / entry table | **The "full record"** — one row per person |
| Inscription transcriptions | `Page002`–`Page007` | Typed text of the headstone engravings | **The engraving text** to align against |
| Given-name index | `Index001`–`Index003` | Name → page-number locator | Not a per-person record; cross-reference only |
| Cover | `Alpha000` | Title page (title, photo, "March 1833 to March 1941") | Not a person record |

`Family001` is not among the images present in `web/manifest/fotki/burials/` (it is a
landscape prose page referenced by the handoff manifest but absent here), so the family
narrative was not transcribed.

**The alphabetical index is treated as the primary record set.** It is the only section
where one printed row corresponds cleanly to one person, which is what a Web-Annotation
"main entity" (a buried Person) needs.

---

## 2. Method — no machine OCR

Per the request ("don't use the existing OCR it is trash"), **none** of the transcription
comes from the OCR output in `source/burials-index/`. Every `entry` string in
`index-transcriptions.json` and `script-transcriptions.json` was read by an agent directly
from the photograph.

What *was* reused is the **row geometry** from `source/handoff/burials/rows.json` and the
segmentation in `source/burials-index/bands.json`. Those supply the vertical `y0`/`y1` band
for each row — the row detection / deskew, not the letters. This is important: the row
boundaries (Sauvola adaptive thresholding + deskew) were independently validated and are
trustworthy, while the OCR lettering was not. Splitting those two concerns is the whole
reason this pass works.

### The rotated rectangle
Each row is presented as a **rotated rectangle** (the photos are skewed 0°–2.7° per page).
The page skew angle is taken from `rows.json` and the horizontal extent is measured from the
image pixels (see `measure-bounds.ps1`) to cover the surname gutter *and* the entry text.
The rectangle is stored as `{ x0, y0, x1, y1, skew }` in **source-image pixel space
(600×800)**, so it is directly consumable by an Image API / annotation selector after the
IIIF or Image-API `scale`/`rotation` is applied.

Skew per page: `Alpha005` 1.6°, `Page002` 1.6°, `Page003` 1.9°, `Page004` 0.8°, `Page005`
2.7°, `Page006` 0.8°, `Page007` 1.4°; all others 0°.

---

## 3. The data store

`burials-evidence.json` is the assembled evidence store. For **117** index records it holds:

- `id` — stable key, `{Page}_{seq}` (e.g. `BurialsAlpha001_5`), matching the handoff seq.
- `sourcePage`, `seq`, `surname`, `givenName`, `entryText` — the verbatim index line.
- `evidence.rect` — the rotated rectangle in source pixels.
- `fields` — **derived** from `entryText`:
  - `relationship` (`S/O`, `D/O`, `W/O`, `H/O`, `F/W`, `M/W`, `F/B`)
  - `parents` (the referenced parent/spouse name)
  - `born`, `bornYear`, `died`, `diedYear`, `aged`
- `engraving` — where the inscription page has a same-person record, the aligned engraving
  transcription, its own rectangle, and its own fields.

The engraving-only pages also produce records in `engravingUnmatched` when they could not be
confidently aligned to an index record.

This is deliberately **plain JSON**, not annotations yet. The next phase converts each
record into Web Annotations in the Eventities model; keeping this store plain makes that
conversion a mechanical transform, and the per-assertion evidence is already in place.

---

## 4. Field extraction decisions

The index is formulaic:
`<given> <REL/O> <parents>, born <date>, died <date> — aged <age>`.

- `born` / `died` capture the full month-day-year string. `bornYear` / `diedYear` are the
  year. The inscription pages abbreviate as `b.`/`d.`; both forms are handled.
- `aged` is kept as printed (e.g. `1 Y., 8 M. and 8 D.`, `53y 9m 15d`).
- `relationship` and `parents` are captured only when the literal abbreviation appears. So
  `Marion D. born 1866, died 1939` (no relationship) correctly yields `relationship: null`.
- Middle-initial-only records (e.g. the `B.`/`D.` that could look like `b.`/`d.`) are **not**
  treated as dates unless a month name or digit follows. This avoids the classic
  "confident-wrong-date" error.
- Dates are kept verbatim, never normalised. Where the index and the engraving differ, no
  value is reconciled—the conflict is reported instead (see §6).

---

## 5. Relationships between records

For every record whose `parents` name can be resolved to another record **in this same
dataset**, the record carries `fields.refId`, `fields.refName`, and a `refCertainty`
(`high` or `ambiguous`).

Matching is by **surname** (the referenced surname, spelled out in the entry) plus
**given-name initials** in order, and the referenced name is split on `and` / `&` so
`S/O J. W. and E. C. CARR` resolves to both parents.

Examples resolved with `high` confidence:
- `Jemima W/O Francis GILMORE` → `Francis GILMORE`
- `Margaret E. W/O Lawson W. GIVENS` → `Lawson W. GIVENS`
- `Henry S. S/O Dan and N. L. McELWEE` → `Dan McELWEE`
- `Nancy L. W/O Dan McELWEE` → `Dan McELWEE`

Examples left `ambiguous` because two plausible same-initial records exist:
- `Ulyses S. S/O J. W. and I. J. GIVENS` → could be `James W.` or `Isabel J.`
- `Samuel L. S/O Joel R. AND Margaret A. J. ROWLEY` → multiple Rowley candidates

An `ambiguous` result is a genuine "needs a human" flag, not a failure — the relationship
is almost certainly correct, but which record is which requires confirmation.

**Resolved: 38 index records** reference another record in the set; the rest reference
people outside the 117-record set (parents/spouses not themselves buried under a row, or
not present in the photographed pages) and are left as name strings.

---

## 6. Inferred values (flagged, not asserted as fact)

Where a detail is missing but derivable, an **inferred** value is supplied with its basis and
clearly marked. The one inference encoded: **birth year range from death year minus age.**

> `inferredBirthYear = { lo: diedYear - (ageYears + 1), hi: diedYear - ageYears, basis }`

**24 records** get an inferred birth-year range this way. For example:
- `Francis GILMORE`, died 1841 aged 76y ⇒ birth **1764–1765**
- `Dan McELWEE`, died 1873 aged 66y ⇒ birth **1806–1807**
- `Nancy L. McELWEE`, died 1892 aged 77y ⇒ birth **1814–1815**

This is a true inference (the age is only years, not months/days, and age conventions differ
across birth/death date alignment), so it is stored separately and never folded into the
record's `bornYear`.

---

## 7. Disagreements between the index and the engraving — human review required

The index and the inscription pages are **two independent transcriptions of the same
stones**. Where they disagree, **both could be wrong** and the answer is the gravestone
photo or physical copy — never a merge. Two conflicts were found in aligned records:

| Record | Field | Index | Engraving |
|---|---|---|---|
| `Mary L. CARR` | bornYear | **1873** | **1872** |
| `Permelia J. CARR` | bornYear | **1869** | **1862** |

These are listed in `burials-evidence.json` under `disagreements`. Note the second is a
seven-year spread — either a typo in one source or a different stone; do not resolve
automatically. (The Permelia Century discrepancy also appears in the unrelated OCR baseline
as `1869`/`1862`, so both readings exist in the sources.)

---

## 8. Engraving records that could not be aligned — human review

30 of the inscription-page records could not be confidently aligned to an index record and
are listed in `engravingUnmatched`. The reasons are worth reading as a group:

- **Initials differ between sources** (e.g. index `Claud H. B.` vs engraving `Claud J.`;
  index `Theo` vs engraving `Theodore A.`; index `Mehala J.` vs engraving `Mahala J.`).
  These are the same person with a different spelling or a misread initial — a human should
  confirm the canonical form.
- **Surname variant / re-surname** (`Azuban` vs `Azubam`; `Isabell`/`Isabel`; `Howel` vs
  `Howell`).
- **Standalone year-range records** where the engraving gives only `1889 - 1897` (e.g.
  `Cornie RUSSELL`, `Edwin Wilson 1841-1928`) and the reference has a different given-name
  shape.
- A few are genuinely not in the index (e.g. `Sarah TAYLOR` in the engraving, listed under
  the index as `Sarah Amanda Perkins TAYLOR`).

None of these were force-matched. Forcing a match on `Cornie 1889 - 1897` would risk
attributing a death to the wrong person; leaving them unmatched and flagged is the honest
result.

---

## 9. Known limitations & issues

1. **Resolution.** These are 600×800 (~100 DPI) photographs of a letter-size page. Some
   dates and initials are readable but not certain. Every uncertain reading should be
   re-checked against the physical desk copy or a higher-resolution scan before publishing.
2. **Ordering of the `Index`/`Page` sections is uncertain** (noted in `rows.json`). The
   inscription-page seq numbers here are the handoff ordinals, not a guaranteed page order.
3. **`Family001` absent** from the image set → the family-narrative prose block was not
   transcribed.
4. **Birth years inferred, not asserted.** See §6.
5. **The `Alphabetical` index is the only one-per-person source.** It is itself a
   transcription of unknown origin; it is *evidence about* the stones, not the stones.
6. **Cover-page range "March 1833 to March 1941" is not trustworthy** — the index itself
   contains a birth in 1805 and a death in 1999. Not used as a constraint.

---

## 10. How to re-run

```powershell
powershell -ExecutionPolicy Bypass -File source\burials-evidence\measure-bounds.ps1
node source\burials-evidence\build-evidence.mjs
```

`measure-bounds.ps1` re-measures the row rectangles from the photographs against
`source/handoff/burials/rows.json`. `build-evidence.mjs` re-assembles
`burials-evidence.json` from the manual transcriptions + rectangles. The transcriptions are
hand-curated JSON and are the source of truth above the derived output.

## 11. Files

| File | What it is |
|---|---|
| `index-transcriptions.json` | Manual transcription of the alphabetical-index pages (the full records) |
| `script-transcriptions.json` | Manual transcription of the inscription/engraving pages |
| `row-bounds.json` | Measured rotated rectangles, page → seq |
| `build-evidence.mjs` | Assembler: transcriptions + rectangles → derived fields, relationships, inference, disagreement |
| `burials-evidence.json` | **The evidence store** the Eventities / annotation transform consumes |
| `measure-bounds.ps1` | Pixel-level box measurement from source photographs |
