import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import request from "supertest"

import { createApp } from "../server/app.js"
import { AGENT_CLAIM, SHARED_SANDBOX_AGENT } from "../server/agent.js"
import { isLoopback } from "../server/rest.js"
import { REFRESH_SKEW_MS } from "../server/tokens.js"

const PROJECT_AGENT = "http://store.rerum.io/v1/id/mcelwee-agent"
const API_ADDR = "https://devstore.test/v1/api/"
const TINYNODE_ADDR = "https://tinytest.test/"
const REFRESH_SECRET = "refresh-secret"

function makeToken(payload) {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url")
  return `${b64({ alg: "none", typ: "JWT" })}.${b64(payload)}.`
}

const hoursFromNow = (hours) => Math.floor(Date.now() / 1000) + hours * 3600

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  const all = new Headers({ "content-type": "application/ld+json", ...headers })
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: all,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body))
  }
}

/**
 * Build an app whose upstream calls are captured instead of sent, so the mint contract
 * (which credential it will and will not hand out, and when it refreshes) can be asserted
 * offline. `envPath` points at a file that does not exist unless a test wants the write.
 */
function harness({
  accessToken = makeToken({ [AGENT_CLAIM]: PROJECT_AGENT, exp: hoursFromNow(1) }),
  refreshToken = REFRESH_SECRET,
  expectedAgentIri = PROJECT_AGENT,
  requireAgentIri = true,
  responder,
  envPath = path.join("test", "fixtures", "missing.env")
} = {}) {
  const calls = []
  const original = globalThis.fetch
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options })
    return responder ? responder(String(url), options, calls.length - 1) : jsonResponse({ received: true })
  }
  const config = {
    port: 0,
    origin: "http://localhost:3030",
    userAgent: "McElwee/1.0 (RERUM passthrough client)",
    apiAddr: API_ADDR,
    tinynodeAddr: TINYNODE_ADDR,
    idPattern: "https://devstore.test/v1/id/",
    registrationUrl: "https://devstore.test/",
    accessTokenUrl: "https://store.test/client/request-new-access-token",
    timeoutMs: 5000,
    accessToken,
    refreshToken,
    expectedAgentIri,
    requireAgentIri
  }
  const app = createApp({ config, logger: { info() {}, warn() {}, error() {} }, envPath })
  return {
    app,
    config,
    calls,
    last: () => calls[calls.length - 1],
    restore() {
      globalThis.fetch = original
    }
  }
}

/* --- the mint -------------------------------------------------------------- */

test("POST /token hands back the access token, its owner, and where to spend it", async () => {
  const h = harness()
  const res = await request(h.app).post("/token").expect(200)
  assert.equal(res.body.token, h.config.accessToken)
  assert.equal(res.body.agentIri, PROJECT_AGENT)
  assert.equal(res.body.tinynodeAddr, TINYNODE_ADDR)
  assert.ok(res.body.expiresAt)
  // The refresh token is the long-lived secret. It stays in the server.
  assert.doesNotMatch(JSON.stringify(res.body), /refresh-secret/)
  h.restore()
})

test("the mint is not readable cross-origin and is not cacheable", async () => {
  const h = harness()
  const res = await request(h.app).post("/token").set("Origin", "https://evil.example").expect(200)
  // Loopback-only is the first guard; without CORS headers a page on another origin cannot
  // read the response even when its browser can open the socket.
  assert.equal(res.headers["access-control-allow-origin"], undefined)
  assert.equal(res.headers["cache-control"], "no-store")
  h.restore()
})

test("the mint is POST-only, so a token cannot land in a URL-keyed log or cache", async () => {
  const h = harness()
  await request(h.app).get("/token").expect(404)
  assert.equal(h.calls.length, 0)
  h.restore()
})

test("no credentials means no token, with instructions", async () => {
  const h = harness({ accessToken: "", refreshToken: "" })
  const res = await request(h.app).post("/token").expect(401)
  assert.match(res.body.error, /sample\.env/)
  assert.equal(h.calls.length, 0)
  h.restore()
})

test("a token belonging to the shared sandbox agent is never handed out", async () => {
  const h = harness({
    accessToken: makeToken({ [AGENT_CLAIM]: SHARED_SANDBOX_AGENT, exp: hoursFromNow(1) }),
    expectedAgentIri: ""
  })
  const res = await request(h.app).post("/token").expect(403)
  assert.match(res.body.error, /sandbox@rerum\.io/)
  assert.equal(h.calls.length, 0, "the sandbox credential must never reach the store")
  h.restore()
})

test("a token that is not EXPECTED_AGENT_IRI is refused while the guard is on", async () => {
  const h = harness({ accessToken: makeToken({ [AGENT_CLAIM]: "http://store.rerum.io/v1/id/someone-else", exp: hoursFromNow(1) }) })
  const res = await request(h.app).post("/token").expect(403)
  assert.match(res.body.error, /EXPECTED_AGENT_IRI/)
  h.restore()
})

test("a token with most of its hour left is handed out without a refresh", async () => {
  const h = harness()
  await request(h.app).post("/token").expect(200)
  assert.equal(h.calls.length, 0, "a usable token must not burn a refresh")
  h.restore()
})

test("a nearly-expired token is traded for a fresh one before it is handed out", async () => {
  // A loader that starts with 30 seconds of token left would fail halfway through the batch,
  // so anything inside the skew window is refreshed up front rather than retried mid-run.
  const fresh = makeToken({ [AGENT_CLAIM]: PROJECT_AGENT, exp: hoursFromNow(1) })
  const nearlyDead = makeToken({ [AGENT_CLAIM]: PROJECT_AGENT, exp: Math.floor(Date.now() / 1000) + Math.floor(REFRESH_SKEW_MS / 2000) })
  const h = harness({
    accessToken: nearlyDead,
    responder: (url) => (url.includes("request-new-access-token") ? jsonResponse({ access_token: fresh }) : jsonResponse({ ok: true }))
  })
  const res = await request(h.app).post("/token").expect(200)
  assert.equal(h.calls.length, 1)
  assert.match(h.calls[0].url, /request-new-access-token/)
  assert.deepEqual(JSON.parse(h.calls[0].options.body), { refresh_token: REFRESH_SECRET })
  // The refresh endpoint is authenticated by the token in the body, not by an Authorization header.
  assert.equal(h.calls[0].options.headers.Authorization, undefined)
  assert.equal(res.body.token, fresh)
  assert.equal(h.config.accessToken, fresh)
  h.restore()
})

test("a rotated refresh token is written back to .env so the credential survives a restart", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcelwee-mint-"))
  const envPath = path.join(dir, ".env")
  fs.writeFileSync(envPath, "# keep this comment\nACCESS_TOKEN=old\nREFRESH_TOKEN=old-refresh\n", "utf8")
  const fresh = makeToken({ [AGENT_CLAIM]: PROJECT_AGENT, exp: hoursFromNow(1) })
  const h = harness({
    accessToken: makeToken({ [AGENT_CLAIM]: PROJECT_AGENT, exp: 1 }),
    envPath,
    responder: (url) =>
      url.includes("request-new-access-token")
        ? jsonResponse({ access_token: fresh, refresh_token: "rotated-refresh" })
        : jsonResponse({ ok: true })
  })
  await request(h.app).post("/token").expect(200)
  const written = fs.readFileSync(envPath, "utf8")
  assert.match(written, /^# keep this comment$/m, "the .env comments are the registration instructions")
  assert.match(written, /^ACCESS_TOKEN=.+$/m)
  assert.doesNotMatch(written, /^ACCESS_TOKEN=old$/m)
  assert.match(written, /^REFRESH_TOKEN=rotated-refresh$/m, "the retired refresh token must not be left behind")
  fs.rmSync(dir, { recursive: true, force: true })
  h.restore()
})

test("an expired token with no refresh token is a 401 that says what to do", async () => {
  const h = harness({ accessToken: makeToken({ [AGENT_CLAIM]: PROJECT_AGENT, exp: 1 }), refreshToken: "" })
  const res = await request(h.app).post("/token").expect(401)
  assert.match(res.body.error, /REFRESH_TOKEN/)
  h.restore()
})

test("an unreachable token endpoint becomes 502 rather than a hung request", async () => {
  const h = harness({
    accessToken: makeToken({ [AGENT_CLAIM]: PROJECT_AGENT, exp: 1 }),
    responder: () => {
      throw Object.assign(new Error("connect ECONNREFUSED"), { name: "TypeError" })
    }
  })
  const res = await request(h.app).post("/token")
  assert.equal(res.status, 502)
  assert.match(res.body.error, /Token refresh request failed/)
  h.restore()
})

/* --- the rest of the surface ---------------------------------------------- */

test("status describes the three things the server offers", async () => {
  const h = harness()
  const res = await request(h.app).get("/status").expect(200)
  assert.equal(res.body.readOnlySite, "/web/")
  assert.equal(res.body.entrySubsite, "/entry/")
  assert.equal(res.body.tokenMint, "/token")
  assert.equal(res.body.writesGoTo, TINYNODE_ADDR)
  assert.deepEqual(Array.from(res.body.writeRoutes), ["create", "update", "overwrite", "delete"])
  h.restore()
})

test("GET /agent reports the identity the mint hands out", async () => {
  const h = harness()
  const res = await request(h.app).get("/agent").expect(200)
  assert.equal(res.body.agentIri, PROJECT_AGENT)
  assert.equal(res.body.problem, null)
  assert.equal(res.body.tinynodeAddr, TINYNODE_ADDR)
  assert.equal(h.calls.length, 0, "a token with most of its hour left must not be refreshed")
  h.restore()
})

test("GET /agent refreshes a stale token instead of reporting it as expired", async () => {
  const fresh = makeToken({ [AGENT_CLAIM]: PROJECT_AGENT, exp: hoursFromNow(1) })
  const h = harness({
    accessToken: makeToken({ [AGENT_CLAIM]: PROJECT_AGENT, exp: 1 }),
    responder: (url) => (url.includes("request-new-access-token") ? jsonResponse({ access_token: fresh }) : jsonResponse({ ok: true }))
  })
  const res = await request(h.app).get("/agent").expect(200)
  assert.equal(res.body.problem, null)
  assert.equal(res.body.refreshError, null)
  assert.equal(h.config.accessToken, fresh)
  h.restore()
})

test("GET /agent reports a failed refresh rather than hiding it", async () => {
  const h = harness({
    accessToken: makeToken({ [AGENT_CLAIM]: PROJECT_AGENT, exp: 1 }),
    responder: () => jsonResponse({ error: "invalid_grant" }, { status: 400 })
  })
  const res = await request(h.app).get("/agent").expect(200)
  assert.match(res.body.refreshError, /refused to refresh/)
  h.restore()
})

test("the server no longer relays RERUM's verbs", async () => {
  // The point of passthrough is that these are somebody else's job now. If one reappears,
  // the repo has started reimplementing TinyNode again.
  const h = harness()
  for (const [method, route] of [["get", "/query"], ["post", "/query"], ["post", "/create"], ["put", "/update"], ["put", "/overwrite"], ["delete", "/delete/abc"], ["post", "/app/create"]]) {
    const res = await request(h.app)[method](route)
    assert.equal(res.status, 404, `${method.toUpperCase()} ${route} must not be served here`)
    assert.match(res.body.error, /No McElwee route matches/)
  }
  assert.equal(h.calls.length, 0)
  h.restore()
})

/* --- the loopback guard ---------------------------------------------------- */

test("isLoopback accepts every spelling of this machine", () => {
  for (const addr of ["127.0.0.1", "127.4.5.6", "127.255.255.254", "::1", "::ffff:127.0.0.1"]) {
    assert.equal(isLoopback({ socket: { remoteAddress: addr } }), true, `${addr} is loopback`)
  }
})

test("isLoopback refuses anything else, including a forged X-Forwarded-For", () => {
  for (const addr of ["10.0.0.5", "172.16.0.1", "192.168.1.2", "8.8.8.8", "2001:db8::1", "", undefined]) {
    assert.equal(isLoopback({ socket: { remoteAddress: addr } }), false, `${addr} is not loopback`)
  }
  // The header is the whole reason `req.ip` cannot be trusted here.
  const spoofed = { socket: { remoteAddress: "203.0.113.9" }, headers: { "x-forwarded-for": "127.0.0.1" }, ip: "127.0.0.1" }
  assert.equal(isLoopback(spoofed), false)
})

test("isLoopback reads the socket even when the request was built by a proxy", () => {
  assert.equal(isLoopback({}), false)
  assert.equal(isLoopback({ socket: {} }), false)
})
