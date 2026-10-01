/*
 * McElwee configuration. Loaded as a plain script before app.js so the front end stays
 * a set of global functions (the module rewrite is issue #15, not this one).
 *
 * Everything the site needs to know about *where RERUM lives* is in this one file.
 *
 * The McElwee records live on the production store (issue #14 migration complete).
 */
(function (global) {
  "use strict"

  var RERUM_BASE = "https://store.rerum.io/v1"

  // The TinyNode instance the entry form writes through. TinyNode runs in *passthrough*
  // mode: it forwards the caller's `Authorization` header instead of substituting its own
  // instance token, so a write made here is stamped with the McElwee agent rather than with
  // TinyNode's. Note this is not store.rerum.io, which is the RERUM API and the
  // authorization portal but is not itself a TinyNode.
  var TINYNODE_BASE = "https://tiny.rerum.io/"

  // Hosts whose records are the same thing under http and https. RERUM hands back
  // `http://` IRIs inside itemListElement entries even though it serves them over
  // https, so any IRI lifted out of a payload has to be upgraded before fetch() or the
  // browser blocks it as mixed content on the https Pages origin. (issue #13)
  var RERUM_HOSTS = [
    "devstore.rerum.io",
    "store.rerum.io",
    "tinydev.rerum.io",
    "rerum.io"
  ]

  var servedLocally = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(global.location.hostname)

  function normalizeId(id) {
    if (typeof id !== "string") return id
    var trimmed = id.trim()
    if (!/^http:\/\//i.test(trimmed)) return trimmed
    var withoutScheme = trimmed.slice(7)
    var host = withoutScheme.split("/")[0].toLowerCase()
    for (var i = 0; i < RERUM_HOSTS.length; i++) {
      if (host === RERUM_HOSTS[i]) return "https://" + withoutScheme
    }
    return trimmed
  }

  function isRerumId(id) {
    return /^https?:\/\/(devstore\.rerum\.io|store\.rerum\.io|tinydev\.rerum\.io)\//i.test(String(id || ""))
  }

  // The store matches `target` literally, and the 2018 annotations were written against
  // the `http://` spelling of an IRI that now resolves over https. A record therefore has
  // two identities for query purposes: https for fetching it, http for finding what
  // describes it. Anything that looks up annotations has to try every spelling.
  function idVariants(id) {
    var canonical = normalizeId(id)
    if (typeof canonical !== "string" || !isRerumId(canonical)) return []
    var variants = [canonical]
    var asHttp = "http://" + canonical.slice(canonical.indexOf("://") + 3)
    if (variants.indexOf(asHttp) === -1) variants.push(asHttp)
    return variants
  }

  global.McElweeConfig = {
    servedLocally: servedLocally,
    RERUM_BASE: RERUM_BASE,
    RERUM_HOSTS: RERUM_HOSTS,
    // The cemetery population list the exhibit opens on.
    DEFAULT_LIST_ID: RERUM_BASE + "/id/6ab15ef62655eb9310888d22",
    // The catalog document every data-entry annotation cites as its evidence.
    EVIDENCE_ID: RERUM_BASE + "/id/6ab15d292655eb9310888cfd",
    // The SHSMO IIIF Image API that serves the 1899 atlas plat maps. Kept here so the
    // viewer (and any future map work) reads the one source of where images live, rather
    // than scattering the host across the front end.
    ATLAS_IIIF_BASE: "https://digital.shsmo.org/digital/iiif/plat",
    // The digitized collection the atlas plates belong to, for attribution and link-back.
    ATLAS_COLLECTION_URL: "https://digital.shsmo.org/digital/collection/plat",
    BASE_ID: RERUM_BASE,
    // Reads go straight to the RERUM API. Its CORS headers allow any origin, which is how
    // the GitHub Pages exhibit has always worked, so the read path is the same whether the
    // site is served from Pages or from this machine.
    QUERY_URL: RERUM_BASE + "/api/query",
    // Writes go to TinyNode in passthrough mode, with the bearer token from TOKEN_URL.
    TINYNODE_BASE: TINYNODE_BASE,
    CREATE_URL: TINYNODE_BASE + "create",
    UPDATE_URL: TINYNODE_BASE + "update",
    DELETE_URL: TINYNODE_BASE + "delete",
    // The local server trades the project's refresh token for a short-lived access token.
    // It exists only under `npm start`, and it is the only place a credential is ever
    // read; nothing here holds a refresh token, and the deployed site has no write path.
    TOKEN_URL: servedLocally ? global.location.origin + "/token" : null,
    AGENT_URL: servedLocally ? global.location.origin + "/agent" : null,
    normalizeId: normalizeId,
    isRerumId: isRerumId,
    idVariants: idVariants
  }
})(window)
