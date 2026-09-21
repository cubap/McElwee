/*
 * Attach page-slice provenance to the catalog annotations.
 *
 * The 2018 catalog annotations (the "McElwee Cemetery Catalog" evidence) were written
 * without the rectangle of the page photograph each claim was read from, so the exhibit
 * can only link the evidence record - not show the line, the way the burial index does.
 * This script closes that gap: it matches every catalog person to its row in the machine
 * baseline, measures the row's rectangle in the page photograph, and adds
 * `provenance: {sourceImage, rect}` to every claim in every annotation.
 *
 * Dry run by default. Nothing reaches the network until you pass --execute, and even then
 * it goes through the local proxy (server/) so the access token never lives in this
 * process or in the browser.
 *
 *   node scripts/catalog-provenance.js                    # plan only, writes provenance-plan.json
 *   node scripts/catalog-provenance.js --execute          # write everything
 *   node scripts/catalog-provenance.js --execute --limit 3
 *
 * Updates are idempotent: a claim that already carries provenance is left alone, so a
 * re-run after a partial failure only touches what is still missing.
 */

import fs from "node:fs"
import path from "node:path"

import { publicImageUrl } from "./burials-payloads.js"

const ROOT = process.cwd()
const BASELINE = path.join(ROOT, "source", "handoff", "catalog", "machine-baseline.jsonl")
const LINES = path.join(ROOT, "source", "handoff", "catalog", "catalog-lines.json")
const PLAN_OUT = path.join(ROOT, "source", "handoff", "catalog", "provenance-plan.json")

const RERUM_BASE = "https://store.rerum.io/v1"
const POPULATION_LIST = `${RERUM_BASE}/id/6ab15ef62655eb9310888d22`

// Calibrated against the page photographs: the OCR line x is the left edge of the entry
// text, characters run about 14px wide, and consecutive lines sit about 63px apart.
const CHAR_W = 14
const LINE_HALF = 31

function parseArgs(argv) {
  const args = { execute: false, limit: 0, base: process.env.PROXY_BASE || "http://localhost:3030", help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--execute") args.execute = true
    else if (a === "--limit") args.limit = Number.parseInt(argv[++i], 10) || 0
    else if (a === "--base") args.base = argv[++i]
    else if (a === "--help") args.help = true
  }
  return args
}

function loadJsonl(file) {
  return fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line))
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
}

/** Levenshtein distance, capped at the caller's tolerance so long strings stay cheap. */
function levenshtein(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = curr
  }
  return prev[b.length]
}

/**
 * How well a catalog person matches a baseline row. The catalog description is the full
 * entry text (surname prefix included) and the baseline row is `surname + entry`, so the
 * two normalized strings are nearly identical; OCR slips ("Glann" for "Glenn", "ARR" for
 * "CARR") cost a character or two. A person with no description (Sarah I. Howell Bevard)
 * is matched by name, which is a substring of the row.
 */
function matchScore(personText, candidateText) {
  const p = normalize(personText)
  const c = normalize(candidateText)
  if (!p || !c) return 0
  if (c.includes(p)) return 1
  // A person with no description is matched by name alone, and the row prints the
  // surname first ("BEVARD Sarah I. Howell born..."), so the name is not a contiguous
  // substring. Every name token appearing in the row is just as strong a signal.
  const tokens = String(personText)
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1)
  if (tokens.length >= 2 && tokens.every((t) => c.includes(normalize(t)))) return 1
  return 1 - levenshtein(p, c) / Math.max(p.length, c.length)
}

function bestBaseline(personText, records) {
  let best = null
  let bestScore = 0
  for (const record of records) {
    const candidate = `${record.surname || ""} ${record.entry || ""}`
    const score = matchScore(personText, candidate)
    if (score > bestScore) {
      best = record
      bestScore = score
    }
  }
  return { record: best, score: bestScore }
}

/**
 * The rectangle of the row in the page photograph. `lines` are 1-based indices into the
 * page's OCR line list; the rect is the union of those lines, padded half a line above
 * and below so the slice reads as the row, not as clipped text.
 */
function rectFor(record, pageLines) {
  const page = pageLines[record.page]
  if (!page) return null
  const lines = (record.lines || [])
    .map((n) => page.lines[n - 1])
    .filter(Boolean)
  if (!lines.length) return null
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const line of lines) {
    x0 = Math.min(x0, line.x)
    y0 = Math.min(y0, line.y)
    x1 = Math.max(x1, line.x + line.text.length * CHAR_W)
    y1 = Math.max(y1, line.y)
  }
  return {
    x0: Math.round(x0),
    y0: Math.round(y0 - LINE_HALF),
    x1: Math.round(x1),
    y1: Math.round(y1 + LINE_HALF),
    skew: 0,
    source: `source-image-pixels-${page.width}x${page.height}`
  }
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`GET ${url} -> HTTP ${response.status}`)
  return response.json()
}

/** The store matches `target` literally, so query both spellings of the person IRI. */
async function annotationsFor(personIri) {
  const variants = [personIri, personIri.replace(/^https:/, "http:")]
  const found = []
  for (const target of variants) {
    const response = await fetch(`${RERUM_BASE}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target })
    })
    if (!response.ok) continue
    const results = await response.json()
    for (const anno of results) {
      const id = anno["@id"] || anno.id
      if (!found.some((a) => (a["@id"] || a.id) === id)) found.push(anno)
    }
  }
  return found
}

/** The store writes one claim per annotation, so `body` is a single-key object, not an array. */
function bodyEntries(annotation) {
  const body = annotation.body
  if (Array.isArray(body)) return body
  if (body && typeof body === "object") return [body]
  return []
}

function claimsOf(annotation) {
  const claims = []
  for (const entry of bodyEntries(annotation)) {
    for (const [key, claim] of Object.entries(entry)) {
      if (claim && typeof claim === "object" && "value" in claim) claims.push({ key, claim })
    }
  }
  return claims
}

function needsProvenance(annotation) {
  return claimsOf(annotation).some(({ claim }) => !claim.provenance?.sourceImage)
}

async function put(base, payload) {
  const response = await fetch(`${base}/update`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`PUT /update -> HTTP ${response.status}: ${text.slice(0, 200)}`)
  }
  return text ? JSON.parse(text) : null
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(
      "usage: node scripts/catalog-provenance.js [--execute] [--limit N] [--base URL]\n" +
        "  --execute   write the provenance updates through the local proxy\n" +
        "  --limit N   write at most N annotations\n\n" +
        "Dry run by default: it reads the store and writes provenance-plan.json, nothing more."
    )
    return
  }

  const baseline = loadJsonl(BASELINE).filter((r) => r.kind === "record")
  const pageLines = JSON.parse(fs.readFileSync(LINES, "utf8"))

  console.log(`baseline rows   : ${baseline.length}`)
  console.log(`population list : ${POPULATION_LIST}`)

  const list = await fetchJson(POPULATION_LIST)
  const people = (list.itemListElement || []).map((m) => m["@id"] || m.id).filter(Boolean)
  console.log(`people in list  : ${people.length}`)

  const updates = []
  const unmatched = []
  for (const personIri of people) {
    const annotations = await annotationsFor(personIri)
    const pending = annotations.filter(needsProvenance)
    if (!pending.length) continue

    // The store writes one claim per annotation, so the person's best match text is
    // gathered across all of them: the verbatim description when there is one, else the
    // display name, else the list's own name.
    const allClaims = annotations.flatMap(claimsOf)
    const description = allClaims.find(({ key }) => key === "description")?.claim?.value
    const name = allClaims.find(({ key }) => key === "name")?.claim?.value
    const personText = description || name
    if (!personText) {
      unmatched.push({ person: personIri, reason: "no description or name claim" })
      continue
    }
    const { record, score } = bestBaseline(personText, baseline)
    if (!record || score < 0.5) {
      unmatched.push({ person: personIri, reason: `no confident baseline match (best ${score.toFixed(2)})` })
      continue
    }
    const rect = rectFor(record, pageLines)
    if (!rect) {
      unmatched.push({ person: personIri, reason: `no lines for ${record.page} seq ${record.seq}` })
      continue
    }
    const sourceImage = publicImageUrl(record.image)
    for (const annotation of pending) {
      const updatedBody = bodyEntries(annotation).map((entry) => {
        const out = {}
        for (const [key, claim] of Object.entries(entry)) {
          out[key] = { ...claim, provenance: { sourceImage, rect } }
        }
        return out
      })
      updates.push({
        "@id": annotation["@id"] || annotation.id,
        person: personIri,
        baseline: `${record.page} seq ${record.seq}`,
        score: Number(score.toFixed(3)),
        payload: { ...annotation, body: updatedBody }
      })
    }
  }

  console.log(`annotations to update: ${updates.length}`)
  if (unmatched.length) {
    console.log(`unmatched (skipped)  : ${unmatched.length}`)
    for (const u of unmatched) console.log(`  - ${u.person}: ${u.reason}`)
  }

  fs.writeFileSync(
    PLAN_OUT,
    JSON.stringify(
      { generatedFrom: "source/handoff/catalog/machine-baseline.jsonl", populationList: POPULATION_LIST, updates },
      null,
      2
    )
  )
  console.log(`\nplan written to ${path.relative(ROOT, PLAN_OUT)}`)

  if (!args.execute) {
    console.log("dry run - no network writes were made. pass --execute to write.")
    const sample = updates[0]
    if (sample) console.log("\nsample update:\n" + JSON.stringify(sample.payload, null, 2).slice(0, 900))
    return
  }

  let written = 0
  for (const update of updates) {
    if (args.limit && written >= args.limit) break
    await put(args.base, update.payload)
    written++
    if (written % 5 === 0 || written === 1) console.log(`  ${written}: ${update["@id"]} (${update.baseline})`)
  }
  console.log(`\nwrote ${written} update(s).`)
}

main().catch((error) => {
  console.error(`\nFAILED: ${error.message}`)
  process.exitCode = 1
})
