# Blind transcription task — 3 reading sheets

You are transcribing three "reading sheets" cut from a typescript burial index for the
McElwee Cemetery (Pike County, Missouri). Each sheet is a vertical stack of horizontal
strips. Every strip has a number printed in the **left gutter** and shows one row of the
index. The rows are already numbered for you.

## The images (read these absolute paths)

1. `C:\Users\cubap\copilot-worktrees\McElwee\cubap-supreme-tribble\source\handoff\burials\sheets\BurialsAlpha001_s01.png` — page `BurialsAlpha001`, gutter numbers 1–16
2. `C:\Users\cubap\copilot-worktrees\McElwee\cubap-supreme-tribble\source\handoff\burials\sheets\BurialsPage005_s01.png` — page `BurialsPage005`, gutter numbers 1–15
3. `C:\Users\cubap\copilot-worktrees\McElwee\cubap-supreme-tribble\source\handoff\burials\sheets\BurialsAlpha005_s01.png` — page `BurialsAlpha005`, gutter numbers 1–16

## What to produce

One JSON object per strip, as JSON Lines, written to:

`C:\Users\cubap\copilot-worktrees\McElwee\cubap-supreme-tribble\blind-deepseek.jsonl`

Each line:

```json
{"kind":"record","page":"BurialsAlpha001","seq":1,"surname":"BLAND","entry":"<the right-hand column, typed exactly>","confidence":"high"}
```

- `kind` is `"record"` for a normal row. If a strip is clearly prose (a paragraph, not a
  name+detail row), use `"text"` and put the whole thing in `entry`, `surname: null`.
- `seq` is the number in the left gutter. **Never renumber, never skip.** 47 strips total
  (16 + 15 + 16). Every one must produce exactly one line.
- `surname` is the LEFT column, typed verbatim. It is often blank (the typist leaves it
  empty when the row repeats the family above) — use `null` when blank, do NOT carry the
  name down from the row above.
- `entry` is the RIGHT column, typed verbatim.

## The one rule

Type what is PRINTED, not what it should say. This is a degraded ~100 DPI typescript. If it
says `188B`, type `188B`, not `1888`. If a name looks misspelled, type the misspelling.

- Do NOT add fields like `born`, `died`, `aged`, `relationship`, `parents`. Only `surname`
  and `entry`.
- Do NOT convert dates to ISO. Keep `Nov. 20. 1910` as written.
- If a wrapped line breaks mid-word with a hyphen, join with no space; otherwise join wrapped
  lines with a single space.
- `confidence` is one of `high` / `medium` / `low` — your honest read confidence. Expect to
  use `low` a lot. That is fine and useful.
- If a strip is truly unreadable, `entry: null` and `confidence: "low"`.

## Traps

- The left (surname) column sometimes holds the cataloguer's REMARKS instead of a surname
  (e.g. "3 Stones unable to read"). Transcribe the remark into `surname` as printed.
- Fold shadows, punch holes, and stray marks are not text.
- Type and handwriting are mixed on the same page.

Do not summarise or analyse. Just write the 47 lines to the file and stop.
