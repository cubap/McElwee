import { createApp } from "./app.js"
import { config } from "./config.js"
import { inspectAgent } from "./agent.js"

const app = createApp()

app.listen(config.port, () => {
  const status = inspectAgent(config)
  console.log(`[mcelwee] read-only exhibit  http://localhost:${config.port}/web/`)
  console.log(`[mcelwee] entry subsite      http://localhost:${config.port}/entry/  (local only, never deployed)`)
  console.log(`[mcelwee] RERUM proxy        http://localhost:${config.port}/query, /create, /update, /delete, /overwrite`)
  console.log(`[mcelwee] upstream           ${config.apiAddr}`)
  console.log(`[mcelwee] writing as         ${status.agentIri ?? "(no credentials)"}`)
  if (status.problem) console.warn(`[mcelwee] WARNING ${status.problem}`)
})
