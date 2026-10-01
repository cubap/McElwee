import "dotenv/config"

import { READ_API_DEFAULT, TINYNODE_DEFAULT } from "./endpoints.js"

const DEFAULTS = {
  PORT: "3030",
  RERUM_API_ADDR: READ_API_DEFAULT,
  RERUM_ID_PATTERN: "https://store.rerum.io/v1/id/",
  RERUM_REGISTRATION_URL: "https://store.rerum.io/v1/",
  RERUM_ACCESS_TOKEN_URL: "https://store.rerum.io/client/request-new-access-token",
  // The TinyNode instance we pass our token through for writes. This is *not*
  // store.rerum.io, which is the RERUM API and auth portal rather than a TinyNode.
  RERUM_TINYNODE_ADDR: TINYNODE_DEFAULT,
  RERUM_FETCH_TIMEOUT_MS: "30000",
  USER_AGENT: "McElwee/1.0 (RERUM passthrough client)"
}

const positiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Number.parseInt(fallback, 10)
}

const trimmed = (value, fallback) => (value ?? "").trim() || fallback

/**
 * Normalize an API root so callers can append `query`, `create`, etc. without
 * worrying about whether the operator wrote a trailing slash.
 */
const asRoot = (value) => (value.endsWith("/") ? value : `${value}/`)

export function readConfig(env = process.env) {
  return {
    port: positiveInt(env.PORT, DEFAULTS.PORT),
    origin: (env.ORIGIN ?? "").trim(),
    userAgent: trimmed(env.USER_AGENT, DEFAULTS.USER_AGENT),
    // Reads: the RERUM API itself.
    apiAddr: asRoot(trimmed(env.RERUM_API_ADDR, DEFAULTS.RERUM_API_ADDR)),
    // Writes: a TinyNode instance that honours our Authorization header.
    tinynodeAddr: asRoot(trimmed(env.RERUM_TINYNODE_ADDR, DEFAULTS.RERUM_TINYNODE_ADDR)),
    idPattern: trimmed(env.RERUM_ID_PATTERN, DEFAULTS.RERUM_ID_PATTERN),
    registrationUrl: trimmed(env.RERUM_REGISTRATION_URL, DEFAULTS.RERUM_REGISTRATION_URL),
    accessTokenUrl: trimmed(env.RERUM_ACCESS_TOKEN_URL, DEFAULTS.RERUM_ACCESS_TOKEN_URL),
    timeoutMs: positiveInt(env.RERUM_FETCH_TIMEOUT_MS, DEFAULTS.RERUM_FETCH_TIMEOUT_MS),
    accessToken: (env.ACCESS_TOKEN ?? "").trim(),
    refreshToken: (env.REFRESH_TOKEN ?? "").trim(),
    expectedAgentIri: (env.EXPECTED_AGENT_IRI ?? "").trim(),
    requireAgentIri: /^(true|1|yes)$/i.test((env.REQUIRE_AGENT_IRI ?? "").trim())
  }
}

export const config = readConfig()
