import assert from "node:assert/strict"
import test from "node:test"

import { isEmptyQuery, localIdFromIri, readPagination, verifyJsonContentType } from "../server/rest.js"
import { patchEnvFile } from "../server/tokens.js"

function runGuard(contentType) {
  const req = { headers: contentType === null ? {} : { "content-type": contentType } }
  let error = null
  verifyJsonContentType(req, {}, (err) => {
    if (err) error = err
  })
  return error
}

test("accepts application/json and application/ld+json, with or without parameters", () => {
  for (const ok of ["application/json", "application/json; charset=utf-8", "application/ld+json", "APPLICATION/JSON"]) {
    assert.equal(runGuard(ok), null, `expected ${ok} to pass`)
  }
})

test("rejects form posts and missing content types with 415", () => {
  for (const bad of ["application/x-www-form-urlencoded", "text/plain", "multipart/form-data"]) {
    const error = runGuard(bad)
    assert.equal(error.status, 415)
    assert.match(error.message, /Unsupported Content-Type/)
  }
  assert.equal(runGuard(null).status, 415)
})

test("rejects a doubled content-type header rather than guessing", () => {
  const error = runGuard("application/json, application/ld+json")
  assert.equal(error.status, 415)
  assert.match(error.message, /exactly one/)
})

test("treats every shape of empty query as dangerous", () => {
  for (const empty of [{}, [], "", null, undefined]) {
    assert.equal(isEmptyQuery(empty), true)
  }
  assert.equal(isEmptyQuery({ "@type": "Person" }), false)
  assert.equal(isEmptyQuery([{ target: "x" }]), false)
})

test("pagination values must be non-negative integers", () => {
  assert.equal(readPagination(undefined, "limit"), null)
  assert.equal(readPagination("0", "limit"), 0)
  assert.equal(readPagination("25", "limit"), 25)
  assert.throws(() => readPagination("-1", "limit"), /non-negative/)
  assert.throws(() => readPagination("abc", "limit"), /non-negative/)
})

test("reduces a RERUM IRI to the local id the delete endpoint wants", () => {
  assert.equal(localIdFromIri("https://devstore.rerum.io/v1/id/5b76fc0de4b09992fca21e68"), "5b76fc0de4b09992fca21e68")
  assert.equal(localIdFromIri("http://devstore.rerum.io/v1/id/abc/"), "abc")
  assert.equal(localIdFromIri("abc"), "abc")
  assert.equal(localIdFromIri(""), null)
})

test("patchEnvFile swaps a value and keeps every comment", () => {
  const original = [
    "# Copy this file to .env",
    "# The comments matter.",
    "ACCESS_TOKEN=old",
    "",
    "REFRESH_TOKEN=keepme",
    "EXPECTED_AGENT_IRI="
  ].join("\n")

  const patched = patchEnvFile(original, "ACCESS_TOKEN", "new")

  assert.match(patched, /^# Copy this file to \.env$/m, "comments must survive")
  assert.match(patched, /^ACCESS_TOKEN=new$/m)
  assert.match(patched, /^REFRESH_TOKEN=keepme$/m, "unrelated keys must be untouched")
  assert.match(patched, /^EXPECTED_AGENT_IRI=$/m)
})

test("patchEnvFile appends a key that is not present yet", () => {
  assert.equal(patchEnvFile("A=1\n", "B", "2"), "A=1\nB=2\n")
  assert.equal(patchEnvFile("A=1", "B", "2"), "A=1\nB=2\n")
  assert.equal(patchEnvFile("", "B", "2"), "B=2\n")
})
