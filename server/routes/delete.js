import express from "express"

import { fetchRerum, rerumHeaders } from "../rerum.js"
import { httpError, localIdFromIri, relay } from "../rest.js"
import { requireAgent } from "../tokens.js"
import { targetId } from "./update.js"

/**
 * DELETE /delete and DELETE /delete/:id
 *
 * RERUM takes the local id, not the full IRI, so the IRI is reduced here. Deletion is
 * the one operation that cannot be undone by the exhibit, so the entry subsite asks for
 * confirmation before calling it.
 */
export function createDeleteRouter() {
  const router = express.Router()

  async function remove(req, res, next) {
    try {
      const settings = req.app.locals.config
      const raw = req.params.id ?? targetId(req.body, req.query)
      if (!raw) {
        throw httpError('Delete requires an id, either as /delete/:id or as { "@id": "..." }.', 400)
      }
      const id = localIdFromIri(raw)
      if (!id) throw httpError(`"${raw}" does not contain a usable RERUM id.`, 400)

      const response = await fetchRerum(
        `${settings.apiAddr}delete/${encodeURIComponent(id)}`,
        { method: "DELETE", headers: rerumHeaders(undefined, settings) },
        settings
      )
      if (response.ok) return res.status(204).end()
      return relay(res, response)
    } catch (error) {
      next(error)
    }
  }

  const guard = requireAgent({ write: true })
  router.delete("/", guard, remove)
  router.delete("/:id", guard, remove)

  return router
}
