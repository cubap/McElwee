/*
 * Validates a handoff transcription (source/handoff/catalog-output.jsonl) against the
 * inventory in pages.json and a machine read of the same pages.
 *
 * The point is not to grade the transcription's taste. It is to catch the three ways a
 * transcription of a cemetery catalog does damage: skipped or duplicated rows, text that
 * is not on the page at all, and interpretation smuggled in as data. Everything else is
 * the reviewer's judgement.
 *
 *   node scripts/check-handoff.js [file.jsonl]
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const target = path.resolve(root, process.argv[2] || "source/handoff/catalog-output.jsonl")

const inventory = JSON.parse(fs.readFileSync(path.join(root, "source/handoff/catalog-lines.json"), "utf8"))
const pages = JSON.parse(fs.readFileSync(path.join(root, "source/handoff/pages.json"), "utf8"))
const byId = new Map(pages.pages.map((p) => [p.id, p]))
const recordPages = new Set(pages.pages.filter((p) => p.role === "records").map((p) => p.id))

const errors = []
const warnings = []
const err = (line, msg) => errors.push({ line, msg })
const warn = (line, msg) => warnings.push({ line, msg })

if (!fs.existsSync(target)) {
  console.error(`No file to check at ${path.relative(root, target)}`)
  console.error("Ask for the transcription to be saved there, then re-run.")
  process.exit(2)
}

// Tokens of a page's machine read, used to test whether transcribed text exists at all.
const pageTokens = new Map()
for (const [id, p] of Object.entries(inventory)) {
  const counts = new Map()
  for (const l of p.lines) {
    for (const t of l.text.toLowerCase().match(/[a-z0-9']+/g) || []) {
      if (t.length > 2) counts.set(t, (counts.get(t) || 0) + 1)
    }
  }
  pageTokens.set(id, counts)
}

const RECORD_FIELDS = ["page", "image", "seq", "surname", "entry", "confidence"]
const CONFIDENCE = new Set(["high", "medium", "low"])
// A transcription that has normalised a date has interpreted it, which the brief forbids.
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/

const seen = new Map()
const headers = new Map()
const order = []
let records = 0

const raw = fs.readFileSync(target, "utf8").replace(/^\uFEFF/, "")
raw.split(/\r?\n/).forEach((text, i) => {
  const line = i + 1
  if (!text.trim()) return
  let obj
  try {
    obj = JSON.parse(text)
  } catch (e) {
    err(line, `not valid JSON: ${e.message}`)
    return
  }
  if (obj === null || typeof obj !== "object") {
    err(line, "line is valid JSON but not an object; each line must be one object with a \"kind\"")
    return
  }
  if (obj.kind === "page") {
    const p = byId.get(obj.page)
    if (!p) return err(line, `unknown page id "${obj.page}"`)
    if (headers.has(obj.page)) return err(line, `duplicate page header for "${obj.page}"`)
    if (obj.image !== p.local_path) err(line, `image "${obj.image}" does not match pages.json "${p.local_path}"`)
    if (!Number.isInteger(obj.records) || obj.records < 0) err(line, "page header needs an integer records count")
    headers.set(obj.page, { declared: obj.records, emitted: 0, line })
    order.push(obj.page)
    return
  }
  if (obj.kind === "note") {
    if (!obj.text) return err(line, "note line has no text")
    if (!byId.has(obj.page)) return err(line, `unknown page id "${obj.page}"`)
    return
  }
  if (obj.kind !== "record") return err(line, `unknown kind "${String(obj.kind)}"; expected page, record or note`)

  records++
  for (const f of RECORD_FIELDS) {
    if (!(f in obj)) return err(line, `record is missing required field "${f}"`)
  }
  const p = byId.get(obj.page)
  if (!p) return err(line, `unknown page id "${obj.page}"`)
  if (obj.image !== p.local_path) err(line, `image "${obj.image}" does not match pages.json "${p.local_path}"`)
  if (!path.isAbsolute(p.local_path) && !fs.existsSync(path.join(root, p.local_path))) err(line, `image file is not on disk: ${p.local_path}`)
  if (!Number.isInteger(obj.seq) || obj.seq < 1) return err(line, `seq must be a positive integer, got ${JSON.stringify(obj.seq)}`)
  if (!CONFIDENCE.has(obj.confidence)) err(line, `confidence "${obj.confidence}" must be high, medium or low`)
  if (typeof obj.surname !== "string" || !obj.surname.trim()) err(line, "surname should be the left column, verbatim")
  if (obj.entry !== null && typeof obj.entry !== "string") err(line, "entry must be a string or null")

  if (!recordPages.has(obj.page)) warn(line, `record on "${obj.page}", which is not a record page`)
  if (ISO_DATE.test(String(obj.entry || ""))) err(line, "entry contains an ISO date: the brief forbids normalising dates, copy what is printed")

  const key = `${obj.page}#${obj.seq}`
  if (seen.has(key)) err(line, `duplicate seq ${obj.seq} on ${obj.page} (also line ${seen.get(key)})`)
  seen.set(key, line)
  if (headers.has(obj.page)) headers.get(obj.page).emitted++
  else err(line, `record for "${obj.page}" appears before its page header`)

  // Does this text actually exist on the page? Compare against the machine read.
  const counts = pageTokens.get(obj.page)
  const tokens = String(obj.entry || "").toLowerCase().match(/[a-z0-9']+/g) || []
  const meaningful = tokens.filter((t) => t.length > 2)
  if (counts && meaningful.length) {
    const pool = new Map(counts)
    let hit = 0
    for (const t of meaningful) {
      const n = pool.get(t)
      if (n > 0) {
        hit++
        pool.set(t, n - 1)
      }
    }
    const score = hit / meaningful.length
    if (score < 0.5) err(line, `only ${(score * 100) | 0}% of this entry's words appear anywhere on ${obj.page} - suspected invention`)
    else if (score < 0.8) warn(line, `only ${(score * 100) | 0}% of words match the machine read of ${obj.page} - re-check it against the image`)
  }

  // Row alignment: the surname column was machine-read, so a mismatch usually means a
  // row was skipped or merged. The image wins, but the reviewer has to see it.
  const known = p.ocr_surname_lines
  if (Array.isArray(known)) {
    const expected = known[obj.seq - 1]
    if (expected === undefined) warn(line, `seq ${obj.seq} is past the ${known.length} surname rows the machine read on ${obj.page}`)
    else if (String(obj.surname || "").trim().toUpperCase() !== expected.trim().toUpperCase()) {
      warn(line, `surname "${obj.surname}" where the machine read "${expected}" at row ${obj.seq} - either a skipped row or a better read`)
    }
  }
})

for (const [id, h] of headers) {
  if (h.declared !== h.emitted) err(h.line, `page "${id}" declares ${h.declared} records but ${h.emitted} follow`)
}
for (const id of recordPages) {
  if (!headers.has(id)) err(0, `no page header for "${id}" - that page was never transcribed`)
}
for (const [id, h] of headers) {
  const seqs = [...seen.keys()].filter((k) => k.startsWith(`${id}#`)).map((k) => Number(k.split("#")[1])).sort((a, b) => a - b)
  for (let n = 1; n <= (h.emitted || 0); n++) {
    if (!seqs.includes(n)) err(h.line, `${id}: no record with seq ${n} - the rows must be numbered from 1 with no gaps`)
  }
}

const total = recordPages.size ? seen.size : 0
const EXPECTED = pages.pages.filter((p) => p.role === "records").reduce((n, p) => n + (p.ocr_surname_lines || []).length, 0)
if (Math.abs(total - EXPECTED) > 3) warn(0, `${total} records against ${EXPECTED} surname rows the machine read - check the row segmentation`)

const rel = path.relative(root, target)
console.log(`${rel}: ${records} records, ${headers.size} page headers, ${total} unique rows`)
for (const id of order) {
  const h = headers.get(id)
  console.log(`  ${id.padEnd(18)} declared ${String(h.declared).padStart(3)}  emitted ${String(h.emitted).padStart(3)}`)
}
const show = (list, label) => {
  if (!list.length) return
  console.log(`\n${label} (${list.length})`)
  for (const f of list.slice(0, 40)) console.log(`  ${f.line ? `line ${f.line}: ` : ""}${f.msg}`)
  if (list.length > 40) console.log(`  ... and ${list.length - 40} more`)
}
show(warnings, "warnings")
show(errors, "errors")
if (!errors.length && !warnings.length) console.log("\nclean")
console.log(errors.length ? `\nREJECTED: ${errors.length} error(s)` : "\nACCEPTED")
process.exit(errors.length ? 1 : 0)
