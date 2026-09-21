/**
 * Renders our current machine read of the burial index in the handoff format.
 *
 * This is the thing a transcription is diffed against. It is deliberately not part of the
 * brief: it is mostly wrong in the ways machine reads are wrong, and showing it to a reader
 * would trade its eyes for our guesses. Regenerate it whenever the worksheet changes.
 *
 *   node source/handoff/burials/make-baseline.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "../../..")
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8").replace(/^\uFEFF/, ""))

const worksheet = readJson("source/burials-index/burials-worksheet.json")
const scaffold = readJson("source/handoff/burials/rows.json")

// The worksheet stores rows and prose separately; the scaffold interleaved them by y and
// assigned the seq. Rebuild that same order so the two line up exactly.
const items = new Map()
for (const p of scaffold.pages) items.set(p.id, new Map(p.items.map((it) => [it.seq, it])))

const rowsByPage = new Map()
for (const r of worksheet.rows) {
  if (!rowsByPage.has(r.page)) rowsByPage.set(r.page, [])
  rowsByPage.get(r.page).push(r)
}
const proseByPage = new Map()
for (const p of worksheet.prose) {
  if (!proseByPage.has(p.page)) proseByPage.set(p.page, [])
  proseByPage.get(p.page).push(p)
}

const lines = []
let records = 0
let texts = 0
for (const p of scaffold.pages) {
  const sheet = p.items.length
  lines.push(JSON.stringify({ kind: "page", page: p.id, items: sheet }))
  const rowList = (rowsByPage.get(p.id) || []).slice().sort((a, b) => a.y0 - b.y0)
  const proseList = (proseByPage.get(p.id) || []).slice().sort((a, b) => a.y - b.y)
  for (const it of p.items) {
    if (it.kind === "row") {
      const r = rowList.find((x) => x.y0 === it.y0)
      if (!r) continue
      lines.push(JSON.stringify({
        kind: "record",
        page: p.id,
        seq: it.seq,
        surname: r.surname || null,
        entry: r.entry || null,
        confidence: r.confidence || "low"
      }))
      records++
    } else {
      const pr = proseList.find((x) => x.y - 26 === it.y0)
      if (!pr) continue
      lines.push(JSON.stringify({
        kind: "text",
        page: p.id,
        seq: it.seq,
        entry: pr.text || null,
        confidence: "low"
      }))
      texts++
    }
  }
}

const dest = path.join(here, "machine-baseline.jsonl")
fs.writeFileSync(dest, lines.join("\n") + "\n", "utf8")
console.log(`machine-baseline.jsonl: ${records} records, ${texts} text blocks, ${scaffold.pages.length} page headers`)
