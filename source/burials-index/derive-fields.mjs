/**
 * derive-fields.mjs — regenerate the structured fields from the entry column.
 *
 * Usage:
 *   node derive-fields.mjs                        # reads burials-worksheet.json
 *   node derive-fields.mjs burials-verified.json  # reads a proofreader export
 *   node derive-fields.mjs --out build/x.json     # alternate output prefix
 *
 * The entry line is the authoritative transcription; born / died / aged /
 * relationship / places / parents are DERIVED from it rather than hand-kept, so
 * they can always be rebuilt from text a human actually read. Fields the
 * reviewer hand-edited (listed in `fieldsEdited` by the proofreader) are left
 * exactly as written — a person outranks the parser.
 *
 * Output is a WORKSHEET for a human, not publishable genealogy. Rows whose entry
 * is still raw OCR will show few or wrong fields; that is the parser refusing to
 * guess, not a bug to fix by loosening it.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEntry, isBlank } from "./parse-fields.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flags = new Map();
const positional = [];
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith("--")) { positional.push(argv[i]); continue; }
  const next = argv[i + 1];
  if (next !== undefined && !next.startsWith("--")) { flags.set(argv[i].slice(2), next); i++; }
  else flags.set(argv[i].slice(2), true);
}
const input = positional[0] || "burials-worksheet.json";
const inPath = path.isAbsolute(input) ? input : path.join(here, input);
const outPrefix = flags.get("out") || path.join(here, "burials-derived.json").replace(/\.json$/, "");

const doc = JSON.parse(readFileSync(inPath, "utf8").replace(/^\uFEFF/, ""));
const rows = doc.rows || [];
const FIELD_KEYS = ["born", "bornPlace", "died", "diedPlace", "aged", "relationship", "parents"];

const tally = Object.fromEntries(FIELD_KEYS.map((k) => [k, 0]));
let touched = 0, pinned = 0, bare = 0;

for (const r of rows) {
  const p = parseEntry(r.entry || "");
  const keep = new Set(r.fieldsEdited || []);
  pinned += keep.size;
  for (const k of FIELD_KEYS) {
    if (keep.has(k)) continue;               // a human wrote it; leave it alone
    r[k] = p[k] || r[k] || "";
    if (r[k]) tally[k]++;
  }
  r.unparsed = p.unparsed || [];
  if (r.unparsed.length) touched++;
  if (isBlank(p) && !keep.size) bare++;
}

writeFileSync(outPrefix + ".json", JSON.stringify({ ...doc, derivedFrom: path.basename(inPath) }, null, 2));

const head = ["page", "y0", "y1", "surname", "entry", ...FIELD_KEYS, "unparsed", "corroborated", "confidence"];
const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const csv = "\uFEFF" + [head, ...rows.map((r) => head.map((h) => (h === "unparsed" ? (r.unparsed || []).join("|") : r[h])))].map((c) => c.map(q).join(",")).join("\r\n");
writeFileSync(outPrefix + ".csv", csv);

console.log(`derived ${rows.length} rows from ${path.basename(inPath)}`);
for (const k of FIELD_KEYS) console.log(`  ${k.padEnd(13)} ${String(tally[k]).padStart(4)}`);
console.log(`  ${String(touched).padStart(4)} rows still have a keyword with no value after it`);
console.log(`  ${String(bare).padStart(4)} rows yielded nothing at all (prose, or entry not yet corrected)`);
console.log(`  ${String(pinned).padStart(4)} fields preserved because a reviewer hand-edited them`);
console.log(`\nwrote ${outPrefix}.json and ${outPrefix}.csv`);
