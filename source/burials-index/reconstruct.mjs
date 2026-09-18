/**
 * Reconstruct the two-column burial index from Windows-OCR word boxes.
 *
 * The typescript index is a table: a sparse Surname column on the left, and one
 * entry per line on the right. Windows OCR reads each column as its own run of
 * lines and reports no line-level bounding box, so we rebuild geometry from the
 * word boxes and then attach each entry to the surname whose vertical band
 * contains it.
 *
 * Usage: node reconstruct.mjs <ocr-wordboxes.json>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC = process.argv[2];
if (!SRC) {
  console.error("usage: node reconstruct.mjs <ocr-wordboxes.json>");
  process.exit(2);
}

/** x below this is the surname gutter; measured from the corpus, not guessed. */
const SURNAME_MAX_X = 145;

function lineBox(line) {
  const ws = line.words || [];
  if (!ws.length) return null;
  const x = Math.min(...ws.map((w) => w.x));
  const y = Math.min(...ws.map((w) => w.y));
  const right = Math.max(...ws.map((w) => w.x + w.w));
  const bottom = Math.max(...ws.map((w) => w.y + w.h));
  return { x, y, right, bottom };
}

const pages = JSON.parse(fs.readFileSync(SRC, "utf8").replace(/^\uFEFF/, ""));
const out = [];

for (const page of pages) {
  const lines = (page.lines || [])
    .map((l) => ({ text: l.text, box: lineBox(l) }))
    .filter((l) => l.box);

  const surnames = lines.filter((l) => l.box.right <= SURNAME_MAX_X).sort((a, b) => a.box.y - b.box.y);
  const entries = lines.filter((l) => l.box.right > SURNAME_MAX_X).sort((a, b) => a.box.y - b.box.y);

  // A surname governs every entry from its own y down to the next surname's y.
  const bands = surnames.map((s, i) => ({
    surname: s.text.trim(),
    from: s.box.y,
    to: i + 1 < surnames.length ? surnames[i + 1].box.y : Infinity,
  }));

  for (const e of entries) {
    const band = bands.find((b) => e.box.y >= b.from && e.box.y < b.to);
    out.push({
      page: page.page,
      y: Math.round(e.box.y),
      surname: band ? band.surname : null,
      surname_guessed: !band,
      text: e.text,
    });
  }
}

// Continuation lines: an entry that starts lowercase or with a bare year is the
// tail of the one above it (the typescript wraps long entries).
const merged = [];
for (const row of out) {
  const prev = merged[merged.length - 1];
  const cont =
    prev &&
    prev.page === row.page &&
    prev.surname === row.surname &&
    /^\d{4}$|^[a-z]/.test(row.text.trim());
  if (cont) prev.text = `${prev.text} ${row.text}`.trim();
  else merged.push({ ...row });
}

const dir = path.dirname(path.resolve(SRC));
fs.writeFileSync(path.join(dir, "burials-draft.json"), JSON.stringify(merged, null, 2));

const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const csv = ["page,y_in_band,surname,entry", ...merged.map((r) => [r.page, r.y, r.surname, r.text].map(esc).join(","))].join("\r\n");
fs.writeFileSync(path.join(dir, "burials-draft.csv"), "\uFEFF" + csv);

const noSurname = merged.filter((r) => !r.surname).length;
console.log(`pages: ${new Set(merged.map((r) => r.page)).size}`);
console.log(`entries: ${merged.length} (from ${out.length} lines)`);
console.log(`entries with no surname in band: ${noSurname}`);
console.log(`surnames: ${new Set(merged.map((r) => r.surname).filter(Boolean)).size}`);
