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
  // RERUM's access tokens name a person, not an app, so the decoded claim is usually absent;
  // the configured agent is the honest answer to "what will this be attributed to".
  console.log(`[mcelwee] writing as         ${status.agentIri ?? config.expectedAgentIri ?? "(no credentials)"}`)
  if (status.problem) console.warn(`[mcelwee] WARNING ${status.problem}`)
})
