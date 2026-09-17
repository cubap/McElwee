import express from "express"

import { fetchRerum, rerumHeaders } from "../rerum.js"
import { httpError, localIdFromIri, relay, verifyJsonContentType } from "../rest.js"
import { requireAgent } from "../tokens.js"

/**
 * POST /create
 *
 * Writes a new record under the agent configured in .env. RERUM fills in
 * `__rerum.generatedBy` from that token, which is why the agent guard runs first: an
 * unregistered or sandbox token must not be able to mint McElwee data.
 */
export function createCreateRouter() {
  const router = express.Router()

  router.post("/", verifyJsonContentType, requireAgent({ write: true }), async (req, res, next) => {
    try {
      const body = req.body
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw httpError("Create expects a single JSON-LD object.", 400)
      }
      const settings = req.app.locals.config

      // Honour a client-supplied id by pinning the local part, the way TinyThings does.
      const requested = body.id ?? body["@id"]
      if (requested !== undefined && typeof requested !== "string") {
        throw httpError('"id" must be a string IRI when provided.', 400)
      }
      const payload = { ...body }
      if (requested) {
        const local = localIdFromIri(requested)
        if (!local) throw httpError(`"${requested}" does not contain a usable RERUM id.`, 400)
        payload._id = local
        delete payload.id
        delete payload["@id"]
      }

      const response = await fetchRerum(
        `${settings.apiAddr}create`,
        { method: "POST", headers: rerumHeaders(payload, settings), body: JSON.stringify(payload) },
        settings
      )

      const createdId = response.payload?.["@id"] ?? response.payload?.id
      if (response.ok && createdId) res.set("Location", createdId)
      relay(res, response)
    } catch (error) {
      next(error)
    }
  })

  return router
}
