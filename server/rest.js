/**
 * Shared helpers for the token mint.
 *
 * The proxy utilities that used to live here (content-type enforcement, empty-query
 * refusal, pagination parsing, byte-for-byte relay, IRI reduction) went away with the
 * proxy: they were guards on a surface this server no longer owns. Reads go to the RERUM
 * API and writes go to TinyNode, so those services are the authorities on their own
 * input rules. `localIdFromIri` survived, moved to endpoints.js, because callers still
 * have to reduce an IRI before calling TinyNode's DELETE.
 */

export function httpError(message, status = 500, payload = null) {
  const error = new Error(message)
  error.status = status
  if (payload) error.payload = payload
  return error
}

/**
 * True when the request arrived over the loopback interface.
 *
 * `req.ip` is deliberately not used: it depends on `trust proxy`, and the mint must not be
 * persuadable by an `X-Forwarded-For` header. The socket peer address is the one thing a
 * client cannot lie about.
 */
export function isLoopback(req) {
  const addr = String(req.socket?.remoteAddress ?? "")
    .trim()
    .toLowerCase()
  if (!addr) return false
  // IPv4, and the IPv4-mapped IPv6 form Node uses when listening on a dual-stack socket.
  const mapped = addr.startsWith("::ffff:") ? addr.slice(7) : addr
  return mapped === "::1" || /^127\./.test(mapped)
}
