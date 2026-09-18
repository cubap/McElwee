/**
 * Compares a blind model read against our machine baseline, strip by strip, for the three
 * sheets handed to the deepseek pass. Prints a side-by-side and scores each read against the
 * sheet-OCR reference corpus (sheet-lines.json) so we can see whose words actually appear on
 * the sheet. The reference is itself a machine read, so a high score is corroboration, not
 * proof; the point is to surface the strips where the two reads disagree and one is clearly
 * closer to the ink.
 *
 *   node source/handoff/burials/compare-blind.js [blind.jsonl]
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..", "..", "..")
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(here, rel), "utf8").replace(/^\uFEFF/, ""))

const blindPath = process.argv[2]
  ? path.resolve(root, process.argv[2])
  : path.join(root, "blind-deepseek.jsonl")

const PAGES = ["BurialsAlpha001", "BurialsPage005", "BurialsAlpha005"]

const parse = (file) =>
  fs
    .readFileSync(file, "utf8")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l)
      } catch {
        return null
      }
    })
    .filter((o) => o && o.page && PAGES.includes(o.page) && o.kind !== "page")

const baseline = parse(path.join(here, "machine-baseline.jsonl"))
if (!fs.existsSync(blindPath)) {
  console.error(`no blind file at ${blindPath}`)
  process.exit(2)
}
const blind = parse(blindPath)

const key = (o) => `${o.page}#${o.seq}`
const bMap = new Map(baseline.map((o) => [key(o), o]))
const dMap = new Map(blind.map((o) => [key(o), o]))

// Reference corpus: the words the sheet OCR saw, per page, normalised.
const lines = readJson("sheet-lines.json")
const refWords = new Map()
for (const p of PAGES) {
  const set = new Set()
  const bucket = lines[p]
  const arr = Array.isArray(bucket) ? bucket : bucket?.lines || []
  for (const l of arr) {
    const t = (l.text || l.line || "").toLowerCase()
    for (const w of t.split(/[^a-z0-9]+/)) if (w.length > 1) set.add(w)
  }
  refWords.set(p, set)
}
const norm = (s) => String(s || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1)
const score = (page, text) => {
  const set = refWords.get(page)
  const ws = norm(text)
  if (!ws.length || !set || !set.size) return null
  let hit = 0
  for (const w of ws) if (set.has(w)) hit++
  return hit / ws.length
}

const keys = [...new Set([...bMap.keys(), ...dMap.keys()])].sort()
let agree = 0
let oursBetter = 0
let theirsBetter = 0
let even = 0
const rows = []
for (const k of keys) {
  const b = bMap.get(k)
  const d = dMap.get(k)
  const page = k.split("#")[0]
  const bs = b ? score(page, b.entry) : null
  const ds = d ? score(page, d.entry) : null
  const same = b && d && norm(b.entry).join(" ") === norm(d.entry).join(" ")
  if (same) agree++
  else if (bs != null && ds != null) {
    if (Math.abs(bs - ds) < 0.05) even++
    else if (bs > ds) oursBetter++
    else theirsBetter++
  }
  rows.push({ k, b, d, bs, ds, same })
}

for (const r of rows) {
  const tag = r.same ? "  =" : r.bs != null && r.ds != null ? (r.bs > r.ds + 0.05 ? " OURS" : r.ds > r.bs + 0.05 ? " THEIRS" : "  ~ ") : "  ? "
  console.log(`\n${r.k}${tag}`)
  console.log(`  ours  [${r.b?.confidence || "-"}] ${r.b?.surname ?? ""} | ${r.b?.entry ?? "(missing)"}   ref=${r.bs == null ? "-" : (r.bs * 100) | 0}%`)
  console.log(`  deep  [${r.d?.confidence || "-"}] ${r.d?.surname ?? ""} | ${r.d?.entry ?? "(missing)"}   ref=${r.ds == null ? "-" : (r.ds * 100) | 0}%`)
}

console.log(`\n--- ${keys.length} strips: ${agree} identical, ${oursBetter} ours closer to sheet, ${theirsBetter} deepseek closer, ${even} even, ${keys.length - agree - oursBetter - theirsBetter - even} other/missing ---`)
