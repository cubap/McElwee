import fs from "node:fs"
import http from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const port = Number.parseInt(process.env.PORT || "3031", 10)

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".csv": "text/csv; charset=utf-8"
}

/**
 * Hand transcription lives in one browser's localStorage, which a cleared profile or a
 * browser update destroys without warning. The proofreader mirrors every save here so the
 * work is a file that can be committed. Exactly one path is writable, and only this
 * local-only server can write it.
 */
const EDIT_FILE = path.join(root, "source", "burials-index", "proof-edits.json")
const MAX_BODY = 4 * 1024 * 1024

function saveEdits(req, res) {
  let body = ""
  req.on("data", (chunk) => {
    body += chunk
    if (body.length > MAX_BODY) {
      res.writeHead(413, { "Content-Type": "application/json" }).end('{"ok":false,"error":"too large"}')
      req.destroy()
    }
  })
  req.on("end", () => {
    let parsed
    try {
      parsed = JSON.parse(body)
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" }).end(`{"ok":false,"error":"invalid json"}`)
      return
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      res.writeHead(400, { "Content-Type": "application/json" }).end('{"ok":false,"error":"expected an object of edits"}')
      return
    }
    const payload = JSON.stringify({ savedAt: new Date().toISOString(), count: Object.keys(parsed).length, edits: parsed }, null, 2)
    const tmp = EDIT_FILE + ".tmp"
    try {
      fs.writeFileSync(tmp, payload)
      fs.renameSync(tmp, EDIT_FILE)
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" }).end(`{"ok":false,"error":${JSON.stringify(e.message)}}`)
      return
    }
    res.writeHead(200, { "Content-Type": "application/json" }).end(`{"ok":true,"bytes":${Buffer.byteLength(payload)},"count":${Object.keys(parsed).length}}`)
  })
}

/**
 * Serves the repository root so the burial-index proofreader can fetch its worksheet
 * and the mirrored Fotki scans side by side. `npm run build` publishes only web/, so
 * nothing under source/ ever reaches the site; this is a local-only tool server.
 */
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split("?")[0])
  if (req.method === "POST") {
    if (urlPath === "/save-edits") return saveEdits(req, res)
    res.writeHead(405).end("Method not allowed")
    return
  }
  let file = path.normalize(path.join(root, urlPath))
  if (!file.startsWith(root)) {
    res.writeHead(403).end("Forbidden")
    return
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    file = path.join(file, "source/burials-index/proof.html")
  }
  if (!fs.existsSync(file)) {
    res.writeHead(404, { "Content-Type": "text/plain" }).end(`Not found: ${urlPath}`)
    return
  }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" })
  fs.createReadStream(file).pipe(res)
})

server.listen(port, () => {
  console.log(`[mcelwee] burial index proofreader  http://localhost:${port}/source/burials-index/proof.html`)
  console.log(`[mcelwee] serving the repository root; this server is local-only and never deployed`)
})
