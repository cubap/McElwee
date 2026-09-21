import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { run as buildBurials } from "./build-burials.js"
import { run as buildAtlas } from "./build-atlas.js"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const dist = path.join(root, "dist")
const publicSite = path.join(dist, "web")

/**
 * The published site is copied out of web/ verbatim. It stays at dist/web/ rather than
 * dist/ so the existing https://cubap.github.io/McElwee/web/ links keep resolving.
 */
const REDIRECT_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>McElwee Cemetery</title>
<meta http-equiv="refresh" content="0; url=./web/">
<link rel="canonical" href="./web/">
</head>
<body>
<p>The McElwee Cemetery exhibit has moved to <a href="./web/">./web/</a>.</p>
</body>
</html>
`

/**
 * Things that must never reach GitHub Pages. The entry subsite is mounted by the dev
 * server from entry/ and is deliberately absent from this build, so a leak here would
 * mean somebody published a way to edit the cemetery records.
 */
const FORBIDDEN_PATTERNS = [
  { pattern: /http:\/\/(devstore|store|tinydev)\.rerum\.io/i, label: "insecure RERUM URL (issue #13: mixed content)" },
  { pattern: /\bmc-edit-form\b/, label: "edit form container" },
  { pattern: /\bpersonForm\b/, label: "person edit template" },
  { pattern: /\bcreatePerson\b|\beditPerson\b/, label: "write handler" },
  { pattern: /\bmc-data-entry\b/, label: "data-entry input" },
  { pattern: /ACCESS_TOKEN|REFRESH_TOKEN/, label: "credential reference" }
]

// Byte-identical copies of the burial plates the index already cites from manifest/fotki/.
// They are the working download folder, not published assets, so shipping them would only
// double the weight of the photographs on Pages.
const SKIP_DIRS = [path.join("manifest", "fotki", "burials")]

function copyDir(from, to, rel = "") {
  fs.mkdirSync(to, { recursive: true })
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name)
    const dest = path.join(to, entry.name)
    const nested = rel ? path.join(rel, entry.name) : entry.name
    if (entry.isDirectory()) {
      if (SKIP_DIRS.includes(nested)) continue
      copyDir(src, dest, nested)
    } else fs.copyFileSync(src, dest)
  }
}

function walk(dir, base = dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(abs, base))
    else out.push(path.relative(base, abs).split(path.sep).join("/"))
  }
  return out
}

function guard() {
  const problems = []
  for (const rel of walk(publicSite)) {
    if (!/\.(js|html|css|json)$/.test(rel)) continue
    const text = fs.readFileSync(path.join(publicSite, rel), "utf8")
    for (const { pattern, label } of FORBIDDEN_PATTERNS) {
      const match = text.match(pattern)
      if (match) {
        const line = text.slice(0, match.index).split("\n").length
        problems.push(`dist/web/${rel}:${line} contains ${label} -> ${match[0]}`)
      }
    }
  }
  if (fs.existsSync(path.join(dist, "entry"))) {
    problems.push("dist/entry/ exists; the entry subsite must never be published")
  }
  if (problems.length) {
    console.error("Build refused: the published site is not read-only.\n" + problems.map((p) => `  - ${p}`).join("\n"))
    process.exitCode = 1
    return false
  }
  return true
}

fs.rmSync(dist, { recursive: true, force: true })

// The burial index is published data, not source: generate it into web/ first so the copy
// below picks it up and the guard below is able to read it.
try {
  buildBurials()
  buildAtlas()
} catch (e) {
  console.error(`Build refused: ${e.message}`)
  process.exitCode = 1
}

copyDir(path.join(root, "web"), publicSite)
fs.writeFileSync(path.join(dist, "index.html"), REDIRECT_PAGE)

const files = walk(dist)
const bytes = files.reduce((sum, f) => sum + fs.statSync(path.join(dist, f)).size, 0)
console.log(`Built ${files.length} files (${(bytes / 1024).toFixed(1)} KB) into dist/`)
console.log(`  site    dist/web/  ->  https://cubap.github.io/McElwee/web/`)
console.log(`  redirect dist/index.html`)

if (!guard()) {
  console.error("\nFix the items above and run `npm run build` again.")
} else {
  console.log("  guard     read-only: no edit controls, no hard-coded endpoints")
}
