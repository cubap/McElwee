/**
 * Where the two halves of the RERUM contract live.
 *
 * Reads and writes do not go to the same place, and that is not an accident:
 *
 * - Reads hit the RERUM API directly. They need no credential, and the store's own CORS
 *   headers allow them from any origin, which is what lets the published exhibit work
 *   with no server at all.
 * - Writes go through a TinyNode instance with our access token in the `Authorization`
 *   header (passthrough mode, TinyNode PR #134). TinyNode forwards that header verbatim,
 *   so RERUM stamps `__rerum.generatedBy` with *our* registered agent rather than the
 *   instance's. That is the whole reason this repo no longer reimplements the write
 *   endpoints itself.
 *
 * Note that `store.rerum.io` is the RERUM API and authorization portal, not a TinyNode
 * instance. The public TinyNode is `tiny.rerum.io`, and it relays to the production
 * store, so writes issued there land on the same records the exhibit reads.
 */

export const READ_API_DEFAULT = "https://store.rerum.io/v1/api/"
export const TINYNODE_DEFAULT = "https://tiny.rerum.io/"

/** Routes a TinyNode instance exposes for writes. `/query` is deliberately absent. */
export const WRITE_ROUTES = ["create", "update", "overwrite", "delete"]

const withTrailingSlash = (value) => (value.endsWith("/") ? value : `${value}/`)

/**
 * Build the absolute write URL for a TinyNode route, e.g.
 * `writeUrl("https://tiny.rerum.io/", "delete", "5b76fc0d")` ->
 * `https://tiny.rerum.io/delete/5b76fc0d`.
 */
export function writeUrl(tinynodeAddr, route, ...segments) {
  const base = withTrailingSlash(tinynodeAddr)
  const path = segments
    .filter((s) => s !== undefined && s !== null && String(s) !== "")
    .map((s) => encodeURIComponent(String(s)))
    .join("/")
  return `${base}${route}${path ? `/${path}` : ""}`
}

/** Pull the RERUM local id out of an IRI like https://store.rerum.io/v1/id/5b76fc0d... */
export function localIdFromIri(iri) {
  const text = String(iri ?? "").trim()
  if (!text) return null
  const stripped = text.replace(/[/#?]+$/, "")
  const last = stripped.split("/").pop()
  return last || null
}
