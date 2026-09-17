import express from "express"

import { fetchRerum, rerumHeaders } from "../rerum.js"
import { httpError, isEmptyQuery, readPagination, relay, verifyJsonContentType } from "../rest.js"

/**
 * POST /query
 *
 * Read-only pass-through to RERUM's query endpoint. An empty query is rejected because
 * it would ask the store for every record it holds and return it to a browser.
 */
export function createQueryRouter() {
  const router = express.Router()

  router.post("/", verifyJsonContentType, async (req, res, next) => {
    try {
      if (isEmptyQuery(req.body)) {
        throw httpError(
          "An empty query is not allowed. Send at least one clause, e.g. { \"@type\": \"Person\" }.",
          400
        )
      }
      const settings = req.app.locals.config
      const limit = readPagination(req.query.limit, "limit")
      const skip = readPagination(req.query.skip, "skip")

      const params = new URLSearchParams()
      if (limit !== null) params.set("limit", String(limit))
      if (skip !== null) params.set("skip", String(skip))
      const qs = params.toString()
      const url = `${settings.apiAddr}query${qs ? `?${qs}` : ""}`

      const response = await fetchRerum(
        url,
        { method: "POST", headers: rerumHeaders(req.body, settings), body: JSON.stringify(req.body) },
        settings
      )

      for (const header of ["Pagination-Limit", "Pagination-Skip", "Pagination-Limit-Max", "Pagination-Skip-Max"]) {
        const value = response.headers?.get?.(header)
        if (value) res.set(header, value)
      }
      relay(res, response)
    } catch (error) {
      next(error)
    }
  })

  return router
}
