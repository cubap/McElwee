# Burial index — transcription source and working draft

Everything in this directory is **input and work-in-progress**. Nothing here is exhibit copy and
nothing here has been published to a data store. Read the [verification status](#verification-status)
before using any of it.

## What this is

A typescript index of burials in McElwee Cemetery (Pike County, Missouri), photographed page by page
and posted in the Fotki album
[`iowaz/pike-co-missouri/mcelwee-cem-pike-co`](https://public.fotki.com/iowaz/pike-co-missouri/mcelwee-cem-pike-co/).

**Provenance of the document itself.** A physical copy is held as a desk reference at the Lay Center.
There is **no attribution anywhere on the document** — no compiler, no date of compilation, no
transcribing body. It can therefore be cited only by where it is kept, not by who made it. Any record
we publish that is sourced from it should say so in exactly those terms.

**Provenance of the photographs.** All images are credited to <http://www.iowaz.info/>, a genealogy
archive for Fayette County, Iowa and Pike County, Missouri. The site owner permits and encourages
downloading and reuse for educational purposes. The credit is carried in the exhibit colophon
(`web/index.html`, "Photographs"). No personal name is published on the site, so the credit names the
site, not a person — do not invent an author.

## The album, in full

The album holds 43 images. Only 16 are the burial index; the rest are maps we should not lose track of.

| Group | Files | What it is |
| --- | --- | --- |
| `BurialsAlpha000`–`005` | 6 | The alphabetical burial index. `000` is the cover. |
| `BurialsIndex001`–`003` | 3 | Index pages. |
| `BurialsPage002`–`007` | 6 | Plot / section pages. |
| `Family001` | 1 | Landscape orientation, 800×600. |
| `Map*` | 27 | County atlases 1875 / 1899 / 1916 / 1924 / 1930, topographic sheets 1931–1991 including air photos, Google imagery, and a 2000 plat. |

## Where the images already live

**All 43 album images are already mirrored in this repository** at `web/manifest/fotki/`, under
truncated `-vi` filenames (`eCoMoCemMcElweeBurialsAlpha001-vi.jpg` = `...BurialsAlpha001`). They are
copied verbatim into the published site by `npm run build`, so **they have been publicly served on
GitHub Pages since commit `f7d0142` ("mirrored images")**. Nothing was downloaded for this directory;
the mirror predates it.

Alongside them is a IIIF Presentation 2.x manifest, `web/manifest/fotki.json`: 17 canvases covering the
burials pages and the family sheet (not the maps), labelled only `cover`, `p1`…`p16`, with image `@id`s
hotlinked to `media.fotki.com` rather than to the local mirror. It previously carried
`attribution: "iowaz@swbell.net"` and `license: "private/educational/personal use only."` — an email
address where a credit should be, and a licence string stricter than the permission actually granted.
Both are corrected to credit <http://www.iowaz.info/>.

**No code in the exhibit references `manifest/fotki.json` or `manifest/fotki/`.** The manifest is
orphaned: the images are published, but nothing renders them or their attribution. That gap — not the
absence of a credit field — is what <https://github.com/cubap/McElwee/issues/26> is actually about.
The colophon credit in `web/index.html` covers readers; the manifest covers IIIF clients; neither is
wired into a viewer.

## Resolution is the hard limit

Fotki serves three sizes. Probed directly:

| Suffix | Result |
| --- | --- |
| `-th` | 200 — thumbnail, ~4 KB |
| `-vi` | 200 — **600 × 800**, ~143 KB |
| `-me`, `-bi`, `-fu` | 500 |
| (none) | 404 |

**600 × 800 is the largest size available publicly.** That is roughly 100 DPI on a letter-size page,
which is below the ~300 DPI normally considered the floor for reliable OCR of a typewritten record.
This is the root cause of every quality problem described below, and it is not fixable in software.

## How the draft was made

1. The album's RSS feed (`https://feeds.fotki.com/iowaz/album_sgrgfsktdkgkt.rss?p=1`) lists all 43
   items with titles and image URLs. The album page itself is JavaScript-rendered; the feed is not.
2. The 16 burials images were read from the existing mirror in `web/manifest/fotki/` (600 × 800 `-vi`).
3. `ocr-wordboxes.json` is the output of the Windows built-in OCR engine
   (`Windows.Media.Ocr.OcrEngine`, en-US) run over the scans at native resolution, with per-word
   bounding boxes. No external tool was installed.
4. `reconstruct.mjs` rebuilds the page structure and writes `burials-draft.csv` / `.json`.

Run it yourself:

```
node reconstruct.mjs ocr-wordboxes.json
```

The index is a two-column table: a sparse surname gutter on the left, one entry per line on the right.
Windows OCR reports no bounding box for a *line*, only for a *word*, so `reconstruct.mjs` derives line
geometry from its words, splits columns at x = 145 px, and attaches each entry to the surname whose
vertical band contains it. Continuation lines (a wrapped entry starting with a bare year or a lowercase
word) are folded into the entry above.

## Verification status — READ THIS

**This draft is a finding aid. It is not data, and it must not be loaded into a store or rendered in
the exhibit as it stands.**

Measured on 16 pages: 697 OCR lines → 483 entry rows, 48 distinct surnames, and **226 of 483 rows
(47%) with no surname attached**, because the surname gutter is only partially legible at this
resolution and OCR drops many of its entries.

The text itself is worse than the row count suggests. Representative corruption from a single page:

| Draft reads | Almost certainly | Why it matters |
| --- | --- | --- |
| `died San. 19. 1810` | `died Jan. 19. 1870` | a death year wrong by sixty years |
| `M&ion D. I died 1939` | name unrecoverable | the person is simply lost |
| `H. B.s.'0J_ H. andJ. J. died Dec. 2. 1883 . Y.. 8 M.` | unreadable | whole record unusable |
| `Rob:nE. S/OO.J.ÆNDM.E. EDMONDS. diedNov. 105aged21y.` | `Robt. E. S/O J. AND M. E. EDMONDS, died Nov. 10., aged 21 y.` | `Æ` is a scan artefact; `105` is `10.` |
| `barn 1866` / `bom Apr. 11. 1820` | `born` | harmless, but it is everywhere |

Relationship abbreviations (`D/O` daughter of, `S/O` son of, `W/O` wife of) come through as `D,'OJ.`,
`S.'0`, `ryo J,`. These are the load-bearing tokens in the whole document — they are what makes a
burial index a genealogical record rather than a list of names.

A misread name or date on a cemetery exhibit is not a cosmetic bug. It is a false statement about a
dead person, published in a project whose stated purpose is to treat them with respect. **The draft is
therefore kept here, clearly marked, and out of the site.**

### What the draft is genuinely good for

- **Search.** It finds surnames and dates well enough to tell you which page and line to look at.
- **Triage.** It shows where the dense, legible passages are and where a human has to start cold.
- **Speed.** Checking a correct name against a wrong one is far faster than typing it from a scan.

### What production data requires

Human transcription against the physical desk copy, or better scans. Two options, in order of preference:

1. **Re-scan at 300 DPI or better.** At 300 DPI a letter page is 2550 × 3300 — over 17× the pixels we
   are currently working from. This is the real fix.
2. **Transcribe by hand from the physical copy**, using this draft as a checklist. Slower, but the
   physical copy is the authoritative artefact anyway.

Either way, every published record needs a field recording **which page it came from**, so a claim can
be traced back to the document rather than to a model's guess.

## Known open questions

- The cover page reads `McElwee Cemetery / March 1833 to March 1941`. The date range is **not
  trustworthy** — the index plainly contains people born in 1805 and a death in 1999, so the range
  cannot describe the whole document. Do not publish it until checked against the physical copy.
- Whether the `BurialsIndex*` and `BurialsPage*` groups overlap `BurialsAlpha*` or add records to it.
- What the 27 `Map*` images should become. They are a substantial separate asset and are candidates
  for the exhibit's map section, all under the same iowaz.info credit.

## Relationship to the live data

The exhibit currently reads the 2018 RERUM catalog from `devstore.rerum.io`. That catalog contains
development test data and at least one unrelated image, and is not derived from this index. The plan
is for records built from this index to **replace** it rather than merge with it, so nothing from the
2018 store should be treated as corroboration of anything here.

Tracked in <https://github.com/cubap/McElwee/issues/26> (photograph licensing) and
<https://github.com/cubap/McElwee/issues/14> (store migration).
