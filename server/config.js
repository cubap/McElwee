import "dotenv/config"

const DEFAULTS = {
  PORT: "3030",
  RERUM_API_ADDR: "https://devstore.rerum.io/v1/api/",
  RERUM_ID_PATTERN: "https://devstore.rerum.io/v1/id/",
  RERUM_REGISTRATION_URL: "https://devstore.rerum.io/v1/",
  RERUM_ACCESS_TOKEN_URL: "https://store.rerum.io/client/request-new-access-token",
  RERUM_FETCH_TIMEOUT_MS: "30000",
  USER_AGENT: "McElwee-TinyNode/1.0"
}

const positiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Number.parseInt(fallback, 10)
}

const trimmed = (value, fallback) => (value ?? "").trim() || fallback

/**
 * Normalize a RERUM API root so callers can append `query`, `create`, etc. without
 * worrying about whether the operator wrote a trailing slash.
 */
const asApiRoot = (value) => (value.endsWith("/") ? value : `${value}/`)

export function readConfig(env = process.env) {
  return {
    port: positiveInt(env.PORT, DEFAULTS.PORT),
    origin: (env.ORIGIN ?? "").trim(),
    userAgent: trimmed(env.USER_AGENT, DEFAULTS.USER_AGENT),
    apiAddr: asApiRoot(trimmed(env.RERUM_API_ADDR, DEFAULTS.RERUM_API_ADDR)),
    idPattern: trimmed(env.RERUM_ID_PATTERN, DEFAULTS.RERUM_ID_PATTERN),
    registrationUrl: trimmed(env.RERUM_REGISTRATION_URL, DEFAULTS.RERUM_REGISTRATION_URL),
    accessTokenUrl: trimmed(env.RERUM_ACCESS_TOKEN_URL, DEFAULTS.RERUM_ACCESS_TOKEN_URL),
    timeoutMs: positiveInt(env.RERUM_FETCH_TIMEOUT_MS, DEFAULTS.RERUM_FETCH_TIMEOUT_MS),
    accessToken: (env.ACCESS_TOKEN ?? "").trim(),
    refreshToken: (env.REFRESH_TOKEN ?? "").trim(),
    expectedAgentIri: (env.EXPECTED_AGENT_IRI ?? "").trim(),
    requireAgentIri: /^(true|1|yes)$/i.test((env.REQUIRE_AGENT_IRI ?? "").trim()),
    openApiCors: /^(true|1|yes)$/i.test((env.OPEN_API_CORS ?? "").trim())
  }
}

export const config = readConfig()
