import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { config } from "./config.js"
import { fetchRerum, rerumHeaders } from "./rerum.js"
import { httpError } from "./rest.js"
import { inspectAgent, isTokenExpired } from "./agent.js"

const here = path.dirname(fileURLToPath(import.meta.url))
export const ENV_PATH = path.resolve(here, "..", ".env")

/**
 * Replace the value of one KEY in a .env file without touching anything else.
 *
 * The obvious dependency for this rewrites the file through a parser, which silently
 * deletes every comment in it. These files carry the registration instructions, so
 * comments survive here: we only swap the value on the matching key line, or append the
 * key if it is missing.
 */
export function patchEnvFile(contents, key, value) {
  const line = `${key}=${value}`
  const pattern = new RegExp(`^${key}=.*$`, "m")
  if (pattern.test(contents)) return contents.replace(pattern, line)
  const separator = contents.length === 0 || contents.endsWith("\n") ? "" : "\n"
  return `${contents}${separator}${line}\n`
}

export async function writeEnvValue(key, value, envPath = ENV_PATH) {
  if (!fs.existsSync(envPath)) return false
  const contents = fs.readFileSync(envPath, "utf8")
  const updated = patchEnvFile(contents, key, value)
  if (updated === contents) return true
  fs.writeFileSync(envPath, updated, "utf8")
  return true
}

let refreshing = null

/**
 * Trade the refresh token for a fresh access token and keep it in memory (and in .env,
 * when a .env exists) so a restart does not immediately need another refresh.
 *
 * Concurrent writes share one refresh instead of each burning a token.
 */
export function generateNewAccessToken(settings = config, envPath = ENV_PATH) {
  if (!settings.refreshToken) {
    return Promise.reject(
      httpError(
        "ACCESS_TOKEN is expired and no REFRESH_TOKEN is configured. Put a valid REFRESH_TOKEN in .env or re-register.",
        401
      )
    )
  }
  if (refreshing) return refreshing

  refreshing = (async () => {
    const url = settings.accessTokenUrl
    const body = JSON.stringify({ refresh_token: settings.refreshToken })
    const response = await fetchRerum(
      url,
      {
        method: "POST",
        headers: { ...rerumHeaders(body, settings), Authorization: "" },
        body
      },
      settings
    ).catch((error) => {
      throw httpError(`Token refresh request failed: ${error.message}`, 502)
    })

    const payload = response.payload
    const fresh =
      payload && typeof payload === "object"
        ? payload.access_token ?? payload.accessToken ?? payload.token
        : null

    if (!response.ok || !fresh) {
      const detail = typeof payload === "string" ? payload.slice(0, 200) : JSON.stringify(payload)
      throw httpError(
        `RERUM refused to refresh the access token (HTTP ${response.status}). ${detail}`,
        401
      )
    }

    settings.accessToken = fresh
    process.env.ACCESS_TOKEN = fresh
    await writeEnvValue("ACCESS_TOKEN", fresh, envPath).catch(() => false)
    return fresh
  })().finally(() => {
    refreshing = null
  })

  return refreshing
}

/**
 * Make sure a usable access token is in place before an upstream call.
 *
 * Pass-through when no token is configured at all: read-only use of the proxy should not
 * require credentials. Expired tokens are refreshed. Writes additionally require that the
 * token belongs to a registered, McElwee-specific agent, which is the whole point of
 * retiring the Java app: the generator on new data must be this app, not the shared
 * TinyThings sandbox.
 */
export function requireAgent({ write = false, refresh = generateNewAccessToken } = {}) {
  return async function agentGuard(req, res, next) {
    try {
      const settings = req.app.locals.config
      if (!settings.accessToken && !settings.refreshToken) {
        if (write) {
          return next(
            httpError(
              "This app is running without RERUM credentials, so it cannot write. Copy sample.env to .env and add the tokens from your RERUM registration.",
              401
            )
          )
        }
        return next()
      }

      if (settings.accessToken && isTokenExpired(settings.accessToken)) {
        await refresh(settings, req.app.locals.envPath)
      }

      const status = inspectAgent(settings)
      if (status.problem) {
        const fatal = write && (settings.requireAgentIri || status.isSharedSandbox)
        if (fatal) return next(httpError(status.problem, 403))
        req.app.locals.logger.warn(`RERUM agent: ${status.problem}`)
      }
      next()
    } catch (error) {
      next(error)
    }
  }
}
