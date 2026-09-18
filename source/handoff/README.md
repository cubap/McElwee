# Handoff: transcribing the headstone catalog

Two documents describe the same graves, and neither of them is a gravestone.

| | the burial index | **the headstone catalog** |
|---|---|---|
| images | 16 pages in `web/manifest/fotki/`, 600×800 | 6 pages in `web/manifest/`, ~1680×2190 |
| effective resolution | ~100 DPI — below the OCR floor | ~200 DPI — legible |
| content | ~330 rows + 37 prose entries | ~94 rows |
| provenance | Fotki, credited to [iowaz.info](http://www.iowaz.info/) | the six canvases of `web/manifest/mcelwee.json` |
| state | human proofreading in `source/burials-index/` | transcribed here |

Same two-column layout, same typed sentence formula, so the parser in
`../burials-index/parse-fields.mjs` serves both. The catalog is the better source; the
index is the broader one. Where they disagree, the disagreement is the finding.

## Files

| File | What it is |
|---|---|
| `HANDOFF.md` | The brief handed to a vision-capable model. Self-contained: it names the images by path, states the output format, and forbids interpretation. |
| `pages.json` | Machine inventory of the six images — paths, sizes, DPI, role, and the surname column as read. The validator's reference. |
| `catalog-lines.json` | Every OCR line with its `x`/`y` in image pixels, per page. Kept so the validator can test whether transcribed text exists on the page at all. |
| `machine-baseline.jsonl` | **Optical character recognition, not a transcription.** The rows a machine read, in the handoff format. A starting point and a diff target only. |
| `catalog-output.jsonl` | The model's transcription, when it arrives. Validated before anything downstream reads it. |

## Reading order

```powershell
npm run check:handoff                          # validates source/handoff/catalog-output.jsonl
npm run check:handoff -- source/handoff/machine-baseline.jsonl
```

The checker enforces the things that do damage if they go wrong: skipped or duplicated
rows, text that is not on the page, ISO dates smuggled into `entry`, and image paths that
do not match the inventory. It deliberately does not judge wording.

## What this is for

Nothing here is published. `npm run build` copies `web/` only, so `source/` never ships.
A transcription becomes site data only after it passes the checker, is diffed against the
machine baseline, and is confirmed by a human against the physical desk copy at the Lay
Center. Born / died / aged / relationship / parents are never typed — they are derived
from `entry` so that every record has exactly one source of truth.
