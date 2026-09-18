# Handoff: transcribe the McElwee Cemetery burial index

> **Two passes are possible with these sheets.** This brief asks for an **independent**
> transcription and deliberately gives you no machine read to copy. If you were handed
> `review-batch.jsonl`, stop and read the **adjudication** brief instead — `REVIEW.md` here,
> which arrives as `HANDOFF.md` in that bundle and renames this file to `RULES.md`. Same
> sheets, same output file, different instructions.

You are transcribing a typescript index of burials. There are 16 pages, 367 numbered items,
and the photographs are bad enough that previous automated attempts produced unusable text.

You will be given **reading sheets**: each row of the index has been cut out of the
photograph, levelled, magnified and stacked with a number beside it. Your job is to type what
you see, row by row, in the order the numbers give you.

Save your output as JSON Lines to `source/handoff/burials/burials-output.jsonl` and stop. Do
not analyse, summarise, or improve what you transcribed.

---

## What these pages are

A single typescript document, photographed at low resolution, held at the Lay Center. It is a
desk-copy index of burials in the McElwee Cemetery, Pike County, Missouri. There is no
attribution inside it. It is an index **to** gravestones, not a transcription of them, which
is why the wording is formulaic: `S/O` (son of), `D/O` (daughter of), `W/O` (wife of).

The pages fall into three groups, and they are laid out differently:

| Group | Pages | Layout |
|---|---|---|
| Cover | `BurialsAlpha000` | 3 prose blocks, no table |
| Alphabetical | `BurialsAlpha001` … `BurialsAlpha005` | two columns: SURNAME, then ENTRY |
| Index / Page | `BurialsIndex001` … `003`, `BurialsPage002` … `007` | two columns, but the left column is not always a surname |
| Family | `Family001` | 34 prose blocks, no table |

We are not certain how the `Index`/`Page` pages are ordered. Do not assume it matches the
alphabetical pages. Transcribe each strip as it comes.

---

## Why you get sheets and not the photographs

Because the photographs defeat machine reading, and the reason is **skew**, not resolution.
Most pages sit straight, but several are rotated 1.4°–2.7° in the camera. At 2.7° a line of
type drifts about 28 pixels across the width of the page, so a horizontal slice through the
image cuts through two rows at once. Every previous attempt read a torn mixture of adjacent
lines and produced text that looks like a name but is not one.

We measured this. On `BurialsPage005`, the worst page:

- the raw photograph yields **49** readable lines to an OCR engine
- the levelled sheets from the same photograph yield **75**

and the difference is not volume, it is correctness. On `BurialsAlpha001` row 18, the raw
photograph gives:

```
RobertE. sto O.J.ANmrLE. EDMONDS,diedNov. J876#ed2ty.
```

The levelled sheet gives:

```
Robert E. S/O O. J. AND M.E. EDMONDS, died Nov. 1876 aged 21y.
```

That is the same ink. If a machine reading a levelled strip can make that jump, you should do
considerably better. But it also means **the sheets are the source of truth for this task** —
do not go looking for the original photographs, and do not try to reconcile the two.

---

## The numbering is ours. Never renumber.

`rows.json` in this directory is the authority. It lists every page, and on each page every
numbered strip, in top-to-bottom order, and tells you whether the strip is a table `row` or a
`prose` block. The sheets reproduce those numbers in the left gutter.

**You are not asked to find the rows. They are already found.** You are asked to say what is
written on each one.

This matters because the strips are cut from a machine segmentation that is occasionally
wrong. You will encounter:

- a strip containing **two** lines of type
- a strip containing **half** a line, or a sliver of the row above
- a strip containing **nothing at all**

When that happens, do not renumber, do not merge strips, do not split them, and do not skip
ahead to get back in step. Transcribe exactly what is inside the strip you were given, and
describe the problem in `notes`. A strip that comes back with `"notes": "two lines: row 12 and
the top of row 13"` is a useful result. A silently renumbered page is a disaster, because we
cannot see that it happened.

Every numbered strip must produce exactly one output line. 367 in, 367 out.

---

## The one rule that matters

**Type what is printed. Do not type what it should say.**

This is an index of the dead. A wrong name in this file will be copied into a genealogy by a
descendant who will never see the original, and they will believe it. A blank is honest and
fixable. A confident wrong answer is neither.

### Specifically, never

- **Never carry a name down from the row above.** Repeated surnames are common in a family
  cemetery, and the typist often left the column blank. Blank means blank.
- **Never complete a word.** If you can see `JENNIN_`, that is `JENNIN` plus something
  unreadable, not `JENNINGS` — even when the row above says JENNINGS.
- **Never fix the spelling.** `Wilsnack` is not a typo for `Wilsnak` or `Wilsnock`. Type the
  letters you see.
- **Never normalise a date.** `Nov. Io, 1831` stays `Nov. Io, 1831`. If you believe it is
  `Nov. 10, 1831`, write that in `notes` and leave `entry` as printed.
- **Never fill in an abbreviation.** `S/O` means son of. Still type `S/O`.
- **Never invent a row** because a page "should" have more entries than it does.

### Why you are not given a machine read

We have one, and it is bad. It is the thing you are being asked to replace. Machine reads of
this source do not fail by producing gibberish — they fail by producing *plausible* text:
`ROWtsv` for `ROWLEY`, `ANmrLE` for `AND M.E.`, `188B` for `1888`, `4y 3m 1Bd` for `4y 3m 18d`.
If we showed you those, you would correct them, and then we could no longer tell whether you
were reading the sheet or reading our guess. So we have not.

---

## Output format

JSON Lines: one JSON object per line, no wrapping array, no commentary between them.

### 1. A page header, once per page, before its items

```json
{"kind":"page","page":"BurialsPage005","items":15}
```

`page` must be the exact id from `rows.json`. `items` is how many numbered strips that page
has, which you can read off the last gutter number.

### 2. A record, for strips marked `row`

```json
{"kind":"record","page":"BurialsAlpha001","seq":18,"surname":"EDMONDS","entry":"Robert E. S/O O. J. AND M.E. EDMONDS, died Nov. 1876 aged 21y.","confidence":"high","notes":null}
```

- `seq` — the gutter number, exactly.
- `surname` — the left column, verbatim. Use `null` when the cell is genuinely blank.
- `entry` — the right column, verbatim. Use `null` when the whole strip is unreadable.
- `confidence` — see the scale below.
- `unreadable` — `true` only when you could not read any of it.
- `notes` — `null` normally.

### 3. A text block, for strips marked `prose`

```json
{"kind":"text","page":"BurialsAlpha000","seq":3,"entry":"March 1833 to March 1941","confidence":"medium","notes":"last digit obscured by a fold"}
```

Same fields, no `surname`.

### Joining a wrapped entry

Some entries wrap onto a second line inside the same strip. Join them with a single space.
**Except** when the first line ends mid-word with a hyphen: then join with no space, and drop
the hyphen. `JEN-N` + `NINGS` becomes `JENNINGS`. A hyphen that is part of the text — `well-known`,
`W/O J.R. ROWLEY-` — stays.

### The confidence scale

Use this honestly. It is the only thing that tells the reviewer where to spend their time.

- **high** — you could read every character, and you would swear to it in person.
- **medium** — you are confident of the name, uncertain of a digit, an abbreviation, or punctuation.
- **low** — you are guessing at the shape of a word, or the ink is broken. Use this often. It is not a failure.

On these pages, expect a great deal of `low`. A page that comes back 100% `high` has not been
read carefully.

### Marking what you cannot read

Prefer a partial transcription with `low` confidence. If a whole strip is illegible:

```json
{"kind":"record","page":"BurialsIndex002","seq":27,"surname":null,"entry":null,"confidence":"low","unreadable":true,"notes":"strip is blank; the row may be above or below it"}
```

Never leave a strip out.

---

## Traps we already know about

**The left column is not always a surname.** The cataloguer sometimes wrote remarks there
instead. We have proven examples from the companion catalog: `3 Stones unable to read -`
appears in a column labelled SURNAME. If the left column contains a sentence rather than a
name, transcribe the sentence. Do not move it to `entry` and do not tidy it.

**The two columns are not read together.** If you ever look at a whole page at once, note that
automated readers return the entire left column before the entire right column. Pairing must
be by vertical position, which is what the strips have already done for you. This is why you
should trust the strip boundaries over your own sense of where a row starts.

**Type and handwriting are mixed.** Most of this is typewritten, but some entries, corrections
and dates appear to be added by hand. Transcribe both the same way. Say in `notes` when a strip
is handwritten rather than typed.

**The date range on the cover is disputed.** `BurialsAlpha000` seq 3 gives the span the index
covers. Two separate machine attempts disagreed between `March 1833 to March 1941` and
`march 1833 to March 1947`. Our best current read of the levelled sheet says **1941**. Please
look at that strip and report exactly what you see with honest confidence. Do not infer it
from which years appear elsewhere in the index — that is a different question and it is not
evidence.

**Fold shadows and punch holes.** The card was three-hole-punched and has been folded. A
vertical band on the left of some strips is shadow, not text.

---

## Before you finish, check

1. Every page in `rows.json` has a header, and its `items` matches the last gutter number.
2. Every gutter number on every sheet produced exactly one line. 367 total.
3. No `born`, `died`, `aged`, `relationship`, or any other field you inferred. Only `surname`
   and `entry`.
4. No ISO dates anywhere. No `1831-11-10`.
5. Search your output for the words you expect to be common — `ROWLEY`, `JENNINGS`, `GIVENS`,
   `RHEA`, `EDMONDS`, `HOUCHINS`, `WILSNACK`. If a surname appears with two different
   spellings, look again at the strips that produced the odd one.
6. Count your `high` / `medium` / `low` split per page and report it.

We can run all of these automatically:

```
npm run check:handoff -- burials
```

It will reject a missing or renumbered strip, an inferred field, a normalised date, or text
that does not appear anywhere on the page. Fix everything it reports as an error. Its warnings
are your review list, not failures.

---

## What happens next

Nothing you write is published directly. Your transcription is diffed against ours, and every
disagreement goes to a human with the sheet open beside it. The point of this task is not to
produce a finished index; it is to produce a second, independent, honest read that is good
enough to make the human's job possible.

The people in this index are named on stones in a cemetery in Pike County, Missouri, some of
them unmarked. If you are unsure, be unsure out loud.
