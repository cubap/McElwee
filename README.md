# McElwee Cemetery
A read-only linked-data exhibit of the catalog of the McElwee cemetery in Pike County, MO.
The ground sits just off Route K outside Louisiana, Missouri: [USGS GNIS feature 722098](https://gnis-ld.org/lod/gnis/feature/722098). Note that the plot and parcel outlines circulating with this cemetery come from modern county assessor records, not the historical catalog, so they show who holds the land now and not where any grave lies.

> Watch it develop online: [https://cubap.github.io/McElwee/web](https://cubap.github.io/McElwee/web)

## What this repository is

Two things live here, and only one of them is published.

| | Where | Deployed? | Can write to RERUM? |
|---|---|---|---|
| The exhibit | `web/` | yes, GitHub Pages | no |
| Data entry | `entry/` | never | yes, carrying a minted token to TinyNode |
| Token mint | `server/` | never | holds the credential, hands out short-lived tokens |

The published site is static files that query RERUM over HTTPS and render whatever the
store currently holds. `web/mcdata.js` is the bundled fallback for when the store is
unreachable. There is no server behind GitHub Pages, so there is nothing there that could
accept a write.

```
web/         published exhibit (index.html, app.js, config.js, mcdata.js, mc.css, manifest/)
entry/       local-only data-entry subsite, served at /entry/ by the dev server
server/      Express app: static hosting + the loopback-only token mint
scripts/     build, preview, whoami, the batch loaders, and their shared write client
test/        node --test suites, including the guards that keep the site read-only
dist/        build output, what gets deployed to Pages (gitignored)
```

`web/config.js` is the only file in the front end that names a RERUM instance. Everything
else reads `window.McElweeConfig`.

### Reads and writes do not go to the same place

| | endpoint | why |
|---|---|---|
| reads | `https://store.rerum.io/v1/api/query` | no credential needed, and the store's CORS allows any origin, which is what lets the published exhibit work with no server at all |
| writes | `https://tiny.rerum.io/create` &c. with `Authorization: Bearer …` | TinyNode's [passthrough mode](https://github.com/CenterForDigitalHumanities/TinyNode/pull/134) forwards the header verbatim, so the store stamps `__rerum.generatedBy` with *this project's* agent rather than the instance's |

Two things that are easy to get wrong. `store.rerum.io` is the RERUM API and the
authorization portal; it runs no TinyNode, so there is nothing there to pass a token
through. And TinyNode's `/query` does **not** honour passthrough - it always uses the
instance's own credential - so reads must never be routed through it.

## How the exhibit is designed

The exhibit is built as a **herbarium / museum specimen sheet**, and the design system is
recorded in [DESIGN.md](DESIGN.md). The short version: a person is a specimen, the catalog is
the collector's determination, and every value on the page is printed as a *claim* with an
accession trail rather than as a fact.

Three rules hold the whole thing together and should survive any future restyle:

- **Green is evidence, rust is disagreement.** Neither is decorative. A line the records
  disagree about carries a seam mark; pressing it splays the competing values and opens the
  provenance of each one.
- **A contested line leads with the value asserted most often**, newest wins a tie, and the
  exhibit says so out loud. Newest-first was tried and it put a vandalized test value on a
  one-year-old's grave, because the most recent assertions in this catalog are practice
  keystrokes.
- **Nothing is deleted and nothing is invented.** Keys outside the catalog's vocabulary are
  reproduced on a labelled slip behind the label. Photographs of markers are *linked and
  attributed*, never copied, because the exhibit does not hold the rights to them.

The plot and parcel outlines associated with this cemetery come from **modern county assessor
records, not the historical catalog**, so no map on this site shows where any grave lies. The
copy says so. The locality's one externally-backed identification is USGS GNIS feature 722098.

## The atlas

The exhibit also mounts the **1899 *Standard Atlas of Pike County*** as a third artifact: the
plates are SHSMO's scans, read live from their IIIF endpoint, never copied into the
repository. A plate rail, a family browse index (surnames grouped from the burial index), and
a pannable/zoomable viewer with SHSMO's name and a link back to the digitized collection
beside every plate. Where a family's property is recorded, it is the association *under
research*, not a holding, and the two-accent rule still holds: green marks a verified link,
rust marks an unconfirmed note. The source of truth is `source/atlas/plates.json`, published
to `web/data/atlas.json` by the build.

## Running it

Requires Node 22 or newer.

```
npm install
cp sample.env .env      # then fill in the RERUM section, see "Registering with RERUM"
npm start
```

- exhibit &nbsp;&nbsp; http://localhost:3030/web/
- data entry &nbsp; http://localhost:3030/entry/
- token mint &nbsp; `POST /token` (loopback only), plus `GET /agent` and `GET /status`

Other commands:

| command | what it does |
|---|---|
| `npm test` | unit and mint tests, plus the read-only and mixed-content guards |
| `npm run build` | assembles `dist/`; exits non-zero if an edit control or an insecure RERUM URL would be published |
| `npm run preview` | serves `dist/` on port 4000 (or `$PORT`) so you see exactly what Pages will show |
| `npm run whoami` | decodes `.env` and prints which RERUM agent writes would be attributed to |

The refresh token never leaves `server/`. `entry/` and the batch loaders ask the mint for a
short-lived access token over loopback and carry *that* to TinyNode themselves, so nothing
that reaches a browser or a loader process can hold the long-lived credential. The mint is
POST-only, loopback-only, and sends no CORS headers, which together mean a page on another
origin cannot read it and a token cannot land in a URL-keyed log.

## Registering with RERUM

Every record RERUM stores carries `__rerum.generatedBy`, and the store fills that field in
from the agent behind the bearer token that wrote the record. It is not a value this app
sets, and it cannot be edited afterwards.

The 2018 records in this exhibit were written with the credentials from the shared
TinyThings template, so all of them are attributed to the sandbox agent
(`sandbox@rerum.io`, `5afeebf3e4b0b0d588705d90`). That is the thing being fixed here: data
about McElwee should be generated by an agent that is *this app*.

Before any writing resumes:

1. Register an application with RERUM and give it a McElwee-specific name and description.
2. Put the issued `ACCESS_TOKEN` and `REFRESH_TOKEN` in `.env`.
3. Set `EXPECTED_AGENT_IRI` to the agent IRI you were issued.
4. Run `npm run whoami`. It must print your agent and exit clean.

If those steps have not been done, the mint refuses to produce a token rather than falling
back to the sandbox: `POST /token` answers 401 with no credentials and 403 with sandbox ones
or an agent that is not `EXPECTED_AGENT_IRI`, and `entry/` disables its save button and says
why. An unattributed record is worse than no record, because the generator cannot be
corrected later.

`RERUM_FETCH_TIMEOUT_MS` bounds the one upstream call the server still makes itself, the
token refresh; a hung store returns 504 and an unreachable one returns 502 instead of
holding the request open.

## Deploying

`.github/workflows/ci.yml` runs the tests, builds `dist/`, and deploys it to Pages.
The build keeps the site at `dist/web/` so the existing
`https://cubap.github.io/McElwee/web/` URL is unchanged, and puts a redirect at the root.

Pages must be set to **Build and deployment: GitHub Actions** (the "workflow" source) for
the deploy job to take effect; while it is still on the legacy "deploy from a branch"
setting the workflow tests and builds but the branch contents are what get served.

Run the workflow manually (`gh workflow run CI`) to redeploy without waiting for a merge.

## Who is to blame?
The developers at the Walter J. Ong, <sub><sup>S.J.</sup></sub> Center for Digital Humanities authored and maintain this template
in connection with the RERUM service.
Neither specific warranty or rights are associated with RERUM; registering and contributing implies only those rights 
each object asserts about itself. We welcome sister instances of RERUM, ports to other languages, package managers, builds, etc.

## Contribution notes
- No placeholder text ships. Anything a visitor can see must be final copy; scaffolding notes
  ("some such", "this should be invisible", lorem ipsum) belong in code comments, never in rendered output.
  Data-fallback strings for genuinely missing values (e.g. `[ unknown ]`) are the only exception.

## Issue #18: why the Java app is gone

This repository used to contain two things that had drifted apart: a 2018 NetBeans servlet
project (`Source Packages/io/rerum/**`, 17 JARs in `lib/`, `/create`, `/update`, `/delete`
mappings in `web/WEB-INF/web.xml`) and the static front end in `web/`. The servlet project
was a copy of the TinyThings template. It was never deployed anywhere, its build file was
gitignored, and its only observable effect was that the front end pointed at
`http://tinydev.rerum.io` and `http://devstore.rerum.io` to reach a proxy that did not
exist for anyone visiting the Pages site.

It is deleted. In its place:

- **`server/`** is a small Node app configured by `.env` instead of `tiny.properties`. It was
  never a copy of [TinyNode](https://github.com/CenterForDigitalHumanities/TinyNode) - it was
  original code written in TinyNode's shape, because publishing a proxy that speaks the same
  API is what let `web/` keep working after the servlet went away. It no longer reimplements
  those endpoints at all. It hosts the two subsites and mints short-lived access tokens on
  loopback, and it is the only thing that holds a credential.
- **`entry/`** is local-only data entry. The person form, the `+` button, and the
  create/update handlers moved out of `web/` here, and the build refuses to publish it. It
  writes by carrying a minted token to TinyNode itself.
- **`web/`** is read-only, and stays that way when deployed, because a GitHub Pages site has
  no server to ask for a token.
- **`web/config.js`** replaced the four hard-coded `http://` constants, and `normalizeId()`
  upgrades the `http://` IRIs that RERUM embeds inside `itemListElement` entries, which is
  what actually caused the mixed-content failures rather than the constants alone.

### Effect on the other open issues

| issue | status after this change |
|---|---|
| #13 mixed content | **fixed.** No insecure RERUM URL survives in `web/` or `entry/`; `tinydev` and `devstore` both serve valid TLS, and `npm run build` fails if an `http://` RERUM URL is reintroduced. |
| #14 migrate to the production store | **done.** Records now live on `store.rerum.io`; `web/config.js` and `sample.env` point at production. |
| #15 rewrite the front end as components | **unchanged, and now smaller.** The edit UI is out of `app.js`, so the rewrite covers rendering only. The custom-element and localStorage approach is deliberately left alone here. |
| #17 JSON-LD context on seeded entities | **open.** `web/mcdata.js` still seeds `"@context": ""`. |
| #19 design pass | **done in this change.** See "How the exhibit is designed". |
| #6 Event interface | **partly done.** `template.event` existed in the renderer's dispatch but was never defined, so any Event record crashed the viewer. It renders now. |
| #8, #9 data quality | **fixed in code, still dirty in the store.** #9's `[object Object]` came from `expand()` stringifying a value object; the claims model cannot. #8 was the old servlet reading the request body as a single-byte charset, so U+2014 arrived as 0x14; every path since decodes UTF-8 (guarded by a test) and the reader repairs the damaged records already in the store. The test annotations themselves are records, not bugs, and stay visible. |
