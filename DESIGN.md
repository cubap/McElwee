---
name: McElwee Cemetery Exhibit
description: A herbarium mounting sheet for a linked-data catalog whose every value is a claim.
colors:
  board: "#dde2d9"
  board-deep: "#cbd2c6"
  sheet: "#f5f6f2"
  sheet-edge: "#e9ebe4"
  ink: "#161916"
  ink-soft: "#464d46"
  ink-faint: "#79817a"
  rule: "#b6bfb2"
  rule-fine: "#d2d8cd"
  evidence: "#1d5a3c"
  evidence-wash: "#dfe9e0"
  evidence-line: "#9dbca6"
  contested: "#9a3a1c"
  contested-wash: "#f0e2da"
  reversed: "#fff"
typography:
  display:
    fontFamily: '"Archivo Narrow", "Arial Narrow", "Liberation Sans Narrow", sans-serif'
    fontSize: "clamp(1.9rem, 5.5vw, 3.1rem)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.005em"
  headline:
    fontFamily: '"Source Serif 4", "Source Serif Pro", Georgia, "Liberation Serif", serif'
    fontSize: "clamp(1rem, 2.4vw, 1.2rem)"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0.01em"
  title:
    fontFamily: '"Source Serif 4", "Source Serif Pro", Georgia, "Liberation Serif", serif'
    fontSize: "1.06rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  body:
    fontFamily: '"Source Serif 4", "Source Serif Pro", Georgia, "Liberation Serif", serif'
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: '"Archivo Narrow", "Arial Narrow", "Liberation Sans Narrow", sans-serif'
    fontSize: "0.72rem"
    fontWeight: 600
    lineHeight: 1.55
    letterSpacing: "0.14em"
  mark:
    fontFamily: '"Archivo Narrow", "Arial Narrow", "Liberation Sans Narrow", sans-serif'
    fontSize: "0.64rem"
    fontWeight: 600
    lineHeight: 1.55
    letterSpacing: "0.1em"
  stamp:
    fontFamily: '"Courier Prime", "Courier New", monospace'
    fontSize: "0.78rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0.04em"
rounded:
  none: "0px"
spacing:
  pad: "clamp(1rem, 3vw, 2.25rem)"
  gutter: "clamp(0.75rem, 2vw, 1.5rem)"
  mount-grid: "2rem"
components:
  sheet:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "{spacing.pad}"
  determination:
    backgroundColor: "{colors.evidence-wash}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0.7rem 0.9rem"
  claim-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "0.55rem 0"
  claim-row-hover:
    backgroundColor: "{colors.sheet-edge}"
  claim-row-open:
    backgroundColor: "{colors.sheet-edge}"
  seam-mark:
    backgroundColor: "transparent"
    textColor: "{colors.contested}"
    typography: "{typography.mark}"
    rounded: "{rounded.none}"
    padding: "0.05rem 0.3rem"
  correction-slip:
    backgroundColor: "{colors.contested-wash}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0.5rem 0.75rem"
  trace-panel:
    backgroundColor: "{colors.sheet-edge}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.none}"
    padding: "0.8rem 0.75rem"
  index-card:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0.45rem 0.5rem"
  index-card-hover:
    backgroundColor: "{colors.sheet-edge}"
  index-card-selected:
    backgroundColor: "{colors.evidence-wash}"
    textColor: "{colors.ink}"
  divider-chip:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.mark}"
    rounded: "{rounded.none}"
    padding: "0.2rem 0.5rem"
  divider-chip-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.reversed}"
  mount-empty:
    backgroundColor: "transparent"
    textColor: "{colors.ink-faint}"
    typography: "{typography.mark}"
    rounded: "{rounded.none}"
    padding: "1rem"
    width: "min(100%, 26rem)"
    height: "11rem"
  flash-error:
    backgroundColor: "{colors.contested}"
    textColor: "{colors.reversed}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0.5rem 2.25rem"
  flash-success:
    backgroundColor: "{colors.evidence}"
    textColor: "{colors.reversed}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0.5rem 2.25rem"
  raw-toggle:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    typography: "{typography.mark}"
    rounded: "{rounded.none}"
    padding: "0.5rem 2.25rem"
---

# Design System: McElwee Cemetery Exhibit

## Overview

**Creative North Star: "The Mounted Sheet"**

The exhibit is a herbarium and museum mounting sheet, not a profile page. A specimen is fixed
to a cool grey-green board by four corners, carries a printed label with an accession number
and a determination line, and is filed in a drawer with an index. That institutional form was
chosen because it is the artifact that already knows how to handle this project's exact
situation: a hand-made catalog whose compiler is unrecorded, transcribed page by page into a
linked-data store. An institutional sheet does not claim to be the thing it describes. It
claims to be a record *about* it, made by someone, at a date, and it prints that trail. So
every value on the page is rendered as a claim with an accession behind it, and a claim is
either supported or marked.

The aesthetic consequence is restraint with one exception: the sheet is allowed to be
physically present. Generated paper fibre, a faint mounting grid on the board, four mounting
corners, and a pasted slip that casts a small offset shadow are the entire amount of
materiality permitted. Everything else is typography and rules. Colour is never used to
decorate, warm, or enliven; there are exactly two accents and each of them is a statement
about evidence, so an accent applied for any other reason is a defect, not a style choice.
The palette is deliberately cool — a grey-green board and off-white sheet under a single near-black
ink. It is emphatically not cream, not sepia, and not parchment, which is the visual register
of the genealogy-site default this exhibit positions itself against.

The reading order is also a design constraint. The primary audience is students, possibly as
young as secondary school, arriving cold with no context. The sheet must be legible before it
is navigable: the determination statement and the "How to read a sheet" note orient the
visitor before any control asks for a decision. Nothing in the visual system may trade
legibility for density or for atmosphere.

**Key Characteristics:**
- A cool grey-green mounting board, an off-white sheet, one ink; no cream, no sepia.
- Two accents with fixed meanings: green is evidence, rust is disagreement. Neither decorates.
- Three faces with fixed jobs: condensed institutional caps for labels, a reading serif for values, monospace for identifiers.
- Surfaces are square-edged and held by hairline rules, never by radius or by accent tabs.
- Absence is a drawn state — an empty dashed mounting space, never a placeholder or a stock image.
- Every claim line is a press target that opens the record asserting it.

## Colors

The palette is a mounting board, a sheet, one ink, and two accents whose meaning is the whole
point: green is evidence, rust is disagreement. There are no decorative colours and no brand
colour.

### Primary — evidence
- **Determination Green** (`{colors.evidence}`, #1d5a3c): the colour of support and authority. Links, the 2px top rule of the determination block, the selected drawer card's inset outline, the provenance panel's top rule, the "on the line" marker inside a splayed variant list, and the success flash. It is the only colour a visitor should learn to read as "this is backed by a record".
- **Evidence Wash** (`{colors.evidence-wash}`, #dfe9e0): the pale green field of the determination block and the selected index card. Always paired with Determination Green as its rule or outline; never used alone as tinting.
- **Evidence Line** (`{colors.evidence-line}`, #9dbca6): the green used *on ink* — the claim counts in the institution bar. Deep green fails against near-black, so this is the one step that carries green's meaning into the reversed band.

### Secondary — contested
- **Contested Rust** (`{colors.contested}`, #9a3a1c): the colour of disagreement, and of nothing else. The version-seam hairline under a denied value, the "N claims" mark, the full 1px border and offset shadow of the splayed variant list, the "last seen" flag, and the error flash. If a rust element does not mean "the records do not agree" or "this is where you stopped", it is wrong.
- **Contested Wash** (`{colors.contested-wash}`, #f0e2da): the field of the correction slip only.

### Neutral
- **Mounting Board** (`{colors.board}`, #dde2d9): the page ground — the board the sheet is mounted on.
- **Board Deep** (`{colors.board-deep}`, #cbd2c6): the board in shadow; the four mounting corners and the sheet's first contact shadow.
- **Specimen Sheet** (`{colors.sheet}`, #f5f6f2): the paper. Sits over generated fibre, so it is never a flat fill in practice.
- **Sheet Edge** (`{colors.sheet-edge}`, #e9ebe4): the tone a sheet takes when hovered, expanded, or inset — the system's entire "raised/pressed" vocabulary in one value.
- **Ink** (`{colors.ink}`, #161916): the institution bar, the raw-record viewer, pressed chips, and all body text. The dead are printed in ink and nothing else.
- **Ink Soft** (`{colors.ink-soft}`, #464d46): secondary prose, dates, values inside the stray slip.
- **Ink Faint** (`{colors.ink-faint}`, #79817a): field labels, kickers, stamps, captions, empty-state text.
- **Rule** (`{colors.rule}`, #b6bfb2): the working hairline — sheet border, claim-row separators, section rules, panel borders.
- **Rule Fine** (`{colors.rule-fine}`, #d2d8cd): the quietest separator, used for individual claim rows and the 1px gaps in the drawer list.
- **Reversed White** (`{colors.reversed}`, #fff): text on ink or on a full accent fill, and the print background. Nothing else.

### Named rules
**The Two Accents Rule.** Green means evidence. Rust means disagreement. Neither is
decorative, neither is a brand colour, and neither may be used for emphasis, hierarchy,
decoration, or "because this needs colour". This is the single most important constraint on
future work here: an accent in the wrong place is not a taste error, it is a false statement
about the record. The audit test is one sentence — *for every green or rust element on a
screen, name what it asserts; if you cannot name it, remove it.*

**The One Ink Rule.** People who are dead are printed in ink. No accent, tint, wash, or
highlight is ever applied to a name, a date of birth, or a date of death. The exhibit is not
a demo and the dead are not gamified.

**The Cool Board Rule.** The paper is cool. Off-white sheet on grey-green board. Cream,
parchment, beige, sepia, and warm greys are excluded — not because they are ugly, but because
they are the register of the genealogy-site default this exhibit exists to argue against, and
a warm paper would quietly undo the determination framing.

## Typography

**Display / Label Font:** Archivo Narrow (fallbacks: Arial Narrow, Liberation Sans Narrow, sans-serif)
**Body / Value Font:** Source Serif 4 (fallbacks: Source Serif Pro, Georgia, Liberation Serif, serif)
**Stamp Font:** Courier Prime (fallbacks: Courier New, monospace)

**Character:** A condensed institutional grotesk doing the bureaucratic talking, a proper
reading serif doing the human talking, and a typewriter face doing the filing. The contrast
that matters is not size but *register* — caps-set condensed sans is the institution speaking
about the specimen, serif is the specimen's own value, monospace is the archive's identifier.
All three load from Google Fonts with metric-compatible local fallbacks so the sheet degrades
without reflowing into nonsense.

The ramp is deliberately bimodal: one large display step, then a long shelf of very small
uppercase. There is no middle. Values sit at 1.06rem and everything that labels them sits
between 0.58rem and 0.78rem, which is what makes a sheet read as a sheet rather than as an
article.

### Hierarchy
- **Display** (Archivo Narrow 700, `clamp(1.9rem, 5.5vw, 3.1rem)`, line-height 1.02, uppercase, tracking −0.005em): the cemetery name and each specimen's heading. One per sheet.
- **Headline** (Source Serif 4 400, `clamp(1rem, 2.4vw, 1.2rem)`, tabular numerals, Ink Soft): the life span under a heading. Serif, because it is a value, not a label.
- **Title** (Source Serif 4 400, 1.06rem, Ink): a claim's value on the label — the most-read size in the system and the one a student must be able to parse without effort.
- **Body** (Source Serif 4 400, 17px, line-height 1.55): the determination statement, the reading notes, the colophon. Prose measure is capped near 62ch.
- **Label** (Archivo Narrow 600, 0.72rem, tracking 0.14em, uppercase, Ink Faint): field names on claim rows, drawer headings, kickers. The institutional voice.
- **Mark** (Archivo Narrow 600, 0.58–0.68rem, tracking 0.1em, uppercase): the smallest band — seam marks, "last seen", captions, the "on the line" tag, toggle and chip text.
- **Stamp** (Courier Prime 400, 0.78rem, tracking 0.04em, Ink Faint): accession numbers, provenance values, the raw record. Identifiers are typed, never set.

### Named rules
**The Three Jobs Rule.** Archivo Narrow labels, Source Serif 4 states values, Courier Prime
identifies. A type role never crosses: a field name is never serif, a person's name is never
monospace, an accession is never a serif small-cap. If a new screen needs a fourth role, it
needs a reason strong enough to break the register contrast the whole system runs on.

**The Student Floor Rule.** Values stay in the reading serif at 1.06rem or larger and body
prose stays at 17px/1.55. Uppercase and letterspacing are reserved for labels and marks; a
value is never set in caps, and nothing a student must read to understand the exhibit is set
below the Mark band. Density never wins an argument with a fifteen-year-old arriving by
accident.

## Layout

The page is a cabinet: a two-column grid of sheet plus drawer index (`minmax(0, 1fr)` and a
fixed `20rem` index, gap `{spacing.pad}`, max-width `84rem`, centred). The index is sticky at
`top: {spacing.pad}` so the drawer stays present while the sheet scrolls.

Two spacing tokens carry the entire rhythm and should be used instead of new values:
`{spacing.pad}` (`clamp(1rem, 3vw, 2.25rem)`) for the outer gutters and sheet padding, and
`{spacing.gutter}` (`clamp(0.75rem, 2vw, 1.5rem)`) for the gaps inside them. Both are fluid,
so density eases as the viewport narrows rather than being re-tuned at each breakpoint.

The board behind everything carries a faint mounting grid drawn with two 1px linear-gradients
at `2rem` intervals (`rgba(120, 134, 118, .10)`). It is deliberately below the threshold of
"pattern" — it should be felt as the surface the sheet was laid on.

Breakpoints are container-agnostic and expressed in `rem` (44 / 48 / 60 / 34rem):
- **≤ 60rem** — the cabinet collapses to one column and the drawer index is reordered *above* the sheet (`order: -1`), becoming a horizontal scroll-snap rail of `11rem` cards. The index stops being sticky.
- **≤ 48rem** — the locality inset's two notes stack.
- **≤ 34rem** — claim rows drop their 9.5rem label column and wrap the label onto its own line; the provenance definition list stacks; variant splays go single-column.

The first viewport is the sheet itself: locality, accession counts, the determination
statement, and the drawer index beside it. There is no hero image and no search field, and
nothing added later should displace that.

### Named rules
**The Orientation Before Navigation Rule.** On every viewport, including the narrowest where
the drawer jumps the queue, the visitor reads what the exhibit is before being asked to choose
anything. The index may move, but it may not precede the determination statement's
equivalent.

## Elevation & Depth

The system is flat-by-default and conveys depth with tonal steps and hairline rules, not with
shadow. There is exactly one structural shadow — the sheet lying on the board — and one
material shadow, the correction slip's offset. Everything else that looks raised is actually
just a darker tone of the same paper (`{colors.sheet-edge}`).

### Shadow Vocabulary
- **Sheet contact** (`box-shadow: 0 1px 0 {colors.board-deep}, 0 10px 24px -18px rgba(20, 26, 20, .55), inset 0 0 46px -22px rgba(74, 66, 46, .22)`): the only elevation in the system. A hard contact line at the top edge, a tight low-opacity drop, and a warm inset vignette that ages the paper's edges. Reserved for `.mc-sheet`; nothing else gets to be a physical object.
- **Slip offset** (`box-shadow: 2px 2px 0 rgba(154, 58, 28, .12)`): a flat, unblurred offset in the contested hue, reading as a slip of paper pasted onto the sheet. Only on the splayed variant list.
- **Tonal state** (`{colors.sheet-edge}` background, no shadow): hover, expanded, and inset surfaces.

### Motion
Motion is treated as material behaviour and is entirely gated behind
`prefers-reduced-motion: no-preference`.
- **The pin** (`mc-pin`, 220ms ease-out, opacity 0→1 with a 4px rise): the sheet, the provenance panel, and the variant splay animate in as if put down. Applied to those three surfaces only.
- **The seam** (`transition: background-size 160ms ease-out` on claim values): the rust hairline under a contested value is a repeating 6px×2px gradient, so it can grow.
- `scroll-behavior: smooth` on the root, inside the same media query.

### Named rules
**The Paper-Only Depth Rule.** Only the sheet casts a real shadow, and only a pasted slip
casts an offset one. A new panel communicates state with `{colors.sheet-edge}` and a 1px rule.
Blurred elevation on a claim row, chip, or trace panel would read as a lifted card, and a
lifted card is the idiom this world does not contain.

**The Generated Paper Rule.** The sheet's texture is two inline SVG `feTurbulence` layers — a
fine fibre (`baseFrequency .9`, 4 octaves, 140px tile, opacity .05) and a slow mottle
(`baseFrequency .006`, 3 octaves, seed 7, 620px tile, opacity .055), both desaturated through
`feColorMatrix`. Both are neutral and sit far enough under the ink that contrast is unaffected.
Do not replace them with a flat fill, and do not swap them for a downloaded paper JPG or any
other bitmap: the texture is generated so it stays free, stays crisp at every zoom, and stays
out of the repository's rights ledger.

## Shapes

The form language is square and ruled. `border-radius` appears exactly once in the entire
stylesheet — a 1px radius on the seam mark — and is otherwise absent, so every surface, chip,
slip, panel, and button is a rectangle. Corner radius is not part of this world; a museum
label, a card in a drawer, and a typewritten accession all have square corners.

Edges are communicated by rules rather than by shapes:
- **1px `{colors.rule}`** — the working border: sheet edge, panels, chips, map frame, notes.
- **1px `{colors.rule-fine}`** — the quiet separator between individual claim rows, and the 1px gap colour of the drawer list.
- **2px `{colors.ink}`** — the strong rule under a heading (`.mc-rule`), the sheet's institutional underline.
- **2px `{colors.evidence}`** — the determination block's top rule.
- **3px `{colors.evidence}`** — the provenance panel's top rule, the heaviest accent rule in the system.
- **1px dashed `{colors.rule}`** — absence: the empty mounting space, and the top rule of the stray slip.

The sheet is held by **four pseudo-element mounting corners**: 1.6rem squares drawn with
2px `{colors.board-deep}` edges, inset 0.45rem, one per corner (`::before` top-left,
`::after` bottom-right), `pointer-events: none`. Two corners is not the motif; four is,
because four is what holds a specimen down.

## Components

### Claim row (`.mc-claim`)
The atom of the whole exhibit: one line of the label, and a press target.
- **Shape:** square, full width, `0.55rem 0` padding, separated by a 1px `{colors.rule-fine}` bottom rule; nested rows carry a 1px `{colors.rule}` left rule and 0.75rem indent.
- **Grid:** `9.5rem` label column, `minmax(0, 1fr)` value, `auto` for the trailing mark; baseline-aligned.
- **Typography:** label in Label (Ink Faint), value in Title (Ink), trailing mark in Stamp — `trace` when uncontested, a bordered `N claims` seam mark when contested.
- **Hover / Open:** background `{colors.sheet-edge}`; `aria-expanded="true"` holds that background and reveals the detail below.
- **Empty value:** rendered as italic Ink Faint copy — "asserted, but left blank" — never as a placeholder token.

### Version seam (`.mc-value--seamed`, `.mc-seam-mark`)
A contested value carries a 6px×2px repeating rust gradient at its baseline — a hairline seam,
not an underline — plus a 1px-bordered rust mark reading `N claims`. The seam is the only
rust that appears without a slip next to it.

### Correction slip (`.mc-variants`)
What a pressed contested line splays into: every competing value side by side, newest first,
each with its assertion count and date, and the displayed one tagged "on the line" in
Determination Green. Full 1px `{colors.contested}` border on `{colors.contested-wash}` with
the slip's 2px offset shadow. It presents the disagreement and stops; the copy states that the
exhibit does not decide between them.

### Provenance trace (`.mc-trace`)
Opens under any claim line. A 3px green top rule on `{colors.sheet-edge}`, a Label heading
("Provenance of this line"), and an 8.5rem/1fr definition list whose values are all Courier
Prime — field, asserted by, written by, written on, evidence, status. Ends with a caveat
paragraph ruled off in `{colors.rule}`. This is where green is allowed to be loudest, because
this is where the evidence is.

### Determination block (`.mc-determination`)
The sheet's honesty, set as a block: 2px green top rule, 1px `{colors.rule}` bottom rule,
`{colors.evidence-wash}` field, a small caps green "Determination" lead-in, and body serif
prose. One per sheet, always above the claims.

### Stray slip (`.mc-stray`)
Keys outside the catalog's own vocabulary are reproduced but demoted: a dashed 1px top rule,
a Label heading "Stray fields in the record", an explanatory note capped at 62ch, then the
same claim rows at reduced scale (0.68rem labels, 0.9rem values, Ink Soft instead of Ink). It
sits **below** the determination and below the label proper, never among the catalog rows.

### Specimen mount (`.mc-specimen`, `.mc-mount-empty`)
Depictions are **never rendered as `<img>`**. `LINKED_ONLY` means the exhibit shows an empty
mounting space — a 1px dashed `{colors.rule}` rectangle, `min(100%, 26rem)` wide, 11rem tall,
Label caps in Ink Faint — plus an attributed outbound link and the date the pointing record was
written. When nothing is asserted at all, the same shape says "No image mounted". Absence is a
legitimate state and is drawn, not papered over.

### Drawer index card (`.mc-index button`)
A 1.9rem/1fr grid: Courier Prime accession number, then the name in Archivo Narrow 0.92rem.
- **Default:** `{colors.sheet}`, separated by 1px `{colors.rule-fine}` gaps.
- **Hover:** `{colors.sheet-edge}`.
- **Selected** (`aria-current="true"`): `box-shadow: inset 0 0 0 1px {colors.evidence}` on `{colors.evidence-wash}`, with the accession turning bold green. Selection is an outline drawn *inside* the card, never a coloured edge tab.
- **Last seen:** a `::after` flag reading "last seen" in 0.58rem rust caps, driven by the `mc:lastSeen` localStorage key.

### Divider chip (`.mc-divider`)
0.68rem caps, 1px `{colors.rule}` border on `{colors.sheet}`, `0.2rem 0.5rem`. Pressed state
inverts to Ink with `#fff` text. Chips are the only interactive element in the system allowed
to invert.

### Institution bar (`.mc-institution`)
Full-bleed Ink band, 0.74rem caps at 0.16em tracking, baseline-wrapped. The current place is
`#fff` 700; the claim counts sit right-aligned in Evidence Line — green's meaning carried into
the reversed band by the one green step that survives on ink.

### Raw record (`.mc-raw-toggle`, `mc-obj-viewer`)
The data layer stays reachable but is explicitly a tool, not the exhibit: a full-width Ink
toggle in 0.7rem caps above a dark monospace panel (`#cfd8cf` on Ink, 20rem max height,
scrollable). It is hidden entirely in print.

### Flash message (`mc-flash-message`)
Full-bleed status band in 0.8rem caps: error on Contested Rust, success on Determination
Green, both with `#fff` text. The only place either accent fills a whole surface, and it is
earned — the meaning is identical to the accents' meaning everywhere else.

### Named rules
**The Press-Any-Line Rule.** Every claim row is a button that opens the record asserting it.
A value that cannot be traced must not be printed as a claim row.

**The Most-Asserted Rule.** A contested line leads with the value the records assert *most
often*; a tie goes to the more recent claim. This replaced newest-first ordering, which put
the vandalized practice keystrokes of a test entry on a dead infant's sheet heading. It is a
**stated convention, not a verdict**, and the page says so out loud in the slip's caveat.
Never silently re-order contested values by recency, and never resolve a disagreement by
dropping a variant.

**The Slip Rule.** Keys outside the catalog's vocabulary are reproduced — the exhibit does not
delete records it did not make — but they go on a labelled slip below the determination, never
as a claim row on the label proper.

**The Linked-Not-Mounted Rule.** Depictions are never rendered as `<img>`. The exhibit does not
hold the rights to the photographs its records point at, so it shows an empty mounting space
and an attributed outbound link. No future work may mount third-party imagery, fabricate
imagery, or fill an empty mount with a stand-in — including on a child's sheet, which is the
case that made the rule.

## Do's and Don'ts

### Do:
- **Do** keep the two accents' meanings intact: `{colors.evidence}` for anything backed by a record, `{colors.contested}` for anything the records disagree about. Name what a green or rust element asserts before you add it.
- **Do** build on the existing surfaces — `{colors.board}` ground, `{colors.sheet}` paper, `{colors.sheet-edge}` for hover/expanded/inset — and stay inside `{spacing.pad}` and `{spacing.gutter}` for gutters.
- **Do** set labels in Archivo Narrow uppercase with 0.1–0.16em tracking, values in Source Serif 4, identifiers in Courier Prime.
- **Do** express edges with rules: 1px `{colors.rule}` / `{colors.rule-fine}` for structure, a 2px or 3px green top rule for authority, a full 1px rust border plus offset shadow for a correction slip, a dashed rule for absence.
- **Do** mark a selected item with `box-shadow: inset 0 0 0 1px {colors.evidence}` on `{colors.evidence-wash}`.
- **Do** draw empty states as the mounting space (1px dashed `{colors.rule}`, Ink Faint caps) with final copy — "No image mounted", "No assertions returned", "asserted, but left blank". No placeholder text ships.
- **Do** keep the sheet's generated `feTurbulence` paper and its four mounting corners, and keep the body's 2rem mounting grid.
- **Do** preserve the deep-link and memory contract: `#specimen/<encoded IRI>` for a citable sheet, `mc:lastSeen` for the "last seen" flag.
- **Do** keep contrast at WCAG 2.1 AA and the layout usable at 375px, and keep every motion effect inside `prefers-reduced-motion: no-preference`.
- **Do** let the institution bar, the raw-record viewer, and the flash bands invert to Ink-on-`#fff`; those are the world's own reversed materials.

### Don't:
- **Don't** use a thick coloured `border-left` (or `border-right`) accent tab on a card, panel, or list item. This build removed that pattern deliberately. The replacements are the system's own: a 2px green `border-top` on the determination block, a full 1px rust rule plus offset shadow on the correction slip, and an `inset` box-shadow outline on the selected drawer card. (A 1px neutral `{colors.rule}` left edge on an indented claim row is *not* this pattern — nested rules are native to a label; a coloured slab pretending to be one is not.)
- **Don't** use cream, parchment, beige, sepia, or any warm paper. The board is cool grey-green.
- **Don't** use green or rust as decoration, hierarchy, or emphasis; don't tint a name, a birth date, or a death date with any accent.
- **Don't** render a `depiction` as `<img>`, link to an image file you do not hold rights to, or fill an empty mount with stock, generated, or "folksy" local-history photography.
- **Don't** round corners. The single 1px radius on the seam mark is the whole exception; nothing else in the system has one.
- **Don't** add blurred elevation to claim rows, chips, or trace panels — see the Paper-Only Depth Rule.
- **Don't** order a contested line by newest claim, and don't hide a variant to make a sheet look tidy.
- **Don't** promote a stray key into the catalog's claim list, and don't delete one either.
- **Don't** add a hero image, a search field, or any chrome above the sheet in the first viewport.
- **Don't** gamify, animate for delight, or apply a playful flourish to a burial record. The tone bar is respect.
- **Don't** ship placeholder text, and don't invent plot or parcel information — parcel outlines come from modern assessor records and the copy must keep saying so.
