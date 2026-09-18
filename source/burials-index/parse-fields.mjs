/**
 * Derives the structured fields from a burial-index entry line.
 *
 * The index writes every row to one formula:
 *
 *   <given names> <RELATIONSHIP> <parents>, born <place?> <date>, died <date> — aged 1 Y., 8 M. and 8 D.
 *
 * So the entry is the authoritative transcription and the sub-fields are
 * *derived from it*. That is deliberate: a hand-entered `died` can silently
 * disagree with the prose beside it, and on an unattributed desk copy that
 * disagreement is exactly the error the next researcher repeats. Deriving means
 * the fields can always be regenerated from what a human actually read.
 *
 * Two rules this parser will not break:
 *
 * 1. A keyword only ever sees its own span. `born` is searched strictly between
 *    the word "born" and the next of {born, died, aged}. Without this,
 *    "born Warren Co. MO, died Apr. 19, 1919" hands the *death* date to the
 *    birth field — a wrong answer that looks entirely reasonable.
 * 2. It does not guess at corrupted tokens. `sto`, `WIO`, `DfO`, `191K` are
 *    reported as unparsed rather than repaired, so the reviewer can see the
 *    line still needs them. On uncorrected OCR the yield is low, and that is
 *    the honest result: run this on text a human has fixed.
 */

const MONTH = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";

/* The index separates day from year with a comma OR a full stop: "Dec. 2, 1883",
   "Sept 12.1804", "Jan. 19.1810". Years must be four digits — a three-digit
   match is OCR damage ("191K"), and inventing a century is worse than missing. */
const DATE =
  String.raw`(?:(?:${MONTH})[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?[.,]?\s*\d{4}` +
  String.raw`|(?:${MONTH})[a-z]*\.?\s+\d{4}` +
  String.raw`|\d{1,2}(?:st|nd|rd|th)?\.?\s+(?:${MONTH})[a-z]*\.?,?\s*\d{4}` +
  String.raw`|\d{1,2}\s*/\s*\d{1,2}\s*/\s*\d{2,4}` +
  String.raw`|\b\d{4}\b)`;

/* "1 Y., 8 M. and 8 D." / "75 Y., 8 M. and 20 D." / "70 8m" */
const AGE = String.raw`\d{1,3}\s*[YyMmDd]\.?(?:\s*[,.]?\s*(?:and\s*)?\d{1,3}\s*[YyMmDd]\.?){0,2}`;

const BORN_ALT = String.raw`born|bom|borne`;
const DIED_ALT = String.raw`died`;
const AGED_ALT = String.raw`aged|agea|aced`;

/* The b./d./a. abbreviations are a trap: "Claud H. B. S/O …" and "Marion D. bom
   died 1939" carry a middle initial that looks exactly like a keyword, and
   reading "B." as "born" hands that row somebody else's date. So an abbreviation
   counts only when a month name or a digit follows it — always true of a real
   "b. Aug. 19, 1758", never true of an initial followed by a surname. */
const DATELOOK = String.raw`(?=\s*(?:${MONTH}[a-z]*\.?\s|\d))`;
const BORN = String.raw`(?:\b(?:${BORN_ALT})\b|\bb\.${DATELOOK})`;
const DIED = String.raw`(?:\b(?:${DIED_ALT})\b|\bd\.${DATELOOK})`;
const AGED = String.raw`(?:\b(?:${AGED_ALT})\b|\ba\.(?=\s*\d)|\bæt\.|\baet\.)`;

/* Relationship. Canonical forms only — the index abbreviates and never spells
   these out. Trailing \b is dropped so "S/OJ. W." (a spacing slip the reviewer
   may leave alone) still reads, because the slash makes the token unambiguous. */
const RELS = [
  { re: /\bD\s*\/\s*O/i, out: "D/O", means: "daughter of" },
  { re: /\bS\s*\/\s*O/i, out: "S/O", means: "son of" },
  { re: /\bW\s*\/\s*O/i, out: "W/O", means: "wife of" },
  { re: /\bH\s*\/\s*O/i, out: "H/O", means: "husband of" },
  { re: /\bB\s*\/\s*O/i, out: "B/O", means: "brother of" },
  { re: /\bM\s*\/\s*O/i, out: "M/O", means: "mother of" },
  { re: /\bF\s*\/\s*O/i, out: "F/O", means: "father of" },
];

/* Normalise whitespace without disturbing initials: "J. H. and J. J." must keep
   its periods, and "1 Y., 8 M." must not gain a space before the comma. */
const clean = (s) =>
  String(s || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,;:])/g, "$1")
    .replace(/([,;:])\s*/g, "$1 ")
    .replace(/^[-—–,.]+/, "")
    // A trailing period is kept — in "1 Y., 8 M. and 8 D." it is the whole
    // point of the abbreviation. Only a period after a bare year is punctuation.
    .replace(/(\d{4})\.\s*$/, "$1")
    .replace(/[-—–,]+$/, "")
    .trim();

const looksLikePlace = (p) =>
  /(?:\bCo\.?\b|\bCounty\b|\bState\b|\bParish\b|\bMO\b|\bVA\b|\bKY\b|\bTN\b|\bIL\b|\bIA\b|\bKS\b|\bAR\b|\bOH\b|\bIN\b|\bNC\b|\bSC\b|Carolina|Virginia|Kentucky|Tennessee|York|Greenville|Franklin|Pike|Louisiana|Missouri|Illinois|Iowa|Kansas|Texas)/i.test(p);

/** First date inside `span`, and the text preceding it. */
function splitDate(span) {
  const m = span.match(new RegExp(DATE, "i"));
  if (!m) return { date: "", before: span };
  return { date: clean(m[0]), before: span.slice(0, m.index) };
}

function parsePlace(raw) {
  const p = clean(raw).replace(/^(?:in|at|of|the)\s+/i, "").replace(/[,.]+$/, "").trim();
  if (!p || p.length < 3 || p.length > 60) return "";
  return looksLikePlace(p) ? p : "";
}

/**
 * @param {string} entry the corrected entry line
 * @returns {{born:string,bornPlace:string,died:string,diedPlace:string,aged:string,
 *            relationship:string,parents:string,unparsed:string[]}}
 */
export function parseEntry(entry) {
  const out = { born: "", bornPlace: "", died: "", diedPlace: "", aged: "", relationship: "", parents: "", unparsed: [] };
  const text = clean(entry);
  if (!text || text.length < 2) return out;

  // Locate the three date keywords so each owns exactly one span.
  const at = (re) => { const m = text.match(re); return m ? { i: m.index, end: m.index + m[0].length } : null; };
  const kb = { born: at(new RegExp(BORN, "i")), died: at(new RegExp(DIED, "i")), aged: at(new RegExp(AGED, "i")) };
  const marks = Object.values(kb).filter(Boolean).sort((a, b) => a.i - b.i);
  const spanAfter = (k) => {
    const here = kb[k];
    if (!here) return null;
    const next = marks.find((m) => m.i > here.i);
    return text.slice(here.end, next ? next.i : text.length);
  };

  // --- relationship + parents --------------------------------------------------
  let relAt = -1, rel = null, relLen = 0;
  for (const r of RELS) {
    const m = text.match(r.re);
    if (m && (relAt === -1 || m.index < relAt)) { relAt = m.index; rel = r; relLen = m[0].length; }
  }
  if (rel) {
    out.relationship = rel.out;
    // Parents run to the next comma or keyword — never to a period, which here
    // is always an initial ("J. H. and J. J. BLAND").
    const tail = text.slice(relAt + relLen);
    const stop = tail.search(new RegExp(String.raw`,|\b(?:${BORN_ALT})\b|\b(?:${DIED_ALT})\b|\b(?:${AGED_ALT})\b`, "i"));
    out.parents = clean(stop > -1 ? tail.slice(0, stop) : tail.slice(0, 70));
  } else if (/[DSWHBMF]\s*[/\\|!'i]\s*O|WIO|DIOR|DfO|\bsto\b/i.test(text)) {
    out.unparsed.push("relationship");
  }

  // --- born --------------------------------------------------------------------
  const bs = spanAfter("born");
  if (bs !== null) {
    const { date, before } = splitDate(bs);
    if (date) out.born = date; else out.unparsed.push("born");
    out.bornPlace = parsePlace(before);
  }

  // --- died --------------------------------------------------------------------
  const ds = spanAfter("died");
  if (ds !== null) {
    const { date, before } = splitDate(ds);
    if (date) {
      out.died = date;
      // "died at Franklin, MO" puts the place before the date; "died May 21,
      // 1875 in Pike Co." puts it after, so check both sides.
      const pre = parsePlace(before);
      if (pre) out.diedPlace = pre;
      else {
        const idx = ds.toLowerCase().indexOf(date.toLowerCase());
        out.diedPlace = parsePlace(ds.slice(idx + date.length).replace(/^\s*[,.]?\s*(?:at|in)\s+/i, "").slice(0, 44));
      }
    } else out.unparsed.push("died");
  }

  // --- aged --------------------------------------------------------------------
  const as = spanAfter("aged");
  if (as !== null) {
    const m = as.match(new RegExp("^\\s*(" + AGE + ")", "i"));
    if (m) out.aged = clean(m[1]);
    else out.unparsed.push("aged");
  } else if (/\b\d{1,3}\s*[Yy]\b/.test(text)) {
    out.unparsed.push("aged");
  }

  return out;
}

/** True when the parser found nothing at all — the line is prose or noise. */
export function isBlank(p) {
  return !(p.born || p.died || p.aged || p.relationship || p.bornPlace || p.diedPlace);
}
