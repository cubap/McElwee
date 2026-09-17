import express from "express"

import { fetchRerum, rerumHeaders } from "../rerum.js"
import { httpError, relay, verifyJsonContentType } from "../rest.js"
import { requireAgent } from "../tokens.js"

/**
 * Extract the record id a mutation targets, from the body or the query string.
 * RERUM needs the id to exist before it will accept an update, so a missing one is a
 * client error rather than something to forward upstream.
 */
export function targetId(body, query) {
  const fromBody = body?.["@id"] ?? body?.id
  if (typeof fromBody === "string" && fromBody.trim()) return fromBody.trim()
  const fromQuery = query?.id
  if (typeof fromQuery === "string" && fromQuery.trim()) return fromQuery.trim()
  return null
}

/**
 * PUT /update
 *
 * Applies a diff to an existing record. RERUM merges the supplied properties and keeps
 * the original `__rerum.generatedBy`, so the generator of a record stays the app that
 * created it; the agent behind this token is recorded on the annotation RERUM generates
 * for the change.
 */
export function createUpdateRouter() {
  const router = express.Router()

  router.put("/", verifyJsonContentType, requireAgent({ write: true }), async (req, res, next) => {
    try {
      const body = req.body
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw httpError("Update expects a single JSON-LD object.", 400)
      }
      if (!targetId(body, req.query)) {
        throw httpError('Update requires an "@id" or "id" so RERUM knows which record to change.', 400)
      }
      const settings = req.app.locals.config
      const response = await fetchRerum(
        `${settings.apiAddr}update`,
        { method: "PUT", headers: rerumHeaders(body, settings), body: JSON.stringify(body) },
        settings
      )
      relay(res, response)
    } catch (error) {
      next(error)
    }
  })

  return router
}
