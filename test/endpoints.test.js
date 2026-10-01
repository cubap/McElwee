import assert from "node:assert/strict"
import test from "node:test"

import { localIdFromIri, TINYNODE_DEFAULT, READ_API_DEFAULT, WRITE_ROUTES, writeUrl } from "../server/endpoints.js"
import { httpError } from "../server/rest.js"
import { patchEnvFile } from "../server/tokens.js"

test("the read and write defaults are different hosts, on purpose", () => {
  // store.rerum.io is the RERUM API and authorization portal. tiny.rerum.io is the public
  // TinyNode instance. Conflating them is the mistake this split exists to prevent: there is
  // no TinyNode at store.rerum.io, and /query has no passthrough at tiny.rerum.io.
  assert.equal(READ_API_DEFAULT, "https://store.rerum.io/v1/api/")
  assert.equal(TINYNODE_DEFAULT, "https://tiny.rerum.io/")
  assert.notEqual(new URL(READ_API_DEFAULT).host, new URL(TINYNODE_DEFAULT).host)
})

test("only the write verbs are relayed, and /query is not one of them", () => {
  assert.deepEqual(Array.from(WRITE_ROUTES).sort(), ["create", "delete", "overwrite", "update"])
  assert.equal(WRITE_ROUTES.includes("query"), false)
})

test("writeUrl builds a TinyNode route from an address with or without a trailing slash", () => {
  assert.equal(writeUrl("https://tiny.rerum.io/", "create"), "https://tiny.rerum.io/create")
  assert.equal(writeUrl("https://tiny.rerum.io", "update"), "https://tiny.rerum.io/update")
  assert.equal(writeUrl("http://localhost:8080/", "delete", "abc123"), "http://localhost:8080/delete/abc123")
})

test("writeUrl encodes id segments so a stray IRI cannot escape the route", () => {
  assert.equal(writeUrl("https://tiny.rerum.io/", "delete", "a/b"), "https://tiny.rerum.io/delete/a%2Fb")
  assert.equal(writeUrl("https://tiny.rerum.io/", "delete", undefined, ""), "https://tiny.rerum.io/delete")
  assert.equal(
    writeUrl("https://tiny.rerum.io/", "delete", "5b76fc0d?x=1&y=2"),
    "https://tiny.rerum.io/delete/5b76fc0d%3Fx%3D1%26y%3D2"
  )
})

test("reduces a RERUM IRI to the local id the delete endpoint wants", () => {
  assert.equal(localIdFromIri("https://store.rerum.io/v1/id/5b76fc0de4b09992fca21e68"), "5b76fc0de4b09992fca21e68")
  assert.equal(localIdFromIri("http://devstore.rerum.io/v1/id/abc/"), "abc")
  assert.equal(localIdFromIri("abc"), "abc")
  assert.equal(localIdFromIri(""), null)
  assert.equal(localIdFromIri(null), null)
  assert.equal(localIdFromIri("   "), null)
})

test("httpError carries the status and payload the error handler needs", () => {
  const err = httpError("nope", 409, { conflict: true })
  assert.equal(err.message, "nope")
  assert.equal(err.status, 409)
  assert.deepEqual(err.payload, { conflict: true })
  assert.equal(httpError("bare").status, 500)
  // No payload means no `payload` key at all, so the error handler cannot emit `"payload": null`.
  assert.equal("payload" in httpError("bare"), false)
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
