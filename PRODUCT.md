# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Ranked by the maintainer, most important first:

1. **Students, possibly as young as secondary school.** They arrive with no context, are not
   looking for a specific ancestor, and need to understand what a cemetery record *is* and how
   we know anything about a person who died in the 1800s.
2. **General public and local-heritage visitors** from Pike County and the Louisiana, MO area.
3. **Descendants and genealogists** doing targeted research on Bland, Givens, Houchins,
   McElwee, Rowley, Wilsnack, Carr, Bevard, Brunaugh.
4. **Scholars and DH practitioners** evaluating the linked-data method itself.

The ordering matters: the exhibit is not a search box for researchers. It is a reading
experience that has to survive a fifteen-year-old arriving by accident.

## Product Purpose

Exhibit the catalog of the McElwee Cemetery in Pike County, Missouri as linked data, so that
every name, date, and marker on the page can be traced to the record that asserts it.

The cemetery's paper catalog was digitized page by page. Its own origin is unrecorded — who
wrote it, when, or from what. That absence is the reason the project exists: rather than
pretend the transcription is authoritative, the exhibit stores each claim as an annotation
pointing back at the source document, so uncertainty becomes visible instead of invisible.

Success is a visitor who can say what the site is and who can follow a displayed fact back to
the evidence behind it.

## Positioning

Every claim on the page carries its own provenance. A neighboring genealogy site can show the
same name and dates; it cannot show *which record asserted them, and what else that record
says*. The exhibit's mechanism is traceability, and its honesty about what is unverified is
part of the mechanism, not a disclaimer bolted on.

## Operating Context

- Published as static files on GitHub Pages at `https://cubap.github.io/McElwee/web/`.
  There is no server behind the public site.
- Records live in RERUM on `devstore.rerum.io`; the read-only site queries it directly over
  HTTPS (the endpoint returns `Access-Control-Allow-Origin: *`).
- Data entry happens only through a local Express proxy (`server/`) and a local-only subsite
  (`entry/`), never on the published site. Writes are refused until a McElwee-specific RERUM
  agent is registered, because `__rerum.generatedBy` is set from the token and cannot be
  corrected afterwards.
- `web/mcdata.js` seeds a bundled fallback copy of the records for when the store is
  unreachable.

## Capabilities and Constraints

**Capabilities**
- Read-only rendering of Person, ItemList, Document, Annotation and grave-marker records.
- Per-value provenance: annotations carry an `evidence` link to the catalog document.
- Depictions: `depiction` URLs point at images of headstones or supporting images.

**Constraints (durable)**
- No placeholder text ships. Anything a visitor can see must be final copy. Data-fallback
  strings for genuinely missing values (e.g. `[ unknown ]`) are the only exception. (README)
- The public surface cannot write, and must never look like it can.
- Third-party imagery: **no photographs are currently held in this repository.** Depiction
  URLs point at external hosts. Abundant photographs exist on genealogy forums and "folksy"
  local-history sites, and some people and places will have good visual coverage once their
  entities are resolved — but that material is not yet gathered, licensed, or attributed.
  The design must degrade gracefully to no image at all and must never invent imagery.
- **Plot maps are derived from modern county assessor / parcel resources, not from the
  historical catalog.** The current `index.html` copy says "the plot maps in the surviving
  catalog trace the families connected to it" — that claim is inaccurate and must be
  corrected wherever it appears.
- The store's data is dirty: test annotations (`bryanTest`, a `Claudia`/`Blandd` pair, an
  unrelated joke `depiction`), mojibake from an em-dash bug (#8), and `[ object ]` rendering
  of falsy values (#9). These are records in the store plus known front-end bugs, not
  mysteries.
- Legacy RERUM IRIs exist in both `http://` and `https://` spellings; annotations target the
  `http://` form. `web/config.js` `normalizeId()` / `idVariants()` are load-bearing.

**Undecided**
- Whether to publish a map at all, and from which parcel source, once #20/#21 research lands.
- Licensing and attribution model for external photographs.
- Issue #14 will move the records from devstore to the production store.

## Brand Commitments

- Name: **McElwee Cemetery**. No logo, wordmark, or palette is currently committed; the
  existing `mc.css` is an ad-hoc dark theme from the RERUM template, not an identity.
- Voice: plain, factual, quietly specific. The maintainer's stated bar is *respect* — this is
  a real burial ground with real people in it, and the tone must not be cute, gamified, or
  gimmicky.
- The exhibit must read as an exhibit, not a form (issue #19).

## Evidence on Hand

- Live RERUM records: the `Cemetery Population` ItemList
  (`5bc8089ce4b09992fca2222c`), the `McElwee Cemetery Catalog` Document
  (`5b76fc0de4b09992fca21e68`), and person records such as `5bc7f853e4b09992fca2220e`
  (35 annotations).
- Bundled seed content in `web/mcdata.js`: seven people, one grave marker, a birth and a
  death record, across four family names.
- Google Maps embed of the cemetery location in `index.html`.
- No photographs, no scans, no plot maps in the repository. **Future work must not fabricate
  any of these.**

## Product Principles

1. **Every displayed fact is traceable.** If a value cannot be linked to a record, it should
   look like an assertion, not a fact.
2. **Uncertainty is content.** The catalog's unrecorded origin is the exhibit's subject, not
   an embarrassment to hide.
3. **A student must be able to start cold.** Orientation before navigation; no jargon
   (`annotation`, `IRI`, `ItemList`) in visitor-facing copy.
4. **The dead are not a demo.** No gamification, no playful flourish applied to names and
   dates of burial.
5. **Absence is allowed.** An empty image slot or an unknown date is a legitimate state; it
   must not be papered over with placeholder content.

## Accessibility & Inclusion

No formal standard has been mandated. Working assumption, to be confirmed: WCAG 2.1 AA
contrast and full keyboard operability, and the layout must remain usable at 375 px wide
(issue #19 acceptance criterion). Young readers are part of the audience, so reading level
and unambiguous labelling matter more than density.
