import path from "node:path"
import { fileURLToPath } from "node:url"

import express from "express"

import { config as defaultConfig } from "./config.js"
import { ENV_PATH, requireAgent, generateNewAccessToken } from "./tokens.js"
import { inspectAgent, tokenExpiryMs, isTokenExpired } from "./agent.js"
import { createQueryRouter } from "./routes/query.js"
import { createCreateRouter } from "./routes/create.js"
import { createUpdateRouter } from "./routes/update.js"
import { createDeleteRouter } from "./routes/delete.js"
import { createOverwriteRouter } from "./routes/overwrite.js"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..")

const defaultLogger = {
  info: (...args) => console.log("[mcelwee]", ...args),
  warn: (...args) => console.warn("[mcelwee]", ...args),
  error: (...args) => console.error("[mcelwee]", ...args)
}

/**
 * The McElwee server: the read-only exhibit, the local-only entry subsite, and the
 * TinyNode-style RERUM proxy that replaces the retired Java servlets.
 *
 * Two things matter about how this is put together. The proxy is the only place a token
 * is ever held, so credentials stay on this machine and out of the Pages bundle. And the
 * entry subsite is mounted here rather than copied into `dist/`, which is what keeps the
 * published site free of edit controls.
 */
export function createApp({
  config = defaultConfig,
  logger = defaultLogger,
  envPath = ENV_PATH,
  staticDirs = { web: path.join(root, "web"), entry: path.join(root, "entry") }
} = {}) {
  const app = express()
  app.disable("x-powered-by")
  app.locals.config = config
  app.locals.logger = logger
  app.locals.envPath = envPath

  app.use(express.json({ limit: "2mb" }))
  app.use(express.text({ type: ["text/*"], limit: "2mb" }))
  app.use(express.urlencoded({ extended: true }))

  if (config.openApiCors) {
    app.use((req, res, next) => {
      res.set("Access-Control-Allow-Origin", "*")
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
      res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
      res.set("Access-Control-Expose-Headers", "Location, Pagination-Limit, Pagination-Skip")
      if (req.method === "OPTIONS") return res.status(204).end()
      next()
    })
  }

  // What am I writing as? The entry subsite shows this and `npm run whoami` prints it.
  //
  // An expired access token is refreshed here rather than reported as expired. RERUM access
  // tokens are short-lived (an hour), so "expired" is the normal state of whatever is sitting
  // in .env and says nothing about whether the credentials are usable - only the refresh
  // endpoint knows that. Answering this route without trying leaves `whoami` and the loader's
  // preflight describing a credential that would have worked.
  app.get("/agent", async (req, res, next) => {
    const settings = req.app.locals.config
    try {
      if (settings.accessToken && isTokenExpired(settings.accessToken) && settings.refreshToken) {
        await generateNewAccessToken(settings, req.app.locals.envPath).catch((error) => {
          res.locals.refreshError = error.message
        })
      }
      res.json({
        ...inspectAgent(settings),
        apiAddr: settings.apiAddr,
        idPattern: settings.idPattern,
        registrationUrl: settings.registrationUrl,
        expectedAgentIri: settings.expectedAgentIri || null,
        requireAgentIri: settings.requireAgentIri,
        refreshError: res.locals.refreshError || null,
        tokenExpiresAt: (() => {
          const ms = tokenExpiryMs(settings.accessToken)
          return ms ? new Date(ms).toISOString() : null
        })()
      })
    } catch (error) {
      next(error)
    }
  })

  // Health check for the CI smoke test and for anyone wondering if the proxy is up.
  app.get("/status", (req, res) => {
    res.json({ ok: true, readOnlySite: "/web/", entrySubsite: "/entry/", proxy: ["/query", "/create", "/update", "/delete", "/overwrite"] })
  })

  const writeGuard = requireAgent()
  const mounts = [
    ["/query", createQueryRouter()],
    ["/create", createCreateRouter()],
    ["/update", createUpdateRouter()],
    ["/delete", createDeleteRouter()],
    ["/overwrite", createOverwriteRouter()]
  ]
  // The Java app was reached at /tinyThings/* and the front end still has those URLs in
  // its history, so the legacy paths keep working against the new implementation.
  for (const [prefix, router] of mounts) {
    app.use(prefix, writeGuard, router)
    app.use(`/app${prefix}`, writeGuard, router)
  }

  app.use("/web", express.static(staticDirs.web, { extensions: ["html"] }))
  app.use("/entry", express.static(staticDirs.entry, { extensions: ["html"] }))
  app.get("/", (req, res) => res.redirect(302, "/web/"))

  app.use((req, res) => {
    res.status(404).json({ error: `No McElwee route matches ${req.method} ${req.originalUrl}` })
  })

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error)
    const status = Number.isInteger(error?.status) ? error.status : 500
    if (status >= 500) logger.error(error?.stack ?? error)
    else logger.warn(`${status} ${req.method} ${req.originalUrl}: ${error?.message}`)
    res.status(status).json({ error: error?.message ?? "Unexpected server error", ...(error?.payload ? { detail: error.payload } : {}) })
  })

  return app
}
