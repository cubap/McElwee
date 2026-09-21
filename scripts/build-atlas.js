/**
 * Publishes the 1899 atlas plate index as static exhibit data.
 *
 * This is a thin transform: the source of truth is source/atlas/plates.json, which records
 * the verified SHSMO CONTENTdm objects (one per plate) and the family-property associations
 * we are researching. It copies that into web/data/atlas.json so the published site can read
 * it without reaching outside the repository for its structure.
 *
 * The viewer never fabricates imagery. It holds the IIIF base URL and the plate ids, and the
 * browser builds image requests to SHSMO's IIIF Image API directly, with attribution and a
 * link back to the digitized collection.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SOURCE = path.join(ROOT, "source", "atlas", "plates.json")
const OUT = path.join(ROOT, "web", "data", "atlas.json")

export function build() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`missing ${path.relative(ROOT, SOURCE)}`)
  }
  const data = JSON.parse(fs.readFileSync(SOURCE, "utf8"))
  return data
}

export function run() {
  const data = build()
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(data))
  const kb = (fs.statSync(OUT).size / 1024).toFixed(1)
  console.log(`  atlas     ${data.plates.length} plates, ${data.families.length} families, ${kb} KB -> web/data/atlas.json`)
  return data
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run()
}
