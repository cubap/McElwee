import { config } from "./config.js"
import { httpError } from "./rest.js"

/**
 * fetch() against RERUM with a bounded timeout and error shapes the routes can pass
 * straight through to the client. Without the timeout a hung upstream request keeps the
 * socket open forever and the browser just spins.
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

/** Headers every upstream call should carry: identity, auth, and a JSON body promise. */
export function rerumHeaders(body, settings = config) {
  const headers = {
    "User-Agent": settings.userAgent,
    Accept: "application/ld+json, application/json;q=0.9, */*;q=0.8",
    "Content-Type": "application/json;charset=utf-8"
  }
  if (settings.origin) headers.Origin = settings.origin
  if (settings.accessToken) headers.Authorization = `Bearer ${settings.accessToken}`
  if (body === undefined) delete headers["Content-Type"]
  return headers
}
