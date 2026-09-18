/**
 * Builds the validator's reference corpus for the burial index.
 *
 * The mirrored photographs OCR to mush. The rendered reading sheets do not: levelling the
 * card and magnifying the type roughly triples the number of lines a machine can read off
 * a page. This aggregates the sheet OCR into one token source per page so the validator can
 * ask a narrow question -- does the text this transcription produced appear anywhere on the
 * page at all? -- without pretending to know what the page says.
 *
 * Prerequisite: tool/sheets.ps1, then tool/ocr-sheet.ps1 (or tool/ocr.ps1 over sheets/).
 *
 *   node source/handoff/burials/make-lines.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(here, rel), "utf8").replace(/^\uFEFF/, ""))

const ocr = readJson("sheet-ocr.json")
const scaffold = readJson("rows.json")

const pageWidth = new Map(scaffold.pages.map((p) => [p.id, p.width]))
// sheet-ocr names each file "BurialsPage005_s02"; the page id is everything before the suffix.
const pageOf = (name) => String(name).replace(/_s\d+$/, "")

/** Anything left of this x is the sequence gutter or the sheet header, not the card. */
const GUTTER_X = 130

const out = {}
for (const page of ocr) {
  const id = pageOf(page.page)
  if (!pageWidth.has(id)) continue
  out[id] = out[id] || { width: pageWidth.get(id) || 600, lines: [] }
  for (const l of page.lines || []) {
    const first = (l.words || [])[0]
    if (!first) continue
    if (first.x < GUTTER_X) continue
    const text = (l.text || "").trim()
    if (!text) continue
    out[id].lines.push({ x: first.x, y: first.y, text })
  }
}

for (const id of Object.keys(out)) out[id].lines.sort((a, b) => a.y - b.y)

const dest = path.join(here, "sheet-lines.json")
fs.writeFileSync(dest, JSON.stringify(out, null, 1) + "\n", "utf8")

const total = Object.values(out).reduce((n, p) => n + p.lines.length, 0)
console.log(`sheet-lines.json: ${total} reference lines across ${Object.keys(out).length} pages`)
for (const p of scaffold.pages) {
  const got = out[p.id] ? out[p.id].lines.length : 0
  console.log(`  ${p.id.padEnd(16)} ${String(p.items.length).padStart(3)} rows   ${String(got).padStart(3)} reference lines`)
}
