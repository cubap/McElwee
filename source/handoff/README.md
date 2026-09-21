# Handoff bundles

Two documents describe the same graves, and neither of them is a gravestone. Each has its
own bundle: a brief for a vision-capable model, a machine inventory the validator checks
against, and our own machine read, withheld from the brief and kept as a diff target.

| | [`catalog/`](catalog/) | [`burials/`](burials/) |
|---|---|---|
| the document | the headstone catalog | the burial index |
| images | 6 pages in `web/manifest/`, ~1680×2190 | 16 pages in `web/manifest/fotki/`, 600×800 |
| effective resolution | ~200 DPI — legible | ~100 DPI — below the OCR floor |
| what the model reads | the photographs | **rendered reading sheets**, not the photographs |
| content | ~94 rows | 330 rows + 37 prose blocks |
| provenance | the six canvases of `web/manifest/mcelwee.json` | Fotki, credited to [iowaz.info](http://www.iowaz.info/); a desk copy at the Lay Center with no attribution inside it |
| rows found by | the reader | us, in advance — see `burials/rows.json` |

Same two-column layout, same typed sentence formula, so the parser in
`../burials-index/parse-fields.mjs` serves both. The catalog is the better source; the
index is the broader one. Where they disagree, the disagreement is the finding.

## The two contracts are different

The catalog pages are clean, so the reader is trusted to find its own rows and the checker
polices **honesty**: no invented rows, no skipped rows, no interpretation.

The burial pages are not clean. Cutting each row out of the photograph, levelling it and
magnifying it is what makes them readable at all, and that process produces a fixed,
numbered set of strips. So the reader is *not* trusted to find rows — the numbering is ours
— and the checker polices **coverage**: all 367 strips answered, exactly once each, with the
kind we said it was.

## Two ways to run the burial pass

| | `HANDOFF.md` — independent | `REVIEW.md` — adjudication |
|---|---|---|
| the reader sees | the sheets | the sheets **and** our machine read |
| asked for | a fresh transcription | a verdict per strip: `confirm` / `correct` / `unreadable` / `blank` / `split` |
| costs | more reading per page | much less, but risks anchoring |
| gives us | a genuinely second opinion | a queue of disagreements a human can work through |

`npm run handoff:zip` builds the adjudication bundle (`handoff-review.zip`); pass
`-Mode transcribe` for the independent one. Both write to the same output file and validate
with the same command — a verdict is an optional extra field, so an independent transcription
is not rejected for lacking one.

Use adjudication when the goal is throughput into a moderation queue. Use the independent
brief when you need a second witness.

## Files, in each bundle

| File | What it is |
|---|---|
| `HANDOFF.md` | The brief. Self-contained: it names the images, states the output format, and forbids interpretation. |
| `*-lines.json` | Every OCR line with its `x`/`y`, per page. Lets the checker test whether transcribed text exists on the page at all. |
| `machine-baseline.jsonl` | **Optical character recognition, not a transcription.** What a machine read, in the handoff format. A diff target only, deliberately not given to the independent reader. |
| `REVIEW.md`, `review-batch.jsonl` | Burials only. The alternate brief and the scaffold of 367 strips that carries our read into it. |
| `*-output.jsonl` | The model's transcription, when it arrives. Validated before anything downstream reads it. |

`catalog/pages.json` is the catalog's image inventory. `burials/rows.json` is the burial
index's row scaffold, and `burials/sheets/` (generated, not committed) holds the reading
sheets the brief refers to.

## Commands

```powershell
npm run handoff:rows            # rebuild the burial scaffold from the worksheet
npm run handoff:sheets          # render the reading sheets (needs .NET Add-Type)
npm run handoff:ocr             # OCR the sheets -> sheet-ocr.json
npm run handoff:lines           # sheet-ocr.json -> sheet-lines.json, the reference corpus
npm run handoff:baseline        # rebuild the burial machine baseline from the worksheet
npm run handoff:review          # build review-batch.jsonl and zip the adjudication bundle
npm run handoff:zip -- -Mode transcribe   # the independent bundle: sheets, no machine read
npm run handoff:zip -- -Doc catalog       # the catalog bundle
npm run check:handoff -- catalog [file.jsonl]
npm run check:handoff -- burials [file.jsonl]
```

`check:handoff` takes the document as its first argument and the file to validate as its
second. With no file it looks for the transcription where the brief tells the reader to save
it, so to check our own machine read instead, pass it explicitly:

```powershell
npm run check:handoff -- burials source/handoff/burials/machine-baseline.jsonl
```

The catalog's `machine-baseline.jsonl` came from the original segmentation run and has no
regeneration script; it is a frozen diff target, which is all it is for.

The checker enforces the things that do damage if they go wrong: skipped, duplicated or
renumbered rows, text that is not on the page, ISO dates smuggled into `entry`, inferred
fields like `born` or `relationship`, and image paths that do not match the inventory. It
deliberately does not judge wording.

## What this is for

Nothing here is published. `npm run build` copies `web/` only, so `source/` never ships.
A transcription becomes site data only after it passes the checker, is diffed against the
machine baseline, and is confirmed by a human against the physical desk copy at the Lay
Center. Born / died / aged / relationship / parents are never typed — they are derived
from `entry` so that every record has exactly one source of truth.
