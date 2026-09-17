import assert from "node:assert/strict"
import path from "node:path"
import test from "node:test"

import request from "supertest"

import { createApp } from "../server/app.js"
import { AGENT_CLAIM, SHARED_SANDBOX_AGENT } from "../server/agent.js"

const PROJECT_AGENT = "http://store.rerum.io/v1/id/mcelwee-agent"
const API_ADDR = "https://devstore.test/v1/api/"

function makeToken(payload) {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url")
  return `${b64({ alg: "none", typ: "JWT" })}.${b64(payload)}.`
}

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
 * Build an app whose upstream calls are captured instead of sent, so the proxy contract
 * (status codes, validation, headers, which URL was hit) can be asserted offline.
 */
function harness({ accessToken = makeToken({ [AGENT_CLAIM]: PROJECT_AGENT, exp: 9999999999 }), refreshToken = "refresh-secret", expectedAgentIri = PROJECT_AGENT, responder } = {}) {
  const calls = []
  const original = globalThis.fetch
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options })
    return responder ? responder(String(url), options, calls.length - 1) : jsonResponse({ received: true })
  }
  const config = {
    port: 0,
    origin: "http://localhost:3030",
    userAgent: "McElwee-TinyNode/1.0",
    apiAddr: API_ADDR,
    idPattern: "https://devstore.test/v1/id/",
    registrationUrl: "https://devstore.test/",
    accessTokenUrl: "https://store.test/client/request-new-access-token",
    timeoutMs: 5000,
    accessToken,
    refreshToken,
    expectedAgentIri,
    requireAgentIri: true,
    openApiCors: false
  }
  const app = createApp({ config, logger: { info() {}, warn() {}, error() {} }, envPath: path.join("test", "fixtures", "missing.env") })
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

test("status describes the three things the server offers", async () => {
  const h = harness()
  const res = await request(h.app).get("/status").expect(200)
  assert.deepEqual(res.body.proxy, ["/query", "/create", "/update", "/delete", "/overwrite"])
  assert.equal(res.body.readOnlySite, "/web/")
  assert.equal(res.body.entrySubsite, "/entry/")
  h.restore()
})

test("GET /agent reports the identity the proxy writes as", async () => {
  const h = harness()
  const res = await request(h.app).get("/agent").expect(200)
  assert.equal(res.body.agentIri, PROJECT_AGENT)
  assert.equal(res.body.problem, null)
  h.restore()
})

test("query refuses a non-JSON content type before RERUM is contacted", async () => {
  const h = harness()
  const res = await request(h.app).post("/query").set("Content-Type", "application/x-www-form-urlencoded").send("target=abc").expect(415)
  assert.match(res.body.error, /Unsupported Content-Type/)
  assert.equal(h.calls.length, 0)
  h.restore()
})

test("query refuses an empty query so nobody can dump the store", async () => {
  const h = harness()
  for (const body of [{}, []]) {
    const res = await request(h.app).post("/query").send(body).expect(400)
    assert.match(res.body.error, /empty query/i)
  }
  assert.equal(h.calls.length, 0)
  h.restore()
})

test("query rejects a negative or fractional limit", async () => {
  const h = harness()
  const res = await request(h.app).post("/query").query({ limit: "-5" }).send({ "@type": "Person" }).expect(400)
  assert.match(res.body.error, /limit/)
  h.restore()
})

test("query relays results, pagination headers, and identifies this app upstream", async () => {
  const records = [{ "@id": "https://devstore.test/v1/id/abc", "@type": "Person" }]
  const h = harness({
    responder: () => jsonResponse(records, { headers: { "Pagination-Limit": "10", "Pagination-Skip": "0" } })
  })
  const res = await request(h.app).post("/query").query({ limit: 10 }).send({ target: "abc" }).expect(200)
  assert.deepEqual(res.body, records)
  assert.equal(res.headers["pagination-limit"], "10")
  assert.match(res.headers["content-type"], /^application\/ld\+json/)

  const call = h.last()
  assert.equal(call.url, `${API_ADDR}query?limit=10`)
  assert.equal(call.options.method, "POST")
  assert.equal(call.options.headers["User-Agent"], "McElwee-TinyNode/1.0")
  assert.equal(call.options.headers.Authorization, `Bearer ${h.config.accessToken}`)
  assert.equal(call.options.headers.Origin, "http://localhost:3030")
  assert.deepEqual(JSON.parse(call.options.body), { target: "abc" })
  h.restore()
})

test("the legacy /app/query path still works", async () => {
  const h = harness()
  await request(h.app).post("/app/query").send({ target: "abc" }).expect(200)
  assert.equal(h.last().url, `${API_ADDR}query`)
  h.restore()
})

test("create is refused when the token belongs to the shared sandbox agent", async () => {
  const h = harness({ accessToken: makeToken({ [AGENT_CLAIM]: SHARED_SANDBOX_AGENT }), expectedAgentIri: "" })
  const res = await request(h.app).post("/create").send({ "@type": "Person", name: "Test" }).expect(403)
  assert.match(res.body.error, /sandbox@rerum\.io/)
  assert.equal(h.calls.length, 0, "the sandbox token must never reach the store")
  h.restore()
})

test("create is refused with a clear message when no credentials are configured", async () => {
  const h = harness({ accessToken: "", refreshToken: "" })
  const res = await request(h.app).post("/create").send({ "@type": "Person" }).expect(401)
  assert.match(res.body.error, /sample\.env/)
  h.restore()
})

test("reads still work without credentials", async () => {
  const h = harness({ accessToken: "", refreshToken: "" })
  await request(h.app).post("/query").send({ target: "abc" }).expect(200)
  assert.equal(h.last().options.headers.Authorization, undefined)
  h.restore()
})

test("create pins a client-supplied id and answers with Location", async () => {
  const created = { "@id": "https://devstore.test/v1/id/newrec", "@type": "Person" }
  const h = harness({ responder: () => jsonResponse(created, { status: 201 }) })
  const res = await request(h.app)
    .post("/create")
    .send({ "@id": "https://devstore.test/v1/id/newrec", "@type": "Person", name: "New" })
    .expect(201)
  assert.equal(res.headers.location, created["@id"])
  const call = h.last()
  assert.equal(call.url, `${API_ADDR}create`)
  assert.deepEqual(JSON.parse(call.options.body), { _id: "newrec", "@type": "Person", name: "New" })
  h.restore()
})

test("create without an id is forwarded untouched", async () => {
  const h = harness()
  await request(h.app).post("/create").send({ "@type": "Person", name: "Plain" }).expect(200)
  assert.deepEqual(JSON.parse(h.last().options.body), { "@type": "Person", name: "Plain" })
  h.restore()
})

test("update and overwrite require an id so a typo cannot create an orphan", async () => {
  const h = harness()
  for (const route of ["/update", "/overwrite"]) {
    const res = await request(h.app).put(route).send({ body: { name: "x" } }).expect(400)
    assert.match(res.body.error, /"@id" or "id"/)
  }
  assert.equal(h.calls.length, 0)
  h.restore()
})

test("update PUTs to the store and relays the new state", async () => {
  const state = { "@id": "https://devstore.test/v1/id/abc", new_obj_state: { "@id": "https://devstore.test/v1/id/abc" } }
  const h = harness({ responder: () => jsonResponse(state) })
  const res = await request(h.app).put("/update").send({ "@id": state["@id"], body: { name: "Fixed" } }).expect(200)
  assert.deepEqual(res.body, state)
  assert.equal(h.last().url, `${API_ADDR}update`)
  assert.equal(h.last().options.method, "PUT")
  h.restore()
})

test("delete reduces the IRI to a local id and answers 204", async () => {
  const h = harness({ responder: () => jsonResponse("", { status: 200 }) })
  await request(h.app).delete("/delete/https:%2F%2Fdevstore.test%2Fv1%2Fid%2Fabc").expect(204)
  assert.equal(h.last().url, `${API_ADDR}delete%2Fabc`.replace("%2F", "/"))
  assert.equal(h.last().options.method, "DELETE")
  h.restore()
})

test("delete without an id is a client error", async () => {
  const h = harness()
  const res = await request(h.app).delete("/delete").expect(400)
  assert.match(res.body.error, /requires an id/)
  h.restore()
})

test("an expired access token is refreshed once and the new one is used upstream", async () => {
  const fresh = makeToken({ [AGENT_CLAIM]: PROJECT_AGENT, exp: 9999999999 })
  const h = harness({
    accessToken: makeToken({ [AGENT_CLAIM]: PROJECT_AGENT, exp: 1 }),
    responder: (url) => (url.includes("request-new-access-token") ? jsonResponse({ access_token: fresh }) : jsonResponse({ ok: true }))
  })
  await request(h.app).post("/query").send({ target: "abc" }).expect(200)
  assert.equal(h.calls.length, 2)
  assert.match(h.calls[0].url, /request-new-access-token/)
  assert.deepEqual(JSON.parse(h.calls[0].options.body), { refresh_token: "refresh-secret" })
  assert.equal(h.last().options.headers.Authorization, `Bearer ${fresh}`)
  assert.equal(h.config.accessToken, fresh)
  h.restore()
})

test("upstream failures are relayed with the store's status", async () => {
  const h = harness({ responder: () => jsonResponse({ error: "not found" }, { status: 404 }) })
  const res = await request(h.app).post("/query").send({ target: "abc" }).expect(404)
  assert.deepEqual(res.body, { error: "not found" })
  h.restore()
})

test("an unreachable store becomes 502 rather than a hung request", async () => {
  const h = harness({
    responder: () => {
      throw Object.assign(new Error("connect ECONNREFUSED"), { name: "TypeError" })
    }
  })
  const res = await request(h.app).post("/query").send({ target: "abc" })
  assert.equal(res.status, 502)
  assert.match(res.body.error, /Unable to reach RERUM/)
  h.restore()
})

test("unknown routes 404 instead of falling through to the static site", async () => {
  const h = harness()
  const res = await request(h.app).get("/nope").expect(404)
  assert.match(res.body.error, /No McElwee route matches/)
  h.restore()
})
