import assert from "node:assert/strict"
import test from "node:test"

import { parseEntry, isBlank } from "../source/burials-index/parse-fields.mjs"

/**
 * The burial index writes every row to one formula, so born / died / aged /
 * relationship are derived from the entry line rather than hand-kept. These
 * tests are the contract that makes deriving safe: the parser must fill what the
 * text says and stay silent about everything else. A derived field that guesses
 * is worse than an empty one, because it looks like a record.
 */

test("derives the whole formula from a corrected line", () => {
  const p = parseEntry(
    "Rhoda Black W/O James McElwee, born Mar. 4, 1777, died Aug. 22, 1850 — aged 71 Y., 1 M. and 22 D."
  )
  assert.equal(p.relationship, "W/O")
  assert.equal(p.parents, "James McElwee")
  assert.equal(p.born, "Mar. 4, 1777")
  assert.equal(p.died, "Aug. 22, 1850")
  assert.equal(p.aged, "71 Y., 1 M. and 22 D.")
})

test("keeps the trailing period of an age, which is the abbreviation", () => {
  const p = parseEntry("Claud H. B. S/O J. H. and J. J. BLAND, died Dec. 2, 1883 — aged 1 Y., 8 M. and 8 D.")
  assert.equal(p.aged, "1 Y., 8 M. and 8 D.")
  assert.equal(p.died, "Dec. 2, 1883")
  assert.equal(p.relationship, "S/O")
})

test("does not truncate parents at the periods inside initials", () => {
  const p = parseEntry("Beatrice D/O F. and S. A. HOWELL, died Sept. 7, 1848")
  assert.equal(p.parents, "F. and S. A. HOWELL")
})

/**
 * THE REGRESSION THAT MATTERS. "born <place>, died <date>" used to hand the death
 * date to the birth field, because a naive search finds the first date after the
 * word "born" wherever it is. Every keyword may only read its own span.
 */
test("a birth place never receives the death date", () => {
  const p = parseEntry("Susan HUMPHREY, born Warren Co. MO, died Apr. 19, 1919 — aged 75 Y., 8 M. and 20 D.")
  assert.equal(p.born, "")
  assert.equal(p.bornPlace, "Warren Co. MO")
  assert.equal(p.died, "Apr. 19, 1919")
  assert.equal(p.aged, "75 Y., 8 M. and 20 D.")
})

test("each keyword reads only its own span", () => {
  const p = parseEntry("Marion D. bom died 1939")
  assert.equal(p.born, "")
  assert.equal(p.died, "1939")
})

test("a middle initial is not the abbreviation b. or d.", () => {
  // "B." before "S/O" and "D." before "bom" both look like keywords and are not.
  assert.equal(parseEntry("Claud H. B. S/O J. H. BLAND, died Dec. 2, 1883").born, "")
  assert.equal(parseEntry("Robert L. CALDWELL, died May 3, 1901 at Franklin, MO, aged 60 Y.").died, "May 3, 1901")
})

test("b. d. a. abbreviations parse when a date actually follows", () => {
  const p = parseEntry("James McELWEE, b. Aug. 19, 1758, d. June 13, 1834, a. 75 Y.")
  assert.equal(p.born, "Aug. 19, 1758")
  assert.equal(p.died, "June 13, 1834")
  assert.equal(p.aged, "75 Y.")
})

test("the birth place may sit between the keyword and its date", () => {
  const p = parseEntry("John G. HOWELL, born in York Co. S. Carolina June 11, 1792, died Sept. 20, 1870")
  assert.equal(p.born, "June 11, 1792")
  assert.equal(p.bornPlace, "York Co. S. Carolina")
  assert.equal(p.died, "Sept. 20, 1870")
})

test("a death place is found on either side of the date", () => {
  assert.equal(parseEntry("Robert L. CALDWELL, died May 3, 1901 at Franklin, MO, aged 60 Y.").diedPlace, "Franklin, MO")
})

test("day and year may be split by a full stop, as the index often writes them", () => {
  const p = parseEntry("Flavius J. HUMPHREY, born Dec. 22, 1831, died Mar. 18.1915, aged 83 Y., 2 M. and 6 D.")
  assert.equal(p.born, "Dec. 22, 1831")
  assert.equal(p.died, "Mar. 18.1915")
})

test("a damaged year is not silently completed into a century", () => {
  const p = parseEntry("Sarah E. Rowell, born April 13, 1867, died Nov. 20. 191K")
  assert.equal(p.born, "April 13, 1867")
  assert.equal(p.died, "")
  assert.ok(p.unparsed.includes("died"), "the reviewer is told the line is unfinished")
})

test("a corrupted relationship is reported, never guessed at", () => {
  const p = parseEntry("Mionie Dzo J. J. BLAND, died Sept. 13, 1880")
  assert.equal(p.relationship, "")
  assert.ok(p.unparsed.includes("relationship"))
})

test("relationship tokens match even when OCR lost the space", () => {
  const p = parseEntry("John E. S/OJ. W. and E. C. CARR, born Jan. 19.1810")
  assert.equal(p.relationship, "S/O")
  assert.equal(p.born, "Jan. 19.1810")
})

test("a line with no dates yields nothing rather than noise", () => {
  for (const line of ["Thomas W. PATTON", "1", "", "   ", "married Mar. 24, 1854 Thomas Washington Patton"]) {
    const p = parseEntry(line)
    assert.equal(p.born, "", line)
    assert.equal(p.died, "", line)
    assert.equal(p.aged, "", line)
  }
  assert.ok(isBlank(parseEntry("Thomas W. PATTON")))
})

test("a married line keeps its relationship but invents no death", () => {
  const p = parseEntry("Fannie D/O S. & E. GIVENS, married Mar. 24, 1854 Thomas Washington Patton")
  assert.equal(p.relationship, "D/O")
  assert.equal(p.parents, "S. & E. GIVENS")
  assert.equal(p.died, "")
})
