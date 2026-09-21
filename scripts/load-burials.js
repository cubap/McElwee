/*
 * Load the burial index into a RERUM store.
 *
 * Dry run by default. Nothing reaches the network until you pass --execute, and even then
 * it goes through the local proxy (server/) so the access token never lives in this
 * process or in the browser.
 *
 *   node scripts/load-burials.js                    # plan only, writes burials-plan.json
 *   node scripts/load-burials.js --execute          # write everything
 *   node scripts/load-burials.js --execute --limit 3
 *
 * Idempotency comes from load-ledger.json: each local record id is mapped to the store IRI
 * it was created under, and a second run skips anything already in the ledger. If the run
 * dies halfway, re-running continues where it stopped rather than minting duplicates.
 */

import fs from "node:fs"
import path from "node:path"

import { buildOperations, loadEvidence, pageIndexImages, defaultEvidencePath } from "./burials-payloads.js"

const ROOT = process.cwd()
const LEDGER = path.join(ROOT, "source", "burials-evidence", "load-ledger.json")
const PLAN_OUT = path.join(ROOT, "source", "burials-evidence", "burials-plan.json")
const ROWS = path.join(ROOT, "source", "handoff", "burials", "rows.json")

function parseArgs(argv) {
  const args = { execute: false, limit: 0, base: process.env.PROXY_BASE || "http://localhost:3030", list: "" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--execute") args.execute = true
    else if (a === "--limit") args.limit = Number.parseInt(argv[++i], 10) || 0
    else if (a === "--base") args.base = argv[++i]
    else if (a === "--list") args.list = argv[++i]
    else if (a === "--help") args.help = true
  }
  return args
}

function readLedger() {
  try {
    return JSON.parse(fs.readFileSync(LEDGER, "utf8").replace(/^\uFEFF/, ""))
  } catch {
    return { created: {}, listUpdated: false }
  }
}

function writeLedger(ledger) {
  fs.writeFileSync(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`, "utf8")
}

/** Replace `@person:ID` / `@burialIndex` placeholders with the IRIs the store handed back. */
function resolve(node, ledger) {
  if (typeof node === "string") {
    if (node === "@burialIndex") return ledger.created["@burialIndex"] || node
    if (node.startsWith("@person:")) {
      const id = node.slice("@person:".length)
      return ledger.created[`person:${id}`] || node
    }
    return node
  }
  if (Array.isArray(node)) return node.map((n) => resolve(n, ledger))
  if (node && typeof node === "object") {
    const out = {}
    for (const [k, v] of Object.entries(node)) out[k] = resolve(v, ledger)
    return out
  }
  return node
}

/**
 * The ledger key for an operation. A person and its annotation share a local record id, so
 * the kind is part of the key - otherwise creating the person would mark its own
 * annotation as already written and the claims would never land.
 */
function ledgerKey(op) {
  if (op.kind === "document") return "@burialIndex"
  if (op.kind === "list-append") return "list"
  return `${op.kind}:${op.localId}`
}

function alreadyDone(op, ledger) {
  if (op.kind === "list-append") return Boolean(ledger.listUpdated)
  return Boolean(ledger.created[ledgerKey(op)])
}

function hasPlaceholders(node) {
  if (typeof node === "string") return node.startsWith("@person:") || node === "@burialIndex"
  if (Array.isArray(node)) return node.some(hasPlaceholders)
  if (node && typeof node === "object") return Object.values(node).some(hasPlaceholders)
  return false
}

async function post(base, route, payload, method = "POST") {
  const response = await fetch(`${base}${route}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  const text = await response.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  if (!response.ok) {
    throw new Error(`${method} ${route} -> HTTP ${response.status}: ${json?.error || text.slice(0, 200)}`)
  }
  return json
}

function idFrom(response) {
  return response?.["@id"] || response?.id || response?.new_obj_state?.["@id"] || null
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log("usage: node scripts/load-burials.js [--execute] [--limit N] [--base URL] [--list IRI]")
    return
  }

  const evidence = loadEvidence(defaultEvidencePath(ROOT))
  const rows = loadEvidence(ROWS)
  const { operations } = buildOperations(evidence, pageIndexImages(rows))
  const ledger = readLedger()

  const counts = operations.reduce((a, o) => ((a[o.kind] = (a[o.kind] || 0) + 1), a), {})
  const pending = operations.filter((o) => !alreadyDone(o, ledger))

  console.log(`evidence records : ${evidence.records.length}`)
  console.log(`operations       : ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join("  ")}`)
  console.log(`already in ledger: ${Object.keys(ledger.created).length}`)
  console.log(`to write         : ${pending.length}`)

  if (!args.execute) {
    fs.writeFileSync(PLAN_OUT, JSON.stringify({ generatedFrom: "source/burials-evidence/burials-evidence.json", operations }, null, 2))
    console.log(`\ndry run - plan written to ${path.relative(ROOT, PLAN_OUT)}`)
    console.log("no network calls were made. pass --execute to write.")
    const sample = operations.find((o) => o.kind === "annotation")
    if (sample) console.log("\nsample annotation:\n" + JSON.stringify(sample.payload, null, 2).slice(0, 900))
    return
  }

  // Confirm the proxy is up and knows who it is before the first write, so a missing
  // .env fails immediately instead of halfway through the batch.
  const agent = await fetch(`${args.base}/agent`).then((r) => r.json()).catch((e) => {
    throw new Error(`Cannot reach the local proxy at ${args.base}: ${e.message}. Run \`npm start\` first.`)
  })
  if (agent.problem) throw new Error(`Refusing to write: ${agent.problem}`)
  console.log(`\nwriting as ${agent.agentIri}\ntarget store ${agent.apiAddr}`)
  if (!args.list) throw new Error("Pass --list <population list IRI> so the new people join the exhibit's list.")

  let written = 0
  for (const op of pending) {
    if (args.limit && written >= args.limit) break

    if (op.kind === "list-append") {
      const listId = args.list
      const list = await fetch(listId).then((r) => r.json())
      const existing = new Set((list.itemListElement || []).map((i) => i["@id"]))
      const resolvedMembers = resolve(op.payload.members, ledger)
      const ready = resolvedMembers.filter((m) => !existing.has(m["@id"]) && !hasPlaceholders(m["@id"]))
      const waiting = resolvedMembers.length - ready.length
      if (!ready.length) {
        console.log("list: nothing new to add")
        if (!waiting) continue
      }
      list.itemListElement = (list.itemListElement || []).concat(ready)
      list.numberOfItems = list.itemListElement.length
      await post(args.base, "/update", list, "PUT")
      // A canary run (--limit) cannot finish the list, so leave it un-marked and let the
      // next run top it up rather than recording a completion that did not happen.
      if (!waiting) ledger.listUpdated = true
      writeLedger(ledger)
      console.log(`list: added ${ready.length} people${waiting ? ` (${waiting} still uncreated)` : ""}`)
      written++
      continue
    }

    const payload = resolve(op.payload, ledger)
    if (hasPlaceholders(payload)) {
      console.warn(`skip ${op.localId || op.ref}: unresolved placeholder (its person was not created)`)
      continue
    }
    const created = await post(args.base, "/create", payload)
    const iri = idFrom(created)
    if (!iri) throw new Error(`No @id came back for ${op.localId || op.ref}: ${JSON.stringify(created).slice(0, 200)}`)
    const key = ledgerKey(op)
    ledger.created[key] = iri
    writeLedger(ledger)
    written++
    if (written % 10 === 0 || written === 1) console.log(`  ${written}: ${op.kind} ${op.localId || op.ref} -> ${iri}`)
  }

  console.log(`\nwrote ${written} operation(s). ledger: ${path.relative(ROOT, LEDGER)}`)
}

main().catch((error) => {
  console.error(`\nFAILED: ${error.message}`)
  process.exitCode = 1
})
