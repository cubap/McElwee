# Handoff: transcribe the McElwee Cemetery headstone catalog

**Your job is to read six images and write one JSON Lines file.** You are a careful
eye, not an editor. Someone else turns what you write into records; your only task is
to say what the page actually shows, and to say so in a format a machine can check.

If you cannot open image files, stop now and say so. Do not work from the examples in
this document.

---

## What these pages are

A bound, hand-typed catalog of headstones at the McElwee Cemetery, Pike County,
Missouri, filed alphabetically by surname. Each page is a two-column row list:

| column | x in the image | content |
|---|---|---|
| left | ~205–215 px | the surname, in capitals |
| right | ~440–460 px | the entry: given names, relationship, parents, dates, ages |

One row = one headstone. Entries wrap onto two or three visual lines, always indented
under the right column. There are roughly **95 rows** across the four record pages.
One trap: the cataloguer sometimes wrote a remark in the surname column, where a name
would otherwise be. A remark is a `note` line, not a record.

The photographs are about **200 DPI** and legible. This is a different, better document
than the 600×800 burial index the project is also working from — do not confuse them,
and do not try to reconcile the two. That is not this task.

## Read the appendix before anything else

`appendix.jpg` is a printed key of *common cemetery-book and tombstone abbreviations*
(`AE` = age, `B` = born, `Bur` = buried, `Ca` = circa, `AEF` = American Expeditionary
Forces, and so on). Read it first so that when you meet an abbreviation in a record you
recognise it as **deliberate**, not as a word you failed to read.

It is reference material. Do not transcribe it as records.

## The images

Use these paths verbatim in your output. `absolute_path` is for opening the file;
`image` is what you write into the JSON.

| page id | image (repo-relative) | size | what it is |
|---|---|---|---|
| `cover` | `web/manifest/cover.jpg` | 1686×2187 | Cover. Cemetery name and a date range. |
| `bland-givens` | `web/manifest/bland-givens.jpg` | 1716×2222 | Records, BLAND–GIVENS |
| `givens-houchins` | `web/manifest/givens-houchins.jpg` | 1740×2214 | Records, GIVENS–HOUCHINS |
| `mcelwee-rowley` | `web/manifest/mcelwee-rowley.jpg` | 1678×2189 | Records, McELWEE–ROWLEY |
| `rowley-wilsnack` | `web/manifest/rowley-wilsnack.jpg` | 1678×2188 | Records, ROWLEY–WILSNACK |
| `appendix` | `web/manifest/appendix.jpg` | 1683×2178 | Abbreviation key. Reference only. |

Absolute prefix: `C:/Users/cubap/copilot-worktrees/McElwee/cubap-supreme-tribble/`

Machine-readable inventory, including the surnames a previous machine read off each
page: `source/handoff/pages.json`.

---

## The one rule that matters

**Transcribe. Do not interpret.**

Copy what is printed. Do not fix it. The structured fields — born, died, aged,
relationship, parents — are **derived downstream from your `entry` text** by a parser
that is tested against exactly this document's formula. You are not asked to produce
them, and you must not: if you type a date into a separate field as well, the record
ends up with two answers for one fact and no way to tell which one somebody actually
read. That is how a transcription error becomes a permanent one.

This catalog is a *copy of a copy*, typed by someone in the 1940s from stones that were
already old. Its mistakes are evidence. `Feb, 6, 1882` with a comma instead of a period
is that typist's comma, and flattening it destroys the only trace of how the book was
actually written.

### Specifically, never

- convert a date to ISO or any other format — `Nov. 2, 1883` stays `Nov. 2, 1883`
- expand an abbreviation — `S/O`, `W/O`, `D/O`, `AE`, `Ca`, `co. D 118 Ill.` stay as printed
- correct a spelling, a capitalisation, or a name you think is wrong
- add, remove, or move punctuation, or normalise spacing inside a word
- supply a missing date, parent, or surname from your own knowledge of this family
- guess a character you cannot read — mark it illegible instead
- merge two rows, or split one row into two
- write anything about a stone you inferred but cannot see

If you find yourself thinking *"the real date is probably…"* — that thought is the thing
this document is designed to catch. Write what is printed and set `confidence` to `low`.

### Why you are not given a machine read of these pages

Optical character recognition has already been run over all six images, and the validator
compares your work against it. You will not be given that output, and you should not ask
for it. A transcription that was copied from a machine read is worth nothing here: the
machine misreads in a characteristic way, turning damaged type into *plausible* words, and
if you anchor on its guesses you will reproduce them confidently instead of seeing the
stone. Its only job is to catch rows that were skipped or invented. Read the image.

---

## Output format

One file, **JSON Lines**: one JSON object per line, no commas between lines, no
wrapping array, no markdown fences, no prose. Every line must parse on its own.

Write it to `source/handoff/catalog-output.jsonl`.

Three kinds of line.

### 1. A page header, once per record page, before its records

```
{"kind":"page","page":"bland-givens","image":"web/manifest/bland-givens.jpg","label":"BLAND - GIVENS","records":25}
```

`records` is how many record lines you are about to emit for that page. It is checked.

### 2. A record, one per row

```
{"kind":"record","page":"bland-givens","image":"web/manifest/bland-givens.jpg","seq":1,"surname":"BLAND","entry":"Claud H. B. S/O J. H. and J. J. BLAND, died Apr. 19, 1883, aged 1 Y., 8 M. and 8 D.","lines":[27],"confidence":"high","condition":null,"notes":null}
```

| field | required | meaning |
|---|---|---|
| `kind` | yes | `"record"` |
| `page` | yes | page id from the table above |
| `image` | yes | repo-relative path, exactly as in the table |
| `seq` | yes | the row's position on that page, counting from 1, top to bottom |
| `surname` | yes | left column, verbatim |
| `entry` | yes | right column, verbatim, wrapped lines joined (see below). `null` if the row is genuinely blank |
| `lines` | no | 1-based visual line numbers the row occupies, top to bottom |
| `confidence` | yes | `"high"` \| `"medium"` \| `"low"` — see the scale |
| `condition` | no | damage **the catalog itself states**, e.g. `"broken"`. Otherwise `null` |
| `notes` | no | anything you cannot classify, verbatim. Otherwise `null` |

### 3. A note, for anything on the page that is not a row

```
{"kind":"note","page":"rowley-wilsnack","image":"web/manifest/rowley-wilsnack.jpg","after_seq":17,"text":"3 Stones unable to read -"}
```

The cataloguer wrote such notes. Reproduce them; do not promote them into records.

### Joining a wrapped entry

Join continuation lines with a single space. **Exception:** if a line ends in a hyphen
mid-word, join with no space, because the typist broke the word, not the line.

`…died Nov. 11,1917 fa-` + `ther Jesse Wagoner…` → `…died Nov. 11,1917 father Jesse Wagoner…`

### The confidence scale

- `high` — every character is legible and you read it without hesitating
- `medium` — legible, but something is odd: a spelling, a date that contradicts the age, an abbreviation you are not sure of
- `low` — you are not certain of at least one character, or the row is damaged

`low` is not a failure. A confident wrong answer is. Use it freely.

### Marking what you cannot read

Use `[…]` in the `entry` where text is missing or unreadable, and set `unreadable` to
`true` on that record. Do not use `?`, do not guess a length, do not leave a blank space.

---

## Worked example, from the real pages

These are lines a machine read off `mcelwee-rowley.jpg`. Your transcription should agree
with them character-for-character, because the image is legible.

Row 1 of that page:

```
{"kind":"record","page":"mcelwee-rowley","image":"web/manifest/mcelwee-rowley.jpg","seq":1,"surname":"McELWEE","entry":"George E. McELWEE, died Nov. 2, 1883, Aged 27y, 4m and 4d.","lines":[27],"confidence":"high","condition":null,"notes":null}
```

Row 2 wraps across two visual lines — note `sept.` keeps the typist's lower case:

```
{"kind":"record","page":"mcelwee-rowley","image":"web/manifest/mcelwee-rowley.jpg","seq":2,"surname":"McELWEE","entry":"Henry S. S/O Dan and N. L. McELWEE, born sept. 8, 1837, died May 18, 1864","lines":[28,29],"confidence":"high","condition":null,"notes":null}
```

Row 26. The catalog itself records that the stone is broken. Copy that into `entry`
exactly as written — do not drop it, and do not move it into `notes` instead:

```
{"kind":"record","page":"mcelwee-rowley","image":"web/manifest/mcelwee-rowley.jpg","seq":26,"surname":"ROBERTS","entry":"Elliott R. WO Rebecca ROBERTS, born (broken), died May 2, 1874","lines":[52],"confidence":"medium","condition":"broken","notes":null}
```

A military line, with the unit left completely alone:

```
{"kind":"record","page":"mcelwee-rowley","image":"web/manifest/mcelwee-rowley.jpg","seq":7,"surname":"PERKINS","entry":"Albert PERKINS, co. D 118 Ill., In (Nodate) war","lines":[36],"confidence":"low","condition":null,"notes":"(Nodate) is printed as such; possibly a unit designation the typist could not resolve"}
```

And the cover, which is not a record:

```
{"kind":"note","page":"cover","image":"web/manifest/cover.jpg","after_seq":0,"text":"McElwee / Cemete-b> / March 1833 to March 1941 / sc-oo","unreadable":true,"notes":"The cemetery name and the closing date are both degraded. The date range reads 1941 here and 1947 on the burial index cover. Do not resolve this."}
```

---

## Before you finish, check

1. The `records` count on each page header equals the number of record lines you emitted for it.
2. `seq` runs 1, 2, 3… with no gaps and no repeats on every page.
3. Every `image` value appears in the table above, spelled identically.
4. Your total is near 95. If it is far off, you have mis-segmented the rows — go back to the column boundary, not to the text.
5. `pages.json` lists the surnames a previous machine read off each page. Compare yours. Where they differ, **the image wins** — but if you find a surname they have that you skipped, you missed a row.
6. Pick five records at random and re-read them off the image, character by character. Fix what you find.

Then stop. Do not add a summary, an apology, or observations about the data. If
something genuinely needs flagging, it belongs in a `note` line.

## What happens next

`node scripts/check-handoff.js source/handoff/catalog-output.jsonl` validates the file
against `pages.json` — schema, contiguity, declared counts, image paths, and the
surname column. Anything it rejects gets sent back to you. After it passes, the born /
died / aged / relationship / parents fields are derived from `entry` by
`source/burials-index/parse-fields.mjs`, and a human checks the result against the
physical copy.
