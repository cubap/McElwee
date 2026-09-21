import assert from "node:assert/strict"
import http from "node:http"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { execFile } from "node:child_process"
import { test } from "node:test"
import { promisify } from "node:util"

import { buildOperations, pageIndexImages, SITE_BASE } from "../scripts/burials-payloads.js"

const run = promisify(execFile)
const ROOT = path.resolve(import.meta.dirname, "..")

const EVIDENCE = {
  records: [
    {
      id: "BurialsAlpha001_1",
      sourcePage: "BurialsAlpha001",
      seq: 1,
      surname: "BLAND",
      givenName: "Claud H. B.",
      entryText: "Claud H. B. S/O J. H. and J. J. BLAND, died Dec. 2, 1883 - aged 1 Y.",
      evidence: { rect: { x0: 87, y0: 67, x1: 495, y1: 85, skew: 0 } },
      fields: { died: "Dec. 2, 1883", aged: "1 Y", relationship: "S/O", parents: "J. H. and J. J. BLAND" }
    },
    {
      id: "BurialsAlpha001_2",
      sourcePage: "BurialsAlpha001",
      seq: 2,
      surname: "BLAND",
      givenName: "Minnie Lee",
      entryText: "Minnie Lee D/O J. J. BLAND, died Sept. 13, 1880 - aged 2 Y.",
      evidence: { rect: { x0: 87, y0: 98, x1: 495, y1: 112, skew: 0 } },
      fields: { died: "Sept. 13, 1880", aged: "2 Y", relationship: "D/O", parents: "J. J. BLAND" }
    }
  ]
}

test("payloads match the shape the exhibit reads", () => {
  const { operations } = buildOperations(EVIDENCE, { BurialsAlpha001: "web/manifest/fotki/x.jpg" })
  const kinds = operations.map((o) => o.kind)
  assert.deepEqual(kinds, ["document", "person", "person", "annotation", "annotation", "list-append"])

  const person = operations.find((o) => o.kind === "person")
  assert.equal(person.payload["@context"], "http://schema.org")
  assert.equal(person.payload["@type"], "Person")
  assert.equal(person.payload.name, "Claud H. B. BLAND")
  assert.equal(person.payload.familyName, "BLAND")

  const anno = operations.find((o) => o.kind === "annotation")
  assert.equal(anno["@context"] || anno.payload["@context"], "http://www.w3.org/ns/anno.jsonld")
  assert.equal(anno.payload.motivation, "describing")
  // The exhibit queries `target` as a plain IRI string, so it must never become an object.
  assert.equal(typeof anno.payload.target, "string")
  assert.ok(anno.payload.target.startsWith("@person:"))

  const keys = anno.payload.body.map((b) => Object.keys(b)[0])
  assert.deepEqual(keys, ["description", "deathDate", "ageAtDeath", "relationship", "relatedTo"])
  for (const entry of anno.payload.body) {
    const claim = entry[Object.keys(entry)[0]]
    assert.ok(claim.value, "every claim carries a value")
    assert.equal(claim.evidence, "@burialIndex", "every claim cites the burial index document")
    assert.ok(claim.provenance.rect, "every claim carries the rectangle it was read from")
  }
})

test("a record with no derivable fields still asserts its verbatim line", () => {
  const sparse = { records: [{ id: "P_1", sourcePage: "P", seq: 1, surname: "X", givenName: "Y", entryText: "Y X", evidence: {}, fields: {} }] }
  const { operations } = buildOperations(sparse, {})
  const anno = operations.find((o) => o.kind === "annotation")
  assert.deepEqual(anno.payload.body.map((b) => Object.keys(b)[0]), ["description"])
})

/**
 * The index leaves the surname blank on dependents under a family head, so the transcription
 * carries it down. Two rules follow: the name must not double it, and the head row must be
 * kept as a link. `refId` may point forward, which is why persons are all written first.
 */
test("carried-down surnames are not doubled and family heads stay linked", () => {
  const family = {
    records: [
      { id: "P_2", sourcePage: "P", seq: 2, surname: "ROWLEY", givenName: "Sarah E.", entryText: "Sarah E., died 1901", evidence: {}, fields: { refId: "P_1", refName: "Joel R. ROWLEY ROWLEY", refCertainty: "high" } },
      { id: "P_1", sourcePage: "P", seq: 1, surname: "ROWLEY", givenName: "Joel R. ROWLEY", entryText: "Joel R. ROWLEY, died 1888", evidence: {}, fields: {} }
    ]
  }
  const { operations } = buildOperations(family, {})
  const heads = operations.filter((o) => o.kind === "person")
  assert.equal(heads.find((o) => o.localId === "P_1").payload.name, "Joel R. ROWLEY", "surname already in the given name is not appended again")
  assert.equal(heads.find((o) => o.localId === "P_2").payload.name, "Sarah E. ROWLEY")

  const anno = operations.find((o) => o.kind === "annotation" && o.localId === "P_2")
  const group = anno.payload.body.find((b) => b.familyGroup)
  assert.ok(group, "the dependent asserts its family group")
  assert.equal(group.familyGroup.value, "Joel R. ROWLEY", "the link is labelled with the head's clean name")
  assert.equal(group.familyGroup.provenance.familyHeadOf, "@person:P_1", "and carries a resolvable placeholder")
  assert.equal(group.familyGroup.provenance.certainty, "high")

  // The forward reference only resolves because every person precedes every annotation.
  const firstAnno = operations.findIndex((o) => o.kind === "annotation")
  const lastPerson = operations.map((o) => o.kind).lastIndexOf("person")
  assert.ok(lastPerson < firstAnno, "all persons are created before any annotation")
})

/**
 * A stand-in for the local proxy: /agent, /create, /update. It mints sequential IRIs the
 * way RERUM does so the loader's placeholder resolution and ledger are exercised for real.
 */
function startMock() {
  const store = {}
  let n = 0
  const listId = "http://127.0.0.1:0/id/LIST1"
  const server = http.createServer((req, res) => {
    let body = ""
    req.on("data", (c) => (body += c))
    req.on("end", () => {
      const send = (code, obj) => {
        res.writeHead(code, { "Content-Type": "application/json" })
        res.end(JSON.stringify(obj))
      }
      if (req.url === "/agent") {
        return send(200, { agentIri: "http://store.rerum.io/v1/id/AGENT", problem: null, apiAddr: "mock://", idPattern: "" })
      }
      if (req.url === "/create" && req.method === "POST") {
        const payload = JSON.parse(body)
        const iri = `http://127.0.0.1:0/id/${++n}`
        store[iri] = { ...payload, "@id": iri }
        return send(200, { "@id": iri })
      }
      if (req.url === "/update" && req.method === "PUT") {
        const payload = JSON.parse(body)
        store[payload["@id"]] = payload
        return send(200, { ok: true })
      }
      if (req.url.endsWith("/id/LIST1")) {
        return send(200, store[listId] || { "@id": listId, "@type": "ItemList", itemListElement: [], numberOfItems: 0 })
      }
      send(404, { error: `unhandled ${req.method} ${req.url}` })
    })
  })
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const base = `http://127.0.0.1:${server.address().port}`
      resolve({ base, store, close: () => new Promise((r) => server.close(r)) })
    })
  })
}

test("the loader writes, resolves placeholders, and is idempotent", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcelwee-load-"))
  const repo = path.join(dir, "repo")
  fs.mkdirSync(path.join(repo, "source", "burials-evidence"), { recursive: true })
  fs.mkdirSync(path.join(repo, "source", "handoff", "burials"), { recursive: true })
  // The loader resolves its sibling import and its data paths relative to cwd, so give the
  // sandbox a copy of both scripts at its root.
  for (const f of ["load-burials.js", "burials-payloads.js"]) {
    fs.copyFileSync(path.join(ROOT, "scripts", f), path.join(repo, f))
  }
  fs.writeFileSync(path.join(repo, "source", "burials-evidence", "burials-evidence.json"), JSON.stringify(EVIDENCE))
  fs.writeFileSync(path.join(repo, "source", "handoff", "burials", "rows.json"), JSON.stringify({ pages: [{ id: "BurialsAlpha001", image: "web/manifest/fotki/x.jpg" }] }))

  const mock = await startMock()
  const listIri = `${mock.base}/id/LIST1`
  const args = [path.join(repo, "load-burials.js"), "--execute", "--base", mock.base, "--list", listIri]
  const env = { ...process.env, NODE_NO_WARNINGS: "1" }

  const first = await run(process.execPath, args, { cwd: repo, env })
  assert.match(first.stdout, /wrote 6 operation/)

  const ledger = JSON.parse(fs.readFileSync(path.join(repo, "source", "burials-evidence", "load-ledger.json"), "utf8"))
  assert.equal(Object.keys(ledger.created).length, 5, "document + 2 people + 2 annotations")
  assert.ok(ledger.created["person:BurialsAlpha001_1"])
  assert.ok(ledger.created["annotation:BurialsAlpha001_1"], "the annotation is keyed apart from its person")

  // Nothing may ship with a placeholder still in it.
  for (const rec of Object.values(mock.store)) {
    const json = JSON.stringify(rec)
    assert.ok(!json.includes("@person:"), `unresolved placeholder in ${json.slice(0, 120)}`)
    assert.ok(!json.includes("@burialIndex"), `unresolved evidence ref in ${json.slice(0, 120)}`)
  }
  const anno = Object.values(mock.store).find((r) => r["@type"] === "Annotation")
  assert.equal(anno.target, ledger.created["person:BurialsAlpha001_1"])
  assert.equal(anno.body[0].description.evidence, ledger.created["@burialIndex"])

  const list = Object.values(mock.store).find((r) => r["@type"] === "ItemList")
  assert.equal(list.itemListElement.length, 2)
  assert.equal(list.numberOfItems, 2)

  const before = Object.keys(mock.store).length
  const second = await run(process.execPath, args, { cwd: repo, env })
  assert.match(second.stdout, /to write         : 0/)
  assert.equal(Object.keys(mock.store).length, before, "a re-run creates nothing new")

  await mock.close()
})

test("preflight refuses a token that names no agent", async () => {
  // The real failure: an identity-provider JWT in .env instead of the pair RERUM issued.
  // It decodes cleanly and looks like a credential, but carries no agent claim, so RERUM
  // would stamp 236 permanent records with nobody. EXPECTED_AGENT_IRI is blank in this
  // scenario, which is exactly the case where agent.problem stays null and a naive
  // guard would let the write through.
  const seen = []
  const server = http.createServer((req, res) => {
    seen.push(req.url)
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(
      JSON.stringify({
        agentIri: null,
        registered: true,
        isSharedSandbox: false,
        matchesExpected: true,
        problem: null,
        accessToken: true,
        tokenExpiresAt: "2099-01-01T00:00:00.000Z",
        apiAddr: "https://store.rerum.io/v1/"
      })
    )
  })
  await new Promise((r) => server.listen(0, "127.0.0.1", r))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    await assert.rejects(
      () => run(process.execPath, [path.join(ROOT, "scripts", "load-burials.js"), "--execute", "--base", base], { cwd: ROOT }),
      /no RERUM agent claim/
    )
    assert.deepEqual(seen, ["/agent"], "the refusal happens before any write is attempted")
  } finally {
    await new Promise((r) => server.close(r))
  }
})

test("provenance points at a photograph a consumer can actually open", () => {
  const rows = JSON.parse(fs.readFileSync(path.join(ROOT, "source", "handoff", "burials", "rows.json"), "utf8"))
  const evidence = JSON.parse(fs.readFileSync(path.join(ROOT, "source", "burials-evidence", "burials-evidence.json"), "utf8"))
  const { operations } = buildOperations(evidence, pageIndexImages(rows))

  const annotated = operations.filter((o) => o.kind === "annotation")
  assert.ok(annotated.length > 0, "no annotation was staged")

  let cited = 0
  for (const op of annotated) {
    for (const body of op.payload.body) {
      const provenance = Object.values(body)[0].provenance
      if (!provenance) continue
      const image = provenance.sourceImage
      assert.match(image, /^https:\/\//, `${op.localId} cites ${image}, which cannot be dereferenced`)
      assert.ok(image.startsWith(SITE_BASE), `${op.localId} cites ${image}, outside the published site`)
      // The URL has to correspond to a plate that ships, or the citation is a dead link.
      const local = path.join(ROOT, "web", image.slice(SITE_BASE.length).replace(/\//g, path.sep))
      assert.ok(fs.existsSync(local), `${op.localId} cites ${image}, which is not in the build`)
      cited++
    }
  }
  assert.ok(cited > 0, "no annotation carries provenance at all")
})
