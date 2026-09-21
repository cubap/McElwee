# Loading the burial index into RERUM

Issue #19. The burial index has been transcribed into a machine-readable evidence store
(`source/burials-evidence/burials-evidence.json`, 117 records). This document is the plan for
turning those records into live RERUM objects, and the list of decisions that have to be made
by a person before any of it is written.

Everything below was checked against the running store and the actual files on 2025-09-18.
Nothing here is inferred from filenames.

---

## 1. Where the data actually lives

| Probe | Result |
|---|---|
| `HEAD https://devstore.rerum.io/v1/id/5b76fc0de4b09992fca21e68` (the 2018 headstone catalog) | **200** |
| `HEAD https://store.rerum.io/v1/id/5b76fc0de4b09992fca21e68` (same id, production) | **404** |
| Population list `5bc8089ce4b09992fca2222c` on devstore | `numberOfItems: 1`, but **5** `itemListElement` entries |
| `__rerum.generatedBy` on that list | `http://devstore.rerum.io/v1/id/5afeebf3e4b0b0d588705d90` — the shared TinyThings sandbox agent |

**The McElwee dataset has never been migrated.** It exists only on devstore. Production is
empty of it. This is issue #14, and it is the reason a burial load cannot simply target
`store.rerum.io`: the new people would be siblings of nothing, and every `evidence` link,
depiction, and manifest already in the exhibit points at devstore IRIs.

The list's `numberOfItems` is also wrong (1 vs 5). The loader recomputes it on write, which
silently repairs this — worth knowing, because it means the first run changes a field nobody
asked it to change.

## 2. Attribution is not a detail

RERUM stamps `__rerum.generatedBy` from the agent behind the bearer token. There is no way to
set it in the payload. All 2018 material — including the population list — is stamped with the
**shared sandbox agent**, i.e. `sandbox@rerum.io`.

So: whoever loads the burials decides whose name is on 236 permanent public records about dead
people. `server/agent.js` + `requireAgent({ write: true })` exist to refuse writes under the
sandbox agent when `REQUIRE_AGENT_IRI=true`. A bulk load should not bypass that guard.

There is currently **no `.env`** in this checkout (only `sample.env`), so nothing can write at
all today. That is the correct default state, not an oversight.

## 3. What the loader does

```
node scripts/load-burials.js                    # plan only, zero network calls
node scripts/load-burials.js --execute          # write
node scripts/load-burials.js --execute --limit 3
```

`scripts/burials-payloads.js` is a pure transform: evidence store → ordered operations.
`scripts/load-burials.js` is the only thing that touches the network, and it goes through the
local `server/` proxy so the access token never enters this process.

For 117 records it emits **236 operations**: 1 Document, 117 Persons, 117 Annotations, 1
list-append.

Three properties matter for a load that has to be safe to interrupt:

- **Placeholders, not guesses.** Operations reference each other as `@person:BurialsAlpha001_1`
  and `@burialIndex`. The loader substitutes real IRIs as it goes, so the transform needs no
  knowledge of the store and a partial run leaves no dangling references.
- **All persons before all annotations.** A family-head link (`fields.refId`) can point at a row
  *further down the page*. Interleaving the two kinds would write an annotation whose target did
  not exist yet.
- **`source/burials-evidence/load-ledger.json` is the idempotency record.** Local id → store IRI,
  written after every single create. Re-running skips what exists; killing the run halfway and
  restarting continues. It is the only place that mapping lives, so it is worth committing once
  the load has happened.

### Shapes

The payloads are the shapes `entry/entry.js` already writes, so a bulk load is indistinguishable
from careful manual entry and renders without touching `web/`:

- Person: `{ "@context": "http://schema.org", "@type": "Person", name, givenName, familyName }`
- Claim: `{ "@context": ".../anno.jsonld", "@type": "Annotation", motivation: "describing",
  target: <person IRI>, body: [ { <key>: { value, evidence, provenance } } ] }`
- Membership: GET the list, append `{ "@id", "@type": "Person", name }`, PUT `/update`

Two constraints come straight from the renderer (`web/app.js:128-235`) and must not be broken:

- **`target` stays a plain string IRI.** The exhibit compares `CFG.normalizeId(o.target)` against
  the person's canonical id. A real Web Annotation *specificSelector* object — which is where a
  rectangle properly belongs — would stop every annotation from rendering. This is why the
  rectangle rides in the body instead.
- **Unknown keys inside the claim object are ignored by the renderer.** So `provenance` is safe to
  add and carries the source photograph, the pixel rectangle, and (for family links) the head
  person's IRI.

The burial index is declared as its **own** `Document`, not the 2018 headstone catalog, because
it is a different source with a different provenance: an undated typescript desk copy at the Lay
Center with no attribution inside it, photographed for the exhibit. Page photographs are credited
to [iowaz.info](http://www.iowaz.info/), which permits educational use.

## 4. Known gaps in the evidence

These are all properties of the transcription, not of the loader.

| Gap | Count | Notes |
|---|---|---|
| Alpha rows not transcribed | **4 of 121** | `BurialsAlpha002` seq 26, `BurialsAlpha003` seq 25, `BurialsAlpha004` seq 27 and 28 — all at page bottoms, the rows the segmentation clipped |
| Records carrying engraving text | 66 of 117 | 30 engravings on the inscription pages matched no index row (`engravingUnmatched`) |
| Inferred birth years | 24 | death year minus stated age; an inference, not a reading |
| Index vs engraving disagreements | 2 | Mary L. CARR 1873/1872; Permelia J. CARR 1869/1862 |
| Relationship / parents | 62 | born text 64, died text 99, aged 39 |
| Year spans | deaths 1833–1999, births 1758–1921 | The index cover claims a narrower range; the index itself contains an 1805 birth and a 1999 death |

Two things the transcription did that a reader should know about:

- **Every surname is filled.** The printed index leaves the surname blank on dependents under a
  family head; the transcription carried it down. The loader compensates (names are not doubled,
  and the 13 head-row links are preserved as `familyGroup` claims), but the *published* person
  records will show a surname on rows where the document is silent.
- **The inscription-page row numbering does not line up** with `rows.json` for `BurialsPage002`
  and `BurialsPage003`. The 66 engraving matches were made on name+date agreement, not on
  sequence, so they are trustworthy; the 30 unmatched engravings may include rows that were
  actually transcribed under a different seq.

## 5. Recommended sequence

1. **Decide the store** (§1). Recommendation: **devstore first.** It is where the dataset is, it
   is reversible, and it keeps the exhibit working. Migrate everything to `store.rerum.io` as one
   deliberate issue-#14 move afterwards, rather than splitting the collection across two stores.
2. **Provision credentials.** `copy sample.env .env`, fill `ACCESS_TOKEN`, `REFRESH_TOKEN`,
   `EXPECTED_AGENT_IRI`, set `REQUIRE_AGENT_IRI=true`. Confirm with `npm run whoami` and
   `GET http://localhost:3030/agent`.
3. **Canary.** `npm start`, then `node scripts/load-burials.js --execute --limit 3 --list <IRI>`.
   Open the three people in the exhibit and read them against the physical desk copy. This is the
   only step that needs the drawer.
4. **Batch.** `node scripts/load-burials.js --execute --list <IRI>`. ~236 creates; the ledger
   makes it resumable.
5. **Reconcile.** Re-query the list, count people with a `description` claim, and diff the ledger
   against the store. Any record whose annotation was skipped for an unresolved placeholder is a
   bug to fix, not noise to ignore.

## 6. Decisions needed from a person

- **devstore or production** (§1). Everything else follows from this.
- **Which agent signs the records** (§2). A personal agent, or an explicitly registered
  McElwee project agent. Not the shared sandbox agent.
- **Publish now or hold.** These are model reads of a degraded typescript. The exhibit's
  `pick()` rule resolves conflicting claims by frequency, so a wrong reading is not automatically
  caught. The 117 records have not been checked against the physical document.
- **Whether the 4 clipped rows and the 30 unmatched engravings are fixed first**, or loaded as a
  known-incomplete batch and topped up later. Topping up is cheap — the ledger and the
  existing-set check in `list-append` make a second run additive.

## 7. Not in scope here

`web/manifest/fotki/burials/` is an untracked, byte-identical duplicate of 15 photographs
already committed in `web/manifest/fotki/`. Nothing references it. It was left in place rather
than deleted, since it is not mine to remove; it should be dropped before the next commit.
