import express from "express"

import { fetchRerum, rerumHeaders } from "../rerum.js"
import { httpError, relay, verifyJsonContentType } from "../rest.js"
import { requireAgent } from "../tokens.js"
import { targetId } from "./update.js"

/**
 * PUT /overwrite
 *
 * Replaces a record wholesale instead of diffing it. This destroys the properties that
 * the previous version had and that the new payload omits, so it is kept off the
 * read-only site entirely and only reachable from the local entry subsite.
 */
export function createOverwriteRouter() {
  const router = express.Router()

  router.put("/", verifyJsonContentType, requireAgent({ write: true }), async (req, res, next) => {
    try {
      const body = req.body
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw httpError("Overwrite expects a single JSON-LD object.", 400)
      }
      if (!targetId(body, req.query)) {
        throw httpError('Overwrite requires an "@id" or "id" so RERUM knows which record to replace.', 400)
      }
      const settings = req.app.locals.config
      const response = await fetchRerum(
        `${settings.apiAddr}overwrite`,
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
