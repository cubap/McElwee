/**
 * transcribe3.mjs — build the burial worksheet from row-segmented OCR.
 *
 * Usage: node transcribe3.mjs rows.json ocr-rows.json
 *
 * The index is a two-column table: a short surname gutter and a free-text entry. Each
 * physical table row fits one text line, so one segmented band is one record.
 *
 * Two things the scans force:
 *   - The column boundary drifts page to page (different camera angles), so it is
 *     calibrated per page as the widest gap in word x-positions in the left region.
 *   - The gutter can still capture the given name. Surnames are the only thing written
 *     in full capitals, so the split inside the strip is made on capital density.
 *
 * Output is a WORKSHEET for transcription against the physical desk copy, not data.
 */
import { readFileSync, writeFileSync } from "node:fs";

/** Fallback gutter boundary if a page shows no clear column gap. */
const DEFAULT_BOUND = 150;
/** Pages that are prose rather than the two-column table. */
const NON_TABULAR = /^(BurialsAlpha000|Family001)$/;

const [manifestPath = "rows.json", ocrPath = "ocr-rows.json"] = process.argv.slice(2);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8").replace(/^﻿/, ""));
const ocr = JSON.parse(readFileSync(ocrPath, "utf8").replace(/^﻿/, ""));

const bandInfo = new Map();
for (const p of manifest)
  for (const b of p.bands || [])
    bandInfo.set(b.file.replace(/\.png$/i, ""), {
      page: p.page.replace("PikeCoMoCemMcElwee", ""),
      y0: b.y0, y1: b.y1, scale: b.scale || 1, pad: b.pad || 0,
    });

const capsHeavy = (t) => (t.match(/[A-Z]/g) || []).length >= 3;
const levenshtein = (a, b) => {
  const m = [...a], n = [...b];
  let prev = Array.from({ length: n.length + 1 }, (_, i) => i);
  for (let i = 1; i <= m.length; i++) {
    const cur = [i];
    for (let j = 1; j <= n.length; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (m[i - 1] === n[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n.length];
};

// Pass 1: every word's source-page x, per page, to find the column gap.
const xsByPage = new Map();
const bandsByPage = new Map();
for (const p of ocr) {
  const info = bandInfo.get(p.page);
  if (!info) continue;
  const page = info.page;
  const toSrc = (x) => (x - info.pad) / info.scale;
  if (!xsByPage.has(page)) xsByPage.set(page, []);
  if (!bandsByPage.has(page)) bandsByPage.set(page, []);
  const lines = [];
  for (const L of p.lines || []) {
    const words = (L.words || []).slice().sort((a, b) => a.x - b.x);
    if (!words.length) continue;
    lines.push(words.map((w) => ({ t: w.t, x: toSrc(w.x) })));
    for (const w of words) xsByPage.get(page).push(toSrc(w.x));
  }
  if (lines.length) bandsByPage.get(page).push({ y0: info.y0, y1: info.y1, lines });
}

/** Widest gap in word x within the left region is the column boundary. */
function columnBoundary(xs) {
  const left = xs.filter((x) => x > 20 && x < 330).sort((a, b) => a - b);
  let best = { gap: 0, at: DEFAULT_BOUND };
  for (let i = 1; i < left.length; i++) {
    const gap = left[i] - left[i - 1];
    if (gap > best.gap) best = { gap, at: (left[i] + left[i - 1]) / 2 };
  }
  return best.gap > 25 ? best.at : DEFAULT_BOUND;
}

const rows = [];
const prose = [];
const bounds = {};
for (const [page, bands] of [...bandsByPage].sort()) {
  bands.sort((a, b) => a.y0 - b.y0);
  const bound = columnBoundary(xsByPage.get(page));
  bounds[page] = Math.round(bound);

  for (const b of bands) {
    const gutter = [], entry = [];
    for (const line of b.lines)
      for (const w of line) (w.x < bound ? gutter : entry).push(w);

    const toks = gutter.map((w) => w.t);
    let cut = 0;
    while (cut < toks.length && capsHeavy(toks[cut])) cut++;
    const surname = cut ? toks.slice(0, cut).join(" ") : null;

    const text = [...toks.slice(cut), ...entry.map((w) => w.t)].join(" ").replace(/\s+/g, " ").trim();
    if (!text && !surname) continue;
    if (NON_TABULAR.test(page)) { prose.push({ page, y: b.y0, text: text || toks.join(" ") }); continue; }
    rows.push({ page, y0: b.y0, y1: b.y1, surname, entry: text });
  }
}

const out = [];
for (const r of rows) {
  const text = r.entry.replace(/[|¦†‡]/g, "").replace(/\s+/g, " ").trim();
  if (!text && !r.surname) continue;

  const born = (text.match(/\b(?:born|bora|bomoa|bara|burn)\.?\s+([A-Z][a-z]+\.?\s*\d{1,2},?\s*\d{2,4})/i) || [])[1] || "";
  const died = (text.match(/\b(?:died|djed|diea)\s+([A-Z][a-z]+\.?\s*\d{1,2},?\s*\d{2,4})/i) || [])[1] || "";
  const aged = (text.match(/\bage?d?\s*(\d{1,3})\s*y/i) || [])[1] || "";
  const rel = (text.match(/\b(D\/O|D,\/O|S\/O|S'O|W\/O|WIO|W\.O|H\/O)\b/i) || [])[1] || "";

  let corroborated = false;
  if (r.surname) {
    const key = r.surname.toUpperCase().replace(/[^A-Z]/g, "");
    const budget = Math.max(1, Math.round(key.length * 0.25));
    for (const w of text.split(/\s+/)) {
      const t = w.toUpperCase().replace(/[^A-Z]/g, "");
      if (t.length < 4) continue;
      if (t === key || levenshtein(t, key) <= budget || t.slice(0, 4) === key.slice(0, 4)) { corroborated = true; break; }
    }
  }

  out.push({
    page: r.page, y0: r.y0, y1: r.y1, surname: r.surname, entry: text,
    born, died, aged, relationship: rel, corroborated,
    confidence: corroborated ? "high" : (r.surname && (born || died || aged) ? "medium" : "low"),
  });
}

const named = out.filter((r) => r.surname).length;
const corr = out.filter((r) => r.corroborated).length;
const grade = { high: 0, medium: 0, low: 0 };
for (const r of out) grade[r.confidence]++;
console.log("column boundaries:", JSON.stringify(bounds));
console.log("rows:         ", out.length);
console.log("with surname: ", named, `(${Math.round((100 * named) / out.length)}%)`);
console.log("corroborated: ", corr, `(${Math.round((100 * corr) / out.length)}%)`);
console.log("confidence:   ", JSON.stringify(grade));
console.log("with born:    ", out.filter((r) => r.born).length);
console.log("with died:    ", out.filter((r) => r.died).length);
console.log("relationship: ", out.filter((r) => r.relationship).length);
console.log("prose lines:  ", prose.length);

writeFileSync("burials-worksheet.json", JSON.stringify({ rows: out, prose }, null, 2));
const head = ["page", "y0", "y1", "surname", "entry", "born", "died", "aged", "relationship", "corroborated", "confidence"];
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
writeFileSync("burials-worksheet.csv", "" + [head, ...out.map((r) => head.map((h) => r[h]))].map((c) => c.map(esc).join(",")).join("\r\n") + "\r\n");
console.log("wrote burials-worksheet.csv / burials-worksheet.json");
