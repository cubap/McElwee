import { config } from "./config.js"
import { httpError } from "./rest.js"

/**
 * fetch() against RERUM with a bounded timeout and error shapes the caller can pass
 * straight through. Without the timeout a hung upstream request keeps the socket open
 * forever and the browser just spins.
 *
 * Only the token mint uses this any more; record reads and writes go from the browser or
 * a loader straight to store.rerum.io / tiny.rerum.io.
 */
export async function fetchRerum(url, options = {}, settings = config) {
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : settings.timeoutMs
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error("RERUM request timed out")), timeoutMs)
  const external = options.signal

  const onExternalAbort = () => controller.abort(external?.reason ?? new Error("Request cancelled"))
  if (external) {
    if (external.aborted) onExternalAbort()
    else external.addEventListener("abort", onExternalAbort, { once: true })
  }

  let response
  try {
    response = await fetch(url, { ...options, signal: controller.signal })
  } catch (cause) {
    const aborted = cause?.name === "AbortError" || controller.signal.aborted
    if (aborted) {
      throw httpError(`RERUM did not respond within ${timeoutMs}ms at ${url}`, 504, { timeoutMs })
    }
    throw httpError(`Unable to reach RERUM at ${url}: ${cause?.message ?? cause}`, 502)
  } finally {
    clearTimeout(timer)
    external?.removeEventListener("abort", onExternalAbort)
  }

  const text = await response.text()
  let payload = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      // RERUM occasionally answers with an HTML error page; keep it as text for the message.
      payload = text
    }
  }

  return { ok: response.ok, status: response.status, headers: response.headers, text, payload }
}

/**
 * Headers for the one upstream call this server still makes itself: trading the refresh
 * token for an access token. Deliberately carries no Authorization - that endpoint is
 * authenticated by the refresh token in the body.
 */
export function tokenRequestHeaders(body, settings = config) {
  const headers = {
    "User-Agent": settings.userAgent,
    Accept: "application/json",
    "Content-Type": "application/json;charset=utf-8"
  }
  if (settings.origin) headers.Origin = settings.origin
  if (body === undefined) delete headers["Content-Type"]
  return headers
}
