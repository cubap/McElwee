import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { config } from "./config.js"
import { fetchRerum, tokenRequestHeaders } from "./rerum.js"
import { httpError } from "./rest.js"
import { inspectAgent, tokenExpiryMs } from "./agent.js"

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
        headers: tokenRequestHeaders(body, settings),
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

    // RERUM can hand back a new refresh token alongside the access token. Keeping only the
    // access token would leave the retired refresh token in .env, so the credential would
    // work once and then fail permanently on the next expiry.
    const rotated = payload.refresh_token ?? payload.refreshToken
    if (typeof rotated === "string" && rotated && rotated !== settings.refreshToken) {
      settings.refreshToken = rotated
      process.env.REFRESH_TOKEN = rotated
      await writeEnvValue("REFRESH_TOKEN", rotated, envPath).catch(() => false)
    }
    return fresh
  })().finally(() => {
    refreshing = null
  })

  return refreshing
}

/**
 * How much remaining life an access token must have before we are willing to hand it to
 * a caller. RERUM tokens last an hour; a batch loader that starts with 30 seconds left
 * would fail halfway through, so anything under two minutes is refreshed up front.
 */
export const REFRESH_SKEW_MS = 120_000

export function tokenRemainingMs(token, now = Date.now()) {
  const expires = tokenExpiryMs(token)
  return expires === null ? null : expires - now
}

/**
 * Produce a usable access token for a caller to put in the `Authorization` header of a
 * write to TinyNode.
 *
 * This is now the single choke point for the attribution guarantee that used to live in
 * the per-route `requireAgent` middleware. Nothing can obtain a token to pass through
 * without clearing the same checks: credentials must exist, an expired or nearly-expired
 * token is traded for a fresh one, and a token belonging to the shared TinyThings sandbox
 * (or to an agent other than `EXPECTED_AGENT_IRI` when that is enforced) is refused. The
 * store still decides the truth of `__rerum.generatedBy`; this refuses the obvious lies
 * before a single record is written.
 */
export async function mintAccessToken(settings = config, envPath = ENV_PATH, { logger = console } = {}) {
  if (!settings.accessToken && !settings.refreshToken) {
    throw httpError(
      "This app is running without RERUM credentials, so it cannot write. Copy sample.env to .env and add the tokens from your RERUM registration.",
      401
    )
  }

  const remaining = tokenRemainingMs(settings.accessToken)
  // A token whose `exp` cannot be read is handed out rather than refreshed. Refreshing on
  // unparseable expiry would trade a refresh token for every single write, and RERUM rotates
  // on each trade, so one odd token in .env would spend the whole credential in an afternoon.
  const needsRefresh = remaining === null ? !settings.accessToken : remaining < REFRESH_SKEW_MS
  if (needsRefresh) {
    if (!settings.refreshToken) {
      throw httpError(
        "ACCESS_TOKEN is expired and no REFRESH_TOKEN is configured. Put a valid REFRESH_TOKEN in .env or re-register.",
        401
      )
    }
    await generateNewAccessToken(settings, envPath)
  }

  const status = inspectAgent(settings)
  if (status.problem) {
    if (settings.requireAgentIri || status.isSharedSandbox) throw httpError(status.problem, 403)
    logger.warn?.(`RERUM agent: ${status.problem}`)
  }

  const expires = tokenExpiryMs(settings.accessToken)
  return {
    token: settings.accessToken,
    agentIri: status.agentIri ?? settings.expectedAgentIri ?? null,
    expiresAt: expires ? new Date(expires).toISOString() : null
  }
}

