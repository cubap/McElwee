import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import vm from "node:vm"

import { readConfig } from "../server/config.js"

const root = path.resolve(import.meta.dirname, "..")
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8")

/**
 * web/config.js is a plain script, not a module, because the exhibit's global-function
 * style is issue #15's problem to solve. Loading it into a VM with a fake window is how
 * we can still assert its behaviour here.
 */
function loadConfig(hostname, origin) {
  const sandbox = {
    window: { location: { hostname, origin } },
    console
  }
  sandbox.window.window = sandbox.window
  vm.createContext(sandbox)
  new vm.Script(read("web", "config.js"), { filename: "web/config.js" }).runInContext(sandbox)
  return sandbox.window.McElweeConfig
}

test("config.js is a classic script that publishes McElweeConfig", () => {
  const cfg = loadConfig("cubap.github.io", "https://cubap.github.io")
  assert.equal(typeof cfg.normalizeId, "function")
  assert.ok(cfg.DEFAULT_LIST_ID)
  assert.ok(cfg.EVIDENCE_ID)
})

test("the published site talks to RERUM over https only", () => {
  const cfg = loadConfig("cubap.github.io", "https://cubap.github.io")
  assert.equal(cfg.servedLocally, false)
  for (const url of [cfg.DEFAULT_LIST_ID, cfg.EVIDENCE_ID, cfg.QUERY_URL, cfg.CREATE_URL, cfg.UPDATE_URL, cfg.BASE_ID]) {
    assert.match(url, /^https:\/\//, `${url} must be https`)
  }
})

test("on the dev server the site uses the local proxy, not the store directly", () => {
  const cfg = loadConfig("localhost", "http://localhost:3030")
  assert.equal(cfg.servedLocally, true)
  assert.equal(cfg.QUERY_URL, "http://localhost:3030/query")
  assert.equal(cfg.CREATE_URL, "http://localhost:3030/create")
  assert.equal(cfg.AGENT_URL, "http://localhost:3030/agent")
})

test("normalizeId upgrades the http:// IRIs RERUM embeds in itemListElement", () => {
  const cfg = loadConfig("cubap.github.io", "https://cubap.github.io")
  // The live Cemetery Population list hands back http:// ids even though the same
  // record is served over https; without this the browser blocks the fetch as mixed
  // content and issue #13 comes straight back.
  assert.equal(
    cfg.normalizeId("http://devstore.rerum.io/v1/id/5bc8089ce4b09992fca2222c"),
    "https://devstore.rerum.io/v1/id/5bc8089ce4b09992fca2222c"
  )
  assert.equal(cfg.normalizeId("http://store.rerum.io/v1/id/x"), "https://store.rerum.io/v1/id/x")
  assert.equal(cfg.normalizeId("http://tinydev.rerum.io/app/query"), "https://tinydev.rerum.io/app/query")
  assert.equal(cfg.normalizeId("  http://devstore.rerum.io/v1/id/x  "), "https://devstore.rerum.io/v1/id/x")
})

test("normalizeId leaves everything else alone", () => {
  const cfg = loadConfig("cubap.github.io", "https://cubap.github.io")
  assert.equal(cfg.normalizeId("http://public.fotki.com/a/b.jpg"), "http://public.fotki.com/a/b.jpg")
  assert.equal(cfg.normalizeId("http://gnis-ld.org/lod/gnis/feature/722098"), "http://gnis-ld.org/lod/gnis/feature/722098")
  assert.equal(cfg.normalizeId("l001"), "l001")
  assert.equal(cfg.normalizeId("https://devstore.rerum.io/v1/id/x"), "https://devstore.rerum.io/v1/id/x")
  assert.equal(cfg.normalizeId(null), null)
  assert.equal(cfg.normalizeId(undefined), undefined)
})

test("isRerumId separates store IRIs from the short local ids in mcdata.js", () => {
  const cfg = loadConfig("cubap.github.io", "https://cubap.github.io")
  assert.equal(cfg.isRerumId("https://devstore.rerum.io/v1/id/x"), true)
  assert.equal(cfg.isRerumId("http://devstore.rerum.io/v1/id/x"), true)
  assert.equal(cfg.isRerumId("p001"), false)
  assert.equal(cfg.isRerumId("http://example.org/x"), false)
})

test("idVariants yields both spellings a legacy annotation might target", () => {
  const cfg = loadConfig("cubap.github.io", "https://cubap.github.io")
  // Verified against the live store: the Person resolves over https, but the
  // annotations describing it carry target "http://devstore.rerum.io/v1/id/...".
  // A query that sends only the https form comes back empty and the exhibit renders
  // every person with no field values.
  assert.deepEqual(
    // Array.from: config.js runs in a vm context, so its arrays carry a different
    // Array.prototype than the literals below and deepStrictEqual would reject them.
    Array.from(cfg.idVariants("https://devstore.rerum.io/v1/id/5bc7f853e4b09992fca2220e")),
    [
      "https://devstore.rerum.io/v1/id/5bc7f853e4b09992fca2220e",
      "http://devstore.rerum.io/v1/id/5bc7f853e4b09992fca2220e"
    ]
  )
  // Same record, whichever spelling it arrived in.
  assert.deepEqual(
    cfg.idVariants("http://devstore.rerum.io/v1/id/x"),
    cfg.idVariants("https://devstore.rerum.io/v1/id/x")
  )
  assert.deepEqual(Array.from(cfg.idVariants("p001")), [])
  assert.deepEqual(Array.from(cfg.idVariants("http://example.org/x")), [])
})

test("annotation lookups try every id spelling", () => {
  // Guards against a refactor quietly dropping back to a single-target query.
  assert.match(read("web", "app.js"), /CFG\.idVariants\(/)
  assert.match(read("entry", "entry.js"), /CFG\.idVariants\(/)
})

test("no insecure RERUM URL survives anywhere in the site or the subsite", () => {
  const offenders = []
  for (const dir of ["web", "entry"]) {
    for (const name of fs.readdirSync(path.join(root, dir))) {
      if (!/\.(js|html|css|json)$/.test(name)) continue
      const text = read(dir, name)
      const match = text.match(/http:\/\/(devstore|store|tinydev)\.rerum\.io/g)
      if (match) offenders.push(`${dir}/${name}: ${[...new Set(match)].join(", ")}`)
    }
  }
  assert.deepEqual(offenders, [], `issue #13: these must be https\n${offenders.join("\n")}`)
})

test("the published exhibit carries no edit controls", () => {
  const html = read("web", "index.html")
  const app = read("web", "app.js")
  assert.doesNotMatch(html, /mc-edit-form/)
  assert.doesNotMatch(html, /<form/)
  assert.match(html, /<script src="config\.js"><\/script>\s*\n\s*<script src="app\.js">/, "config.js must load before app.js")
  for (const forbidden of [/personForm/, /createPerson/, /editPerson/, /mc-data-entry/, /<form/]) {
    assert.doesNotMatch(app, forbidden, `app.js must not contain ${forbidden}`)
  }
  assert.doesNotMatch(app, /\bBASE_ID\b/, "endpoints belong in config.js")
  assert.doesNotMatch(app, /https?:\/\/(devstore|store|tinydev)\.rerum\.io/, "endpoints belong in config.js")
})

test("the entry subsite is the only place writes are issued from", () => {
  const entry = read("entry", "entry.js")
  assert.match(entry, /CFG\.CREATE_URL/)
  assert.match(entry, /CFG\.UPDATE_URL/)
  assert.match(entry, /CFG\.DELETE_URL/)
  assert.match(entry, /CFG\.EVIDENCE_ID/)
  // Writes go to the proxy, which is same-origin on the dev server.
  assert.doesNotMatch(entry, /fetch\(["'`]https?:\/\//)
})

test("the server's default upstream is the devstore instance the records live on", () => {
  const config = readConfig({})
  assert.equal(config.apiAddr, "https://devstore.rerum.io/v1/api/")
  assert.equal(config.port, 3030)
  assert.match(config.userAgent, /McElwee/)
})

test("a trailing slash in RERUM_API_ADDR is not required", () => {
  assert.equal(readConfig({ RERUM_API_ADDR: "https://store.rerum.io/v1/api" }).apiAddr, "https://store.rerum.io/v1/api/")
})
