import assert from "node:assert/strict"
import test from "node:test"

import {
  AGENT_CLAIM,
  SHARED_SANDBOX_AGENT,
  agentIriFromToken,
  decodeJwtPayload,
  inspectAgent,
  isTokenExpired,
  tokenExpiryMs
} from "../server/agent.js"

export function makeToken(payload) {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url")
  return `${b64({ alg: "none", typ: "JWT" })}.${b64(payload)}.`
}

const HOUR = 3600_000

test("decodes the agent IRI from the RERUM claim", () => {
  const token = makeToken({ [AGENT_CLAIM]: "http://store.rerum.io/v1/id/mcelwee-agent", exp: 9999999999 })
  assert.equal(agentIriFromToken(token), "http://store.rerum.io/v1/id/mcelwee-agent")
})

test("falls back to azp then client_id for tokens without the RERUM claim", () => {
  assert.equal(agentIriFromToken(makeToken({ azp: "mcelwee-client" })), "mcelwee-client")
  assert.equal(agentIriFromToken(makeToken({ client_id: "mcelwee-app" })), "mcelwee-app")
})

test("returns null rather than throwing on junk tokens", () => {
  for (const junk of [undefined, null, "", "not-a-jwt", "a.!!!.b"]) {
    assert.equal(decodeJwtPayload(junk), null)
    assert.equal(agentIriFromToken(junk), null)
  }
})

test("reads expiry and detects a past-dated token", () => {
  const exp = Math.floor((Date.now() + HOUR) / 1000)
  assert.equal(isTokenExpired(makeToken({ exp }), Date.now()), false)
  assert.equal(isTokenExpired(makeToken({ exp: 1 }), Date.now()), true)
  assert.equal(tokenExpiryMs(makeToken({ exp })), exp * 1000)
})

test("an unreadable token is left for the upstream call to reject", () => {
  assert.equal(isTokenExpired("garbage"), false)
})

test("no credentials means reads only, with instructions", () => {
  const status = inspectAgent({ accessToken: "", refreshToken: "", expectedAgentIri: "" })
  assert.equal(status.registered, false)
  assert.match(status.problem, /No RERUM credentials/)
  assert.match(status.problem, /sample\.env/)
})

test("the shared sandbox agent is refused, because that is the bug #18 is fixing", () => {
  const status = inspectAgent({
    accessToken: makeToken({ [AGENT_CLAIM]: SHARED_SANDBOX_AGENT }),
    refreshToken: "r",
    expectedAgentIri: ""
  })
  assert.equal(status.isSharedSandbox, true)
  assert.match(status.problem, /sandbox@rerum\.io/)
})

test("a project agent that matches EXPECTED_AGENT_IRI is clean", () => {
  const iri = "http://store.rerum.io/v1/id/abc123"
  const status = inspectAgent({ accessToken: makeToken({ [AGENT_CLAIM]: iri }), refreshToken: "r", expectedAgentIri: iri })
  assert.equal(status.problem, null)
  assert.equal(status.agentIri, iri)
})

test("a token that does not match EXPECTED_AGENT_IRI is reported", () => {
  const status = inspectAgent({
    accessToken: makeToken({ [AGENT_CLAIM]: "http://store.rerum.io/v1/id/someone-else" }),
    refreshToken: "r",
    expectedAgentIri: "http://store.rerum.io/v1/id/mcelwee"
  })
  assert.equal(status.matchesExpected, false)
  assert.match(status.problem, /does not match EXPECTED_AGENT_IRI/)
})
