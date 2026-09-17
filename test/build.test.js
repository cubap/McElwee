import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

const root = path.resolve(import.meta.dirname, "..")
const dist = path.join(root, "dist")

function build() {
  return execFileSync(process.execPath, ["scripts/build.js"], { cwd: root, encoding: "utf8" })
}

test("npm run build produces the published site at dist/web/", () => {
  const output = build()
  assert.match(output, /guard\s+read-only/)

  // The live URL is https://cubap.github.io/McElwee/web/; the build must not move it.
  assert.ok(fs.existsSync(path.join(dist, "web", "index.html")))
  assert.ok(fs.existsSync(path.join(dist, "web", "app.js")))
  assert.ok(fs.existsSync(path.join(dist, "web", "config.js")))
  assert.ok(fs.existsSync(path.join(dist, "web", "mc.css")))
  assert.ok(fs.existsSync(path.join(dist, "web", "mcdata.js")))
  assert.ok(fs.existsSync(path.join(dist, "web", "manifest", "mcelwee.json")))
  assert.match(output, /https:\/\/cubap\.github\.io\/McElwee\/web\//)
})

test("the root of the build redirects to the exhibit instead of duplicating it", () => {
  build()
  const redirect = fs.readFileSync(path.join(dist, "index.html"), "utf8")
  assert.match(redirect, /url=\.\/web\//)
  assert.match(redirect, /href="\.\/web\/"/)
})

test("the entry subsite and the proxy are absent from the build", () => {
  build()
  assert.equal(fs.existsSync(path.join(dist, "entry")), false)
  assert.equal(fs.existsSync(path.join(dist, "server")), false)
  const files = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(abs)
      else files.push(abs)
    }
  }
  walk(dist)
  const leaked = files.filter((f) => /server|entry|\.env$/.test(path.relative(dist, f).replace(/\\/g, "/")))
  assert.deepEqual(leaked, [])
})

test("the build refuses to publish edit controls", () => {
  const probe = path.join(root, "web", "__guard_probe__.html")
  try {
    fs.writeFileSync(probe, '<div id="mc-edit-form"></div>\n')
    let failed = false
    try {
      build()
    } catch (error) {
      failed = true
      assert.match(String(error.stderr ?? error.message), /edit form container/)
      assert.match(String(error.stderr ?? error.message), /__guard_probe__/)
    }
    assert.ok(failed, "build must exit non-zero when the site is not read-only")
  } finally {
    fs.rmSync(probe, { force: true })
    assert.equal(fs.existsSync(probe), false)
    build()
  }
})

test("the build refuses to publish an insecure RERUM URL", () => {
  const probe = path.join(root, "web", "__guard_probe__.js")
  try {
    fs.writeFileSync(probe, "var u = 'http://devstore.rerum.io/v1/api/query'\n")
    let message = ""
    try {
      build()
    } catch (error) {
      message = String(error.stderr ?? error.message)
    }
    assert.match(message, /insecure RERUM URL/)
  } finally {
    fs.rmSync(probe, { force: true })
    build()
  }
})
