# Handoff: adjudicate our machine read of the burial index

This is the **second** brief for the same 16 pages. Use this one, not `HANDOFF.md`, if you
have been given `review-batch.jsonl`. (In the zip bundle this file arrives as `HANDOFF.md`
and the independent brief arrives beside it as `RULES.md`.)

The other brief asks for an independent transcription and deliberately hides our machine read.
This one does the opposite: you are given our read, strip by strip, and asked to confirm or
refute it against the image. It is much cheaper per page and it produces a tidy queue of
disagreements for a human. Its cost is anchoring, which is the whole subject below.

---

## What you have

- `sheets/` — 31 PNGs. Every row of the index has been cut out of the photograph, levelled,
  magnified 3x and stacked, with its number in the left gutter. These are the source of truth.
  The original photographs are deliberately not included; they are ~100 DPI and several pages
  sit up to 2.7° off level, which is what made the first machine read unusable.
- `review-batch.jsonl` — 367 strips plus 16 page headers. Each line gives you the `page`, the
  gutter `seq`, which `sheet` to open, what our machine read (`surname` / `entry`), and how
  confident the machine claimed to be (`our_confidence`).

`our_confidence` is a guess made by software that cannot see. Treat it as noise. It is wrong
often, and it is most wrong exactly where it says `high`.

---

## The one rule

**Read the strip before you look at our read.** Not after, not at the same time.

The failure mode of this task is not that you cannot read the sheets — they are far clearer
than the photographs. It is that you see `ROWLEY` in our column, glance at a strip that says
`ROWLSV`, and write `ROWLEY`, because that is a name and the other is not. You will have
corrected the ink using our guess, and we will never know, because the output will look like
a clean confirmation.

So: for each strip, form your own reading first, then compare. If you cannot tell whether you
were anchored, say so in `notes`.

---

## Output format

JSON Lines to `source/handoff/burials/burials-output.jsonl`. Same shape as the batch, with a
`verdict` added, and **your** text in `entry` — the field is what should be published, not
what the machine saw.

```json
{"kind":"page","page":"BurialsAlpha001","items":26}
{"kind":"record","page":"BurialsAlpha001","seq":18,"sheet":"BurialsAlpha001_s02.png","surname":"EDMONDS","entry":"Robert E. S/O O. J. AND M.E. EDMONDS, died Nov. 1876 aged 21y.","confidence":"high","verdict":"confirm","notes":null}
{"kind":"record","page":"BurialsAlpha005","seq":2,"sheet":"BurialsAlpha005_s01.png","surname":"ROWLEY","entry":"James R. S/O J. R. and M.A. J. ROWLEY. died Aug. 30.1863. aged 4y.3m","confidence":"medium","verdict":"correct","notes":"machine read had ROWtsv and 18d for 3m"}
{"kind":"record","page":"BurialsIndex002","seq":27,"sheet":"BurialsIndex002_s02.png","surname":null,"entry":null,"confidence":"low","verdict":"unreadable","notes":"strip is a fold shadow"}
```

### Verdicts

- **`confirm`** — you read the strip independently and got the same thing. `entry` is your
  reading, which happens to agree.
- **`correct`** — the strip says something different. `entry` is what the strip says. Put the
  machine's version in `notes`.
- **`unreadable`** — no amount of looking recovers this. `entry: null`.
- **`blank`** — the cell is genuinely empty in the document, and that is the answer. Use this
  for a blank left column rather than carrying a surname down from the row above.
- **`split`** — the strip contains two rows, or half of one. Transcribe what is in the strip,
  and describe the problem in `notes`.

### Everything else in `RULES.md` still applies

That is the independent brief, included so nothing has to be repeated here. Its rules are not
optional:

The numbering is ours — **never renumber, never skip, never merge strips**; 367 in, 367 out.
Type what is printed, not what it should say. No ISO dates. No `born` / `died` / `aged` /
`relationship` or any other field you inferred — only `surname` and `entry`. The left column
sometimes holds the cataloguer's remarks instead of a surname; transcribe the remark.
Hyphen-joined wraps take no space. Expect to return a great deal of `low`.

---

## Where to spend your care

`review-batch.jsonl` is sorted by page and gutter number, which is the right order to work in,
but not all strips are equally doubtful. If you are short on time, prioritise:

1. **`BurialsPage005`, `Page002`, `Page003`, `Page007`, `Alpha005`** — the skewed pages, where
   the first read is worst.
2. **`BurialsAlpha000` seq 3** — the cover's date range. Our reads disagree between
   `March 1833 to March 1941` and `march 1833 to March 1947`. The site cannot publish until
   someone says what is actually printed. Report exactly what you see with honest confidence;
   do not infer it from which years appear elsewhere in the index.
3. **`Family001`** — 34 prose blocks, no table, and the densest page set we have.
4. Anything where our read contains a string that is not a word (`ANmrLE`, `ROWtsv`, `sto` for
   `S/O`, `188B`, `1Bd`). Those are torn ink, and the sheet should resolve them.

---

## Before you finish

1. Every page header present, `items` matching the last gutter number on that page's sheets.
2. 367 lines out, one per strip, no duplicates, no gaps.
3. Every line carries a `verdict`, and `confirm` is not the default — if a page comes back
   100% `confirm`, you were anchored.
4. No inferred fields, no normalised dates, no invented rows.

Then run, if you have access to the repository:

```
npm run check:handoff -- burials
```

It rejects missing, duplicated, renumbered or wrong-kind strips, inferred fields and ISO
dates. Its warnings are the human's review queue, not failures.

---

## What happens next

Nothing you write is published directly. Your verdicts are diffed against our read; every
`correct`, `unreadable` and `split`, plus every disagreement the checker flags, goes to a
human with the sheet open beside it. A `confirm` from you and a `high` from us is still two
machines agreeing, not evidence — so the queue is weighted toward the strips where agreement
was cheap.

The people in this index are named on stones in a cemetery in Pike County, Missouri, some of
them unmarked. If you are unsure, be unsure out loud.
