# The burial index — transcription working papers

**These are working papers, not data. Nothing here is wired into the exhibit.**
The machine extraction is good enough to read against the original and speed up a human
transcription. It is not good enough to publish as genealogy.

---

## Provenance and permission

| | |
|---|---|
| **Source** | `https://public.fotki.com/iowaz/pike-co-missouri/mcelwee-cem-pike-co/burials-mcelwee-cem/` |
| **Photographer** | iowaz — <http://www.iowaz.info/> · `iowaz@swbell.net` |
| **Permission** | Educational use. The site explicitly encourages people to download and use the images. |
| **Credit** | <http://www.iowaz.info/> — carried in the exhibit colophon and in `web/manifest/fotki.json` |
| **The document itself** | Unattributed. A desk copy held at the Lay Center; no compiler, date, or repository is named inside it. |

The images are already mirrored in `web/manifest/fotki/` and published. This directory
holds the transcription attempt, not a second copy of the photographs.

---

## What the document actually is

Sixteen pages in three different formats, which is the single most important thing to
know before reading any number below:

| Section | Pages | Format | Machine extraction |
|---|---|---|---|
| **Alphabetical index** | `Alpha001`–`Alpha005` | Two columns: surname gutter, free-text entry | **Usable.** 121 rows, 69 with a surname (57%), 53 corroborated (44%) |
| **Given-name index** | `Index001`–`Index003` | Table keyed on given name | Poor — the column model is wrong, 3 of 87 rows surnamed |
| **Inscription transcriptions** | `Page002`–`Page007` | Centered blocks of headstone text, not a table | Poor — 22 of 122 rows surnamed |
| **Family narrative** | `Family001` | Prose | Captured as continuous text (37 lines), not forced into rows |

`Alpha000` is a cover page. Its stated range "March 1833 to March 1941" is **not
trustworthy** — the index contains births in 1805 and a death in 1999.

---

## The resolution ceiling, measured

The public album serves a maximum of **600 × 800 px** (`-vi`). I confirmed this by
probing every size suffix: `-me`, `-bi`, `-fu` all return 500×500 crops, and the
unsuffixed original returns 404.

On a letter-size page that is roughly **100 DPI**. Reliable typescript OCR needs about
300 DPI. Every limit below follows from that one fact, and no amount of processing
removes it.

---

## Method

Four stages, all reproducible from `tool/`:

```
segment.ps1  →  ocr.ps1  →  transcribe.mjs
```

**1. Row segmentation** (`tool/segment.cs`, run via `tool/segment.ps1`)

The critical step, and the one that took the longest to get right. These are
*photographs*, not flatbed scans: lighting falls off across the page, so a global
threshold classifies the shaded background as ink. The row-ink profile never dropped
below ~250 of 600 pixels — there was no gap to cut on, which is why every earlier
attempt was mediocre.

- **Sauvola adaptive local thresholding** (`T = m·(1 + k·(σ/R − 1))`, R=128, k=0.18,
  window radius 11), computed with integral images so it is O(1) per pixel. After this
  the profile is clean: gaps ~11, text bands 50–450.
- **Deskew** by a coarse-to-fine search maximising the sum-of-squares of the row ink
  profile. Real skew was found (`Page005` +2.7°, `Page003` +1.9°) but the aggregate
  effect on accuracy was roughly neutral. Kept because it is free and helps the worst pages.
- **Adaptive band gaps** — floor is `max(12, p10 × 2.2)` of the row profile. A fixed
  floor either drowns in speckle or eats short lines; a median-based floor overshoots
  dense pages because most rows *are* text.
- **`SplitTall`** recursively cuts fused bands at the shallowest trough near one line pitch.

Result: **466 single-line bands.** OCR'ing one band at a time is what makes the
two-column layout survive — the engine returns the gutter and the entry in correct
reading order instead of interleaving rows across the page.

**2. OCR** (`tool/ocr.ps1`) — Windows built-in WinRT OCR over the 466 bands, 3,124 words.

**3. Transcription** (`transcribe.mjs`)

- Band word-x is mapped back to **source-page pixels** using the scale and pad recorded
  in `bands.json`. Band widths vary per page (deskewing grows the canvas), so a fraction
  of band width is not a stable column test — this was a real bug that silently cost
  around a third of the surnames.
- The **column boundary is calibrated per page** as the widest gap in word x-positions
  in the left region. It drifts from 90 to 133 px across pages.
- Surnames are the only thing the index writes in full capitals, so the gutter is split
  on **capital density**, not position. A hard x-cut either swallows the given name
  (`"DOTY Glenn"`) or drops the surname.
- **Corroboration:** the entry text restates the surname
  (`CARR | H. S/O J. W. and E. C. CARR, born …`). Each row is checked against its own
  entry with Levenshtein distance plus a 4-character prefix match. Agreement is the
  `high` confidence grade — an independent check, not a guess.

**4. Preprocessing that did *not* help** (recorded so it is not retried):
deskew (neutral), 3× upscaling (raises word count, not accuracy), binarisation without
adaptive thresholding (actively harmful).

---

## Verification status — read this before using any of it

**59 of 330 rows (18%) are machine-corroborated. The other 271 are unverified.**

The failure mode is not random noise, it is *plausible-looking wrong data*:

| In the scan | Almost certainly | Why it matters |
|---|---|---|
| `born Jan. 19.1810` | `1870` | a year wrong by sixty |
| `diedNov. 105aged21y.` | `aged 10 y.` | an age invented out of a missing space |
| `Mionte D'O J. J. BLAND` | `Mionta D/O J. J. Bland` | relationship token corrupted |
| `Æ`, `ø`, `191K` | scan artefacts | characters not present in the original |

The load-bearing tokens of the whole document — `D/O`, `S/O`, `W/O`, the relationships
that make this genealogy rather than a list of names — arrive as `D/OJ.`, `S'OJ.`,
`WIO`, `DIOR`, `sto`.

### What this must be used for

A **worksheet**: read the scan, use the machine text as a starting guess, correct it
against the physical desk copy. `burials-worksheet.csv` carries `page`, `surname`,
`entry`, the extracted fields, and the confidence grade so a reviewer can triage.

### What it must not be used for

Direct import. Production records must be built from verified transcription of this
document and nothing else — the existing devstore records are 2018 test data and are to
be discarded, not merged.

---

## Proofreading the worksheet

`proof.html` is the review tool. It is a local-only utility: `npm run build` publishes
`web/` and nothing else, so this never reaches the site.

```powershell
npm run proof     # http://localhost:3031/source/burials-index/proof.html
```

Each worksheet line is shown as the **actual pixels of the scan**, cropped to that row's
`y0`–`y1` and magnified. Because a 600-pixel line at 3× is 1800 pixels wide — far wider
than any panel — the band is sliced into overlapping horizontal strips stacked
vertically, so you read one line as two or three strips top to bottom rather than
panning sideways. Zoom is 2×–6×; the strips always tile the full line width, so nothing
falls in a gap.

Keys: `Enter` verified · `F` flag · `X` not a record · `↑`/`↓` move · `←`/`→` page ·
`Esc` undo. Decisions autosave to `localStorage`, so a long session survives a reload.
**Export** writes `burials-verified.csv` and `.json` with a `status` column; those are
the files to bring back here.

Two shortcuts worth knowing:

- **Accept the corroborated** marks all 59 rows where the gutter surname also appears
  inside the entry text. That is real independent evidence, not a guess — but it is
  evidence, not proof, and the confirmation dialog says so.
- **Not yet decided** filter, once the above is accepted, leaves roughly 270 rows: the
  actual working set.

The 37 prose lines are included in the same pass. They cover the cover page and the
family narrative, including the date range `march 1833 to March 1947`, which is
**suspect** — the index itself contains births in 1805 and a death in 1999. Do not
publish that range until it has been read off the physical copy.

## Born / Died / Aged / Relationship are derived, not typed

You only transcribe the **entry**. The structured fields are computed from it by
`parse-fields.mjs`, live, as you type.

This is a deliberate choice, not a convenience. A hand-entered `died` can silently
disagree with the prose sitting beside it in the same row, and on an unattributed desk
copy that disagreement is exactly the error the next researcher repeats. Deriving means
the fields can always be regenerated from text a human actually read, and the entry
stays the single authoritative field.

The index writes almost every row to one formula, which is what makes deriving safe:

```
<given names> <REL/O> <parents>, born <place?> <date>, died <date> — aged 1 Y., 8 M. and 8 D.
```

In the proofreader, derived inputs are recessed and tagged `derived`. **Type in one and
it pins**: it becomes a normal field marked `edited ↺`, and re-parsing the entry will
never overwrite what you wrote. Click `edited ↺` to release it and re-derive. Export
carries a `fieldsEdited` column so the pin survives the round trip.

Two rules the parser will not break, both learned the hard way:

- **A keyword only sees its own span.** `born Warren Co. MO, died Apr. 19, 1919` used to
  hand the *death* date to the birth field, because a naive search finds the first date
  after the word "born" wherever it happens to be. That is a plausible-looking
  fabrication, and it is the reason this parser exists in tests before it existed in the
  tool. `test/burials-fields.test.js` guards it.
- **It does not repair damaged text.** `sto`, `WIO`, `DfO`, `191K`, `t907` are reported
  as *unparsed* and the row shows a warning, rather than being guessed into shape. On
  uncorrected OCR the yield is low **by design** — run it against text a human has fixed.

A middle initial is not a keyword either: in `Claud H. B. S/O …` and `Marion D. bom died
1939`, the `B.` and `D.` look exactly like `b.` and `d.`. An abbreviation only counts
when a month name or a digit follows it.

To re-derive over a whole file without the browser:

```powershell
node derive-fields.mjs                       # reads burials-worksheet.json
node derive-fields.mjs burials-verified.json # reads a proofreader export, honours its pins
```

It prints a census of what populated and what is still damaged, and writes
`burials-derived.csv`/`.json` (gitignored — they are regenerable). On the current
uncorrected worksheet: 96 died, 58 born, 41 relationship, 31 aged, 38 parents, and 176
rows that yield nothing at all because their entry is still raw OCR.

## Files

| File | What it is |
|---|---|
| `burials-worksheet.csv` | **The deliverable.** 330 rows + confidence grades, for human verification |
| `burials-worksheet.json` | Same, plus the 37 prose lines from the cover page and `Family001` |
| `proof.html` | Proofreading tool — magnified row crops, keyboard triage, autosave, export |
| `parse-fields.mjs` | Entry line → born / born place / died / died place / aged / relationship / parents |
| `derive-fields.mjs` | Batch re-derive over a worksheet or a proofreader export |
| `../test/burials-fields.test.js` | The contract the parser must not break (`npm test`) |
| `../scripts/proof.js` | Local static server for `proof.html` (`npm run proof`, port 3031) |
| `bands.json` | Row-band manifest: page, y-range, scale, pad |
| `ocr-rows.json` | OCR word boxes for the 466 bands (current, best) |
| `transcribe.mjs` | Bands → worksheet |
| `tool/segment.cs` | Sauvola thresholding, deskew, row segmentation |
| `tool/segment.ps1` | Driver: `segment.ps1 -MergeGap 1 -FloorMul 2.2` |
| `tool/ocr.ps1` | WinRT OCR over a directory of images |
| `ocr-wordboxes.json` | Superseded: full-page OCR word boxes, native resolution |
| `reconstruct.mjs` | Superseded: column-split reconstruction |
| `burials-draft.csv/.json` | Superseded: 483 rows from the column split. More rows, but the split is what produced the interleaving errors — kept for comparison, not for use |

Every worksheet row carries `y0`/`y1`, the band's vertical extent in **source-image
pixels**, so a row can always be traced back to the exact pixels it came from. That is
what `proof.html` crops against. `Family001` is landscape 800×600; all other pages are
600×800.

## To re-run

The pipeline expects local copies of the 16 pages at 600×800 in a `scans/` directory.

```powershell
tool\segment.ps1 -SrcDir scans -OutDir rows -Manifest bands.json -MergeGap 1 -FloorMul 2.2
tool\ocr.ps1 -Dir rows -OutFile ocr-rows.json
node transcribe.mjs bands.json ocr-rows.json
```

## Still needed

1. **Human transcription against the physical desk copy** — the only path to publishable data.
2. **A second column model for the `Index` and `Page` sections**, which are not the
   surname/entry table the current code assumes.
3. **Better source images.** If higher-resolution originals exist anywhere — the
   photographer's own archive, or a fresh 300 DPI scan of the desk copy — re-running
   this pipeline on them is the single highest-value change available.
