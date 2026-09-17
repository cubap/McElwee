import fs from "node:fs"
import http from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const dist = path.join(root, "dist")
const port = Number.parseInt(process.env.PORT || "4000", 10)

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jsonld": "application/ld+json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
}

/**
 * Serve exactly what `npm run build` produced, with no proxy and no entry subsite, so
 * what you see here is what GitHub Pages will show.
 */
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split("?")[0])
  let file = path.normalize(path.join(dist, urlPath))
  if (!file.startsWith(dist)) {
    res.writeHead(403).end("Forbidden")
    return
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html")
  if (!fs.existsSync(file)) {
    res.writeHead(404, { "Content-Type": "text/plain" }).end(`Not in dist/: ${urlPath}`)
    return
  }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" })
  fs.createReadStream(file).pipe(res)
})

if (!fs.existsSync(dist)) {
  console.error("dist/ is missing. Run `npm run build` first.")
  process.exit(1)
}

server.listen(port, () => {
  console.log(`[mcelwee] published-site preview  http://localhost:${port}/web/`)
  console.log(`[mcelwee] serving read-only files from dist/ (no proxy, no /entry/)`)
})
