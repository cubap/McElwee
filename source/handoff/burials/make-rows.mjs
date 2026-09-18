/**
 * Builds the row scaffold for the burial-index handoff.
 *
 * The index is 16 photographs of a typewritten card file. Machine OCR on them is poor,
 * so the handoff does not ask a model to find the rows -- it hands over the rows already
 * cut, numbered, and levelled, and asks only what each one says. This script assigns that
 * numbering: every row and every prose block on every page gets a seq, in vertical order,
 * which is also the seq the validator and the eventual diff against the worksheet use.
 *
 *   node source/handoff/burials/make-rows.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "../../..")

/** Short worksheet page id -> mirrored Fotki filename. Same map the proofreader uses. */
const IMAGES = {
  BurialsAlpha000: "eCoMoCemMcElweeBurialsAlpha000-vi.jpg",
  BurialsAlpha001: "eCoMoCemMcElweeBurialsAlpha001-vi.jpg",
  BurialsAlpha002: "eCoMoCemMcElweeBurialsAlpha3-vi.jpg",
  BurialsAlpha003: "eCoMoCemMcElweeBurialsAlpha003-vi.jpg",
  BurialsAlpha004: "eCoMoCemMcElweeBurialsAlpha004-vi.jpg",
  BurialsAlpha005: "eCoMoCemMcElweeBurialsAlpha005-vi.jpg",
  BurialsIndex001: "eCoMoCemMcElweeBurialsIndex001-vi.jpg",
  BurialsIndex002: "eCoMoCemMcElweeBurialsIndex002-vi.jpg",
  BurialsIndex003: "eCoMoCemMcElweeBurialsIndex003-vi.jpg",
  BurialsPage002: "keCoMoCemMcElweeBurialsPage002-vi.jpg",
  BurialsPage003: "keCoMoCemMcElweeBurialsPage003-vi.jpg",
  BurialsPage004: "keCoMoCemMcElweeBurialsPage004-vi.jpg",
  BurialsPage005: "keCoMoCemMcElweeBurialsPage005-vi.jpg",
  BurialsPage006: "keCoMoCemMcElweeBurialsPage006-vi.jpg",
  BurialsPage007: "keCoMoCemMcElweeBurialsPage007-vi.jpg",
  Family001: "PikeCoMoCemMcElweeFamily001-vi.jpg"
}

/** bands.json keys the full Fotki basename, so the skew has to be looked up through it. */
const SKEW_PAGES = {
  BurialsAlpha000: "PikeCoMoCemMcElweeBurialsAlpha000",
  BurialsAlpha001: "PikeCoMoCemMcElweeBurialsAlpha001",
  BurialsAlpha002: "PikeCoMoCemMcElweeBurialsAlpha002",
  BurialsAlpha003: "PikeCoMoCemMcElweeBurialsAlpha003",
  BurialsAlpha004: "PikeCoMoCemMcElweeBurialsAlpha004",
  BurialsAlpha005: "PikeCoMoCemMcElweeBurialsAlpha005",
  BurialsIndex001: "PikeCoMoCemMcElweeBurialsIndex001",
  BurialsIndex002: "PikeCoMoCemMcElweeBurialsIndex002",
  BurialsIndex003: "PikeCoMoCemMcElweeBurialsIndex003",
  BurialsPage002: "PikeCoMoCemMcElweeBurialsPage002",
  BurialsPage003: "PikeCoMoCemMcElweeBurialsPage003",
  BurialsPage004: "PikeCoMoCemMcElweeBurialsPage004",
  BurialsPage005: "PikeCoMoCemMcElweeBurialsPage005",
  BurialsPage006: "PikeCoMoCemMcElweeBurialsPage006",
  BurialsPage007: "PikeCoMoCemMcElweeBurialsPage007",
  Family001: "PikeCoMoCemMcElweeFamily001"
}

const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8").replace(/^\uFEFF/, ""))

const worksheet = readJson("source/burials-index/burials-worksheet.json")
const bands = readJson("source/burials-index/bands.json")
const ocr = readJson("source/burials-index/ocr-wordboxes.json")

const skew = new Map(bands.map((b) => [b.page, b.skew]))
const dims = new Map(ocr.map((p) => [p.page, { width: p.width, height: p.height }]))

const byPage = new Map()
for (const id of Object.keys(IMAGES)) byPage.set(id, [])

for (const r of worksheet.rows) {
  const list = byPage.get(r.page)
  if (!list) continue
  list.push({ kind: "row", y0: r.y0, y1: r.y1 })
}
for (const p of worksheet.prose) {
  const list = byPage.get(p.page)
  if (!list) continue
  // Prose blocks were captured as a single baseline, not a box; give them room to breathe.
  list.push({ kind: "prose", y0: p.y - 26, y1: p.y + 10 })
}

const pages = []
for (const [id, list] of byPage) {
  list.sort((a, b) => a.y0 - b.y0)
  const full = SKEW_PAGES[id]
  const d = dims.get(full) || { width: 600, height: 800 }
  const rel = "web/manifest/fotki/" + IMAGES[id]
  if (!fs.existsSync(path.join(root, rel))) console.warn(`warning: ${id} has no mirrored photograph at ${rel}`)
  pages.push({
    id,
    image: rel,
    width: d.width,
    height: d.height,
    skew: skew.has(full) ? skew.get(full) : 0,
    credit: "Photograph: iowaz.info (used for educational purposes)",
    items: list.map((it, i) => ({ seq: i + 1, kind: it.kind, y0: Math.max(0, it.y0), y1: Math.min(d.height - 1, it.y1) }))
  })
}

const out = {
  document: "McElwee Cemetery burial index (typescript)",
  note: "Row numbering is ours, not the typist's. seq is the ordinal position of the row on the page, top to bottom, and is the only key the validator and the diff understand. Rows and prose blocks share one sequence per page so that nothing on a page is unnumbered.",
  total: pages.reduce((n, p) => n + p.items.length, 0),
  pages
}

const dest = path.join(here, "rows.json")
fs.writeFileSync(dest, JSON.stringify(out, null, 1) + "\n", "utf8")
console.log(`rows.json: ${out.total} numbered items across ${pages.length} pages`)
for (const p of pages) {
  console.log(`  ${p.id.padEnd(16)} ${String(p.items.length).padStart(3)} items  skew ${p.skew}`)
}
