/*
 * Validates a handoff transcription against the inventory of the document it claims to be
 * reading. Two documents, two contracts:
 *
 *   catalog  source/handoff/catalog/   6 clean headstone-catalog pages; the reader finds
 *            its own rows, so the checks are about honesty: no invented rows, no skipped
 *            rows, no interpretation.
 *   burials  source/handoff/burials/  16 poor photographs of a typescript index, cut into
 *            numbered reading sheets. The rows are ours, so the contract is coverage:
 *            every seq answered exactly once, with the kind we said it was.
 *
 *   node scripts/check-handoff.js [catalog|burials] [file.jsonl]
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const readJson = (...rel) => JSON.parse(fs.readFileSync(path.join(root, ...rel), "utf8").replace(/^\uFEFF/, ""))

const DOCS = {
  catalog: {
    dir: "source/handoff/catalog",
    output: "catalog-output.jsonl",
    inventory: "catalog-lines.json",
    // The reference is a machine read of a machine-degraded source. It can catch a row
    // invented wholesale; it cannot catch one read slightly wrong.
    lenient: false
  },
  burials: {
    dir: "source/handoff/burials",
    output: "burials-output.jsonl",
    inventory: "sheet-lines.json",
    lenient: true
  }
}

const argv = process.argv.slice(2)
let docName = "catalog"
if (argv[0] && DOCS[argv[0]]) {
  docName = argv[0]
  argv.shift()
}
const doc = DOCS[docName]
const target = path.resolve(root, argv[0] || path.join(doc.dir, doc.output))

const CONFIDENCE = new Set(["high", "medium", "low"])
// A transcription that normalised a date has interpreted it, which both briefs forbid.
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/
// Fields that would mean the reader did our job instead of its own.
const DERIVED = ["born", "died", "aged", "relationship", "birth", "death", "date_of_birth", "date_of_death", "parents", "cause"]

const errors = []
const warnings = []
const err = (line, msg) => errors.push({ line, msg })
const warn = (line, msg) => warnings.push({ line, msg })

if (!fs.existsSync(target)) {
  console.error(`No ${docName} transcription to check at ${path.relative(root, target)}`)
  console.error(`Ask for the output to be saved there, then re-run: npm run check:handoff -- ${docName}`)
  process.exit(2)
}
if (!fs.existsSync(path.join(root, doc.dir, doc.inventory))) {
  console.error(`Missing ${path.join(doc.dir, doc.inventory)} - the reference corpus has not been generated.`)
  process.exit(2)
}

// Tokens of a page's machine read, used to test whether transcribed text exists at all.
const inventory = readJson(doc.dir, doc.inventory)
const pageTokens = new Map()
for (const [id, p] of Object.entries(inventory)) {
  const counts = new Map()
  for (const l of p.lines) {
    for (const t of String(l.text || "").toLowerCase().match(/[a-z0-9']+/g) || []) {
      if (t.length > 2) counts.set(t, (counts.get(t) || 0) + 1)
    }
  }
  pageTokens.set(id, counts)
}

const scaffold = docName === "burials" ? readJson(doc.dir, "rows.json") : null
const catalogPages = docName === "catalog" ? readJson(doc.dir, "pages.json") : null
const byId = catalogPages ? new Map(catalogPages.pages.map((p) => [p.id, p])) : null
const recordPages = catalogPages ? new Set(catalogPages.pages.filter((p) => p.role === "records").map((p) => p.id)) : null
// The burials numbering is ours, so we know exactly which seqs must come back and as what.
const want = new Map()
if (scaffold) {
  for (const p of scaffold.pages) for (const it of p.items) want.set(`${p.id}#${it.seq}`, it.kind)
}

const seen = new Map()
const headers = new Map()
const order = []
const stats = new Map()
let records = 0

const bump = (id, conf) => {
  if (!stats.has(id)) stats.set(id, { high: 0, medium: 0, low: 0, unreadable: 0 })
  const s = stats.get(id)
  if (conf === "unreadable") s.unreadable++
  else s[conf] = (s[conf] || 0) + 1
}

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
    err(line, 'line is valid JSON but not an object; each line must be one object with a "kind"')
    return
  }
  for (const f of DERIVED) {
    if (f in obj) err(line, `"${f}" is a derived field: transcribe what is printed and let the site parse it`)
  }

  if (obj.kind === "page") {
    if (catalogPages && !byId.has(obj.page)) return err(line, `unknown page id "${obj.page}"`)
    if (scaffold && !scaffold.pages.some((p) => p.id === obj.page)) return err(line, `unknown page id "${obj.page}"`)
    if (headers.has(obj.page)) return err(line, `duplicate page header for "${obj.page}"`)
    if (catalogPages) {
      const p = byId.get(obj.page)
      if (obj.image !== p.local_path) err(line, `image "${obj.image}" does not match pages.json "${p.local_path}"`)
      if (!Number.isInteger(obj.records) || obj.records < 0) err(line, "page header needs an integer records count")
      headers.set(obj.page, { declared: obj.records, emitted: 0, line })
    } else {
      const p = scaffold.pages.find((x) => x.id === obj.page)
      if (!Number.isInteger(obj.items) || obj.items < 0) err(line, "page header needs an integer items count")
      else if (obj.items !== p.items.length) err(line, `page "${obj.page}" declares ${obj.items} items; the scaffold has ${p.items.length}`)
      headers.set(obj.page, { declared: p.items.length, emitted: 0, line })
    }
    order.push(obj.page)
    return
  }
  if (obj.kind === "note") {
    if (!obj.text) return err(line, "note line has no text")
    return
  }
  if (obj.kind !== "record" && obj.kind !== "text") {
    return err(line, `unknown kind "${String(obj.kind)}"; expected page, record, text or note`)
  }

  for (const f of obj.kind === "text" ? ["page", "seq", "entry", "confidence"] : ["page", "seq", "surname", "entry", "confidence"]) {
    if (!(f in obj)) return err(line, `${obj.kind} is missing required field "${f}"`)
  }
  records++
  if (!CONFIDENCE.has(obj.confidence)) err(line, `confidence "${obj.confidence}" must be high, medium or low`)
  if (obj.entry !== null && typeof obj.entry !== "string") err(line, "entry must be a string or null")
  if (!Number.isInteger(obj.seq) || obj.seq < 1) return err(line, `seq must be a positive integer, got ${JSON.stringify(obj.seq)}`)
  if (ISO_DATE.test(String(obj.entry || ""))) err(line, "entry contains an ISO date: the brief forbids normalising dates, copy what is printed")
  // In the catalog every row carries a surname. In the burial index a blank left column is
  // normal -- the typist left it empty when the row repeats the family above -- so the
  // requirement is catalog-only.
  if (catalogPages && obj.kind === "record" && (typeof obj.surname !== "string" || !obj.surname.trim())) err(line, "surname should be the left column, verbatim")
  if (obj.kind === "record" && "surname" in obj && obj.surname !== null && typeof obj.surname !== "string") err(line, "surname must be a string or null")

  const key = `${obj.page}#${obj.seq}`
  if (seen.has(key)) return err(line, `duplicate seq ${obj.seq} on ${obj.page} (also line ${seen.get(key)})`)
  seen.set(key, { line, kind: obj.kind })
  if (headers.has(obj.page)) headers.get(obj.page).emitted++
  else err(line, `${obj.kind} for "${obj.page}" appears before its page header`)
  bump(obj.page, obj.entry === null || obj.unreadable === true ? "unreadable" : obj.confidence)

  if (want.size) {
    const expected = want.get(key)
    if (expected === undefined) err(line, `seq ${obj.seq} does not exist on ${obj.page} - rows.json is the only numbering`)
    else if (expected === "prose" && obj.kind !== "text") err(line, `seq ${obj.seq} on ${obj.page} is a prose block; emit it as kind "text", not "record"`)
    else if (expected === "row" && obj.kind !== "record") err(line, `seq ${obj.seq} on ${obj.page} is a table row; emit it as kind "record"`)
  }

  if (catalogPages) {
    const p = byId.get(obj.page)
    if (!p) return err(line, `unknown page id "${obj.page}"`)
    if (obj.image !== p.local_path) err(line, `image "${obj.image}" does not match pages.json "${p.local_path}"`)
    if (!recordPages.has(obj.page)) warn(line, `record on "${obj.page}", which is not a record page`)
  }

  // Does this text actually exist on the page? Compare against the machine read.
  const counts = pageTokens.get(obj.page)
  const tokens = String(obj.entry || "").toLowerCase().match(/[a-z0-9']+/g) || []
  const meaningful = tokens.filter((t) => t.length > 2)
  if (counts && meaningful.length >= 3) {
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
    const soft = doc.lenient ? 0.65 : 0.8
    if (score < 0.5 && !doc.lenient) err(line, `only ${(score * 100) | 0}% of this entry's words appear anywhere on ${obj.page} - suspected invention`)
    else if (score < soft) warn(line, `only ${(score * 100) | 0}% of words match the machine read of ${obj.page} - re-check it against the sheet`)
  }

  // Row alignment: the surname column was machine-read, so a mismatch usually means a
  // row was skipped or merged. The image wins, but the reviewer has to see it.
  if (catalogPages) {
    const known = byId.get(obj.page).ocr_surname_lines
    if (Array.isArray(known)) {
      const expected = known[obj.seq - 1]
      if (expected === undefined) warn(line, `seq ${obj.seq} is past the ${known.length} surname rows the machine read on ${obj.page}`)
      else if (String(obj.surname || "").trim().toUpperCase() !== expected.trim().toUpperCase()) {
        warn(line, `surname "${obj.surname}" where the machine read "${expected}" at row ${obj.seq} - either a skipped row or a better read`)
      }
    }
  }
})

// Coverage. For the burials index this is the whole point: a sheet is only useful if every
// strip on it came back, so a missing seq is an error rather than a note to the reviewer.
if (want.size) {
  for (const [key, kind] of want) {
    if (seen.has(key)) continue
    const [id, seq] = key.split("#")
    const h = headers.get(id)
    err(h ? h.line : 0, `${id}: seq ${seq} (${kind}) was never answered - every numbered strip must produce one line`)
  }
}
for (const id of recordPages || []) {
  if (!headers.has(id)) err(0, `no page header for "${id}" - that page was never transcribed`)
}
for (const [id, h] of headers) {
  if (h.declared !== h.emitted) err(h.line, `page "${id}" declares ${h.declared} items but ${h.emitted} follow`)
}

const rel = path.relative(root, target)
console.log(`${docName}: ${rel}`)
console.log(`${records} lines, ${seen.size} unique rows, ${headers.size} page headers`)
for (const id of order) {
  const h = headers.get(id)
  const s = stats.get(id) || { high: 0, medium: 0, low: 0, unreadable: 0 }
  console.log(
    `  ${id.padEnd(16)} ${String(h.emitted).padStart(3)}/${String(h.declared).padStart(3)}  high ${String(s.high).padStart(3)}  med ${String(s.medium).padStart(3)}  low ${String(s.low).padStart(3)}  blank ${String(s.unreadable).padStart(3)}`
  )
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
