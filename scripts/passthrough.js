/*
 * Writing to RERUM through TinyNode's passthrough mode.
 *
 * The batch loaders used to POST to the local proxy, which relayed the payload upstream with
 * the instance's own credential. TinyNode now forwards a caller's `Authorization` header
 * verbatim (PR #134), so these scripts send their writes straight to TinyNode and carry a
 * token they obtained from the local mint (`POST http://localhost:3030/token`). The refresh
 * token never enters this process; only the short-lived access token does, and only in memory.
 *
 * Reads are deliberately not this module's business. They go directly to the RERUM API, which
 * allows any origin, exactly as the published exhibit does - and TinyNode's /query does not
 * honour passthrough at all, so routing reads there would silently attribute them elsewhere.
 */

import { writeUrl, localIdFromIri } from "../server/endpoints.js"

/** A rejected token looks identical to a rejected record; only these are worth re-minting for. */
const TOKEN_STATUSES = new Set([401, 403])

async function readResponse(response, label) {
  const text = await response.text()
  let payload = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = { raw: text }
    }
  }
  if (!response.ok) {
    // TinyNode answers its own failures in plain text, and RERUM's complaint about a token
    // arrives inside that text, so `raw` has to be a candidate or the message is just "HTTP 401".
    const detail = payload?.error || payload?.message || payload?.raw || text
    const error = new Error(`${label} -> HTTP ${response.status}: ${String(detail).trim().slice(0, 300)}`)
    error.status = response.status
    throw error
  }
  return payload
}

/**
 * Trade the server's credential for a usable access token.
 *
 * The mint is the app's only source of a token, which is what keeps the attribution rule in
 * one place: it refuses to hand out a token for the shared sandbox agent, so a misattributed
 * batch cannot start from here either.
 */
export async function mintToken(base) {
  const response = await fetch(`${base}/token`, { method: "POST" }).catch((error) => {
    throw new Error(`Cannot reach the token mint at ${base}/token: ${error.message}. Run \`npm start\` first.`)
  })
  const minted = await readResponse(response, `POST ${base}/token`)
  if (!minted?.token) {
    throw new Error(`The token mint at ${base} answered without a token. Check the RERUM credentials in .env.`)
  }
  return minted
}

/**
 * A write client bound to one TinyNode instance.
 *
 * `create` / `update` / `overwrite` / `remove` each attach the current bearer token. A batch
 * of a few hundred records outlives an hour-long token, so a rejection is met by minting a
 * fresh token and retrying the single failed write once, rather than dying at the 60th minute.
 */
export async function createWriter({ base, tinynodeAddr, logger = console } = {}) {
  let minted = await mintToken(base)
  const target = String(tinynodeAddr || minted.tinynodeAddr || "").trim()
  if (!target) {
    throw new Error(`The token mint at ${base} did not report a TinyNode address, so there is nothing to write to.`)
  }

  async function attempt(route, method, payload, segments) {
    const url = writeUrl(target, route, ...segments)
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${minted.token}`
    }
    const response = await fetch(url, {
      method,
      headers,
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) })
    })
    return readResponse(response, `${method} ${url}`)
  }

  async function write(route, method, payload, ...segments) {
    try {
      return await attempt(route, method, payload, segments)
    } catch (error) {
      if (!TOKEN_STATUSES.has(error.status)) throw error
      logger.warn?.(`  ${route} was refused (${error.status}); minting a fresh token and retrying once.`)
      minted = await mintToken(base)
      return await attempt(route, method, payload, segments)
    }
  }

  return {
    tinynodeAddr: target,
    agentIri: minted.agentIri ?? null,
    tokenExpiresAt: minted.expiresAt ?? null,
    create: (payload) => write("create", "POST", payload),
    update: (payload) => write("update", "PUT", payload),
    overwrite: (payload) => write("overwrite", "PUT", payload),
    // TinyNode's delete takes the bare local id in the path, not the full IRI.
    remove: (iri) => write("delete", "DELETE", undefined, localIdFromIri(iri))
  }
}
