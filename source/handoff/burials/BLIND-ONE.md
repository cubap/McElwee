# Blind read: ONE sheet, 16 strips

Transcribe a single reading sheet from a degraded typescript burial index (McElwee Cemetery,
Pike County, MO). Use your own vision only — do not run OCR tools.

Image (read this absolute path):
`C:\Users\cubap\copilot-worktrees\McElwee\cubap-supreme-tribble\source\handoff\burials\sheets\BurialsAlpha001_s01.png`

The sheet is a vertical stack of horizontal strips. Each strip has a number in the LEFT GUTTER
(1 through 16) and shows one index row split into a LEFT column (surname) and a RIGHT column
(the detail line).

Write exactly 16 JSON Lines to:
`C:\Users\cubap\copilot-worktrees\McElwee\cubap-supreme-tribble\blind-deepseek-1.jsonl`

One line per gutter number, in order:

```json
{"kind":"record","page":"BurialsAlpha001","seq":1,"surname":"BLAND","entry":"<right column, verbatim>","confidence":"high"}
```

Rules:
- `seq` = the gutter number. Never renumber, never skip. 16 lines, seq 1..16.
- `surname` = LEFT column verbatim. It is often BLANK when the row repeats the family above —
  use `null` when blank; do NOT carry the name down.
- `entry` = RIGHT column verbatim.
- Type what is PRINTED, not what it should say. If it reads `188B`, write `188B`. Keep the
  spelling and dates exactly as shown. No ISO dates. No added fields (no born/died/aged).
- If a strip is truly unreadable: `entry: null`, `confidence: "low"`.
- `confidence` is one of high / medium / low. Expect to use `low` often; that is useful.

Just write the 16 lines and stop. Reply with one confirmation line.
