/**
 * Builds the batch for the *adjudication* pass: our machine read, strip by strip, next to
 * the sheet that should confirm or refute it.
 *
 * The main brief (HANDOFF.md) withholds this read on purpose, because a model shown a wrong
 * answer tends to reproduce it. That is the right call when you want an independent second
 * opinion. It is the wrong call when you want a moderation queue: showing the guess is what
 * makes the pass cheap, and every disagreement is exactly the item a human should see.
 *
 * Output is one line per strip, in the handoff format plus `sheet`, so a returned file can
 * be validated by `npm run check:handoff -- burials` unchanged.
 *
 *   node source/handoff/burials/make-review.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(here, rel), "utf8").replace(/^\uFEFF/, ""))

const scaffold = readJson("rows.json")
const baseline = fs
  .readFileSync(path.join(here, "machine-baseline.jsonl"), "utf8")
  .replace(/^\uFEFF/, "")
  .split(/\r?\n/)
  .filter(Boolean)
  .map((l) => JSON.parse(l))
const sheetIndex = readJson("sheets/sheets.json")

// Which sheet carries which seq, so the reader is told where to look rather than hunting.
const sheetOf = new Map()
for (const s of sheetIndex) for (const seq of s.seq) sheetOf.set(`${s.page}#${seq}`, s.sheet)

const byKey = new Map()
for (const o of baseline) {
  if (o.kind === "page") continue
  byKey.set(`${o.page}#${o.seq}`, o)
}

const lines = []
let missing = 0
for (const p of scaffold.pages) {
  lines.push(JSON.stringify({ kind: "page", page: p.id, items: p.items.length }))
  for (const it of p.items) {
    const src = byKey.get(`${p.id}#${it.seq}`)
    if (!src) {
      missing++
      continue
    }
    const rec = {
      kind: src.kind,
      page: p.id,
      seq: it.seq,
      sheet: sheetOf.get(`${p.id}#${it.seq}`) || null
    }
    if (src.kind === "record") rec.surname = src.surname
    rec.entry = src.entry
    rec.our_confidence = src.confidence
    lines.push(JSON.stringify(rec))
  }
}

const dest = path.join(here, "review-batch.jsonl")
fs.writeFileSync(dest, lines.join("\n") + "\n", "utf8")
const noSheet = lines.filter((l) => l.includes('"sheet":null')).length
const strips = lines.filter((l) => !l.includes('"kind":"page"')).length
console.log(`review-batch.jsonl: ${strips} strips + ${scaffold.pages.length} page headers`)
if (missing) console.log(`  ${missing} scaffold strips had no machine read`)
if (noSheet) console.log(`  ${noSheet} lines with no sheet (rendering dropped them)`)
