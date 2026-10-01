import path from "node:path"
import { fileURLToPath } from "node:url"

import express from "express"

import { config as defaultConfig } from "./config.js"
import { ENV_PATH, mintAccessToken, generateNewAccessToken, tokenRemainingMs, REFRESH_SKEW_MS } from "./tokens.js"
import { inspectAgent, tokenExpiryMs } from "./agent.js"
import { httpError, isLoopback } from "./rest.js"
import { WRITE_ROUTES } from "./endpoints.js"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..")

const defaultLogger = {
  info: (...args) => console.log("[mcelwee]", ...args),
  warn: (...args) => console.warn("[mcelwee]", ...args),
  error: (...args) => console.error("[mcelwee]", ...args)
}

/**
 * The McElwee server: the read-only exhibit, the local-only entry subsite, and the token
 * mint that lets either of them write to RERUM through TinyNode's passthrough mode.
 *
 * This used to be a hand-written RERUM proxy. It is not one any more. TinyNode grew
 * `Authorization` header passthrough (PR #134, deployed to production on 2026-09-30),
 * which forwards a caller's token verbatim so the write is attributed to the McElwee agent
 * rather than to the instance. That made the /query, /create, /update, /delete and
 * /overwrite relays here redundant, and they have been deleted.
 *
 * What remains is the part no hosted service can do for us: keeping the refresh token on
 * this machine. The mint is the only thing that ever sees a credential, and it is the
 * single choke point for the attribution rule - it refuses to hand out a token belonging
 * to the shared sandbox agent, so a misattributed batch cannot even start.
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

  // What am I writing as? The entry subsite shows this and `npm run whoami` prints it.
  //
  // A nearly-expired access token is refreshed here rather than reported as expired.
  // RERUM access tokens are short-lived (an hour), so "expired" is the normal state of
  // whatever is sitting in .env and says nothing about whether the credentials are usable -
  // only the refresh endpoint knows that. Answering this route without trying leaves
  // `whoami` and the loader's preflight describing a credential that would have worked.
  app.get("/agent", async (req, res, next) => {
    const settings = req.app.locals.config
    try {
      const remaining = tokenRemainingMs(settings.accessToken)
      const stale = settings.refreshToken && (remaining === null || remaining < REFRESH_SKEW_MS)
      if (settings.accessToken && stale) {
        await generateNewAccessToken(settings, req.app.locals.envPath).catch((error) => {
          res.locals.refreshError = error.message
        })
      }
      res.json({
        ...inspectAgent(settings),
        apiAddr: settings.apiAddr,
        tinynodeAddr: settings.tinynodeAddr,
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

  // The mint: hand a short-lived access token to a caller on this machine, which puts it in
  // the Authorization header of its own writes to TinyNode.
  //
  // Two things keep this from being an open credential endpoint. It answers loopback peers
  // only, and the server sends no CORS headers, so a page on another origin cannot read the
  // response even if its browser can reach the socket. POST rather than GET, so a token
  // cannot end up in an access log or a cache keyed by URL.
  app.post("/token", async (req, res, next) => {
    if (!isLoopback(req)) {
      return next(httpError("The token mint only answers requests from this machine.", 403))
    }
    try {
      const minted = await mintAccessToken(req.app.locals.config, req.app.locals.envPath, {
        logger: req.app.locals.logger
      })
      res.set("Cache-Control", "no-store")
      // The caller learns where to send the write from the same answer that gives it the
      // token, so the TinyNode address lives in one place (server config) rather than in
      // every client.
      res.json({ ...minted, tinynodeAddr: req.app.locals.config.tinynodeAddr })
    } catch (error) {
      next(error)
    }
  })

  // Health check for the CI smoke test and for anyone wondering if the mint is up.
  app.get("/status", (req, res) => {
    res.json({
      ok: true,
      readOnlySite: "/web/",
      entrySubsite: "/entry/",
      tokenMint: "/token",
      writesGoTo: req.app.locals.config.tinynodeAddr,
      writeRoutes: WRITE_ROUTES
    })
  })

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
