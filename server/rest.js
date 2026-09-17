/**
 * Small helpers shared by the proxy routes.
 */

export function httpError(message, status = 500, payload = null) {
  const error = new Error(message)
  error.status = status
  if (payload) error.payload = payload
  return error
}

/**
 * RERUM is strict about content types and answers a form-encoded body with a confusing
 * 500, so reject it here with something the developer can act on.
 *
 * Accepts application/json and application/ld+json, with or without parameters.
 */
export function verifyJsonContentType(req, res, next) {
  const value = req.headers["content-type"]
  if (!value) {
    return next(httpError("Requests to this endpoint must declare a Content-Type.", 415))
  }
  // A proxy that merged headers can hand us "json, ld+json"; that is not one content type.
  const types = String(value).split(",").map((part) => part.trim().toLowerCase())
  if (types.length > 1) {
    return next(httpError("Requests to this endpoint must declare exactly one Content-Type.", 415))
  }
  const mediaType = types[0].split(";")[0].trim()
  if (mediaType !== "application/json" && mediaType !== "application/ld+json") {
    return next(
      httpError(
        `Unsupported Content-Type "${mediaType || value}". Send application/json or application/ld+json.`,
        415
      )
    )
  }
  next()
}

/** True for `{}`, `[]`, `""`, null/undefined: a query that would ask RERUM for everything. */
export function isEmptyQuery(value) {
  if (value === null || value === undefined || value === "") return true
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === "object") return Object.keys(value).length === 0
  return false
}

/** Non-negative integer pagination values, passed through from the client's query string. */
export function readPagination(value, name) {
  if (value === undefined || value === null || value === "") return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw httpError(`"${name}" must be a non-negative integer.`, 400)
  }
  return parsed
}

/**
 * Hand the upstream response back to the client as-is. The proxy deliberately does not
 * restamp RERUM's JSON-LD; byte-for-byte relay keeps `@id` values and the
 * `__rerum.generatedBy` provenance intact.
 */
export function relay(res, response) {
  const contentType = response.headers?.get?.("content-type")
  if (contentType) res.set("Content-Type", contentType)
  res.status(response.status)
  if (response.text) return res.send(response.text)
  return res.end()
}

/** Pull the RERUM local id out of an IRI like https://devstore.rerum.io/v1/id/5b76fc0d... */
export function localIdFromIri(iri) {
  const text = String(iri ?? "").trim()
  if (!text) return null
  const stripped = text.replace(/[/#?]+$/, "")
  const last = stripped.split("/").pop()
  return last && last !== stripped ? last : last || null
}
