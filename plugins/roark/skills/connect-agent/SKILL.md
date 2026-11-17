---
name: connect-agent
description: >-
  Use when the agent runs on Retell, Vapi, ElevenLabs, Bland, Leaping, LiveKit
  (Cloud or the Agents SDK), Pipecat (Cloud or self-hosted), Kore AI or Google
  CES and should be connected to Roark: list the agents a platform key can see,
  connect the account with the right agents and settings (auto set-up, sampling,
  capabilities), hand the SDK key to a LiveKit or Pipecat bot, import past calls,
  and check the sync. Skip it for an agent that is only a phone number.
---

# Connect an agent to Roark

Connecting the platform an agent runs on is the fastest way into Roark: the
agents, their prompts and tools come in on their own, production calls start
arriving for analysis, and (with auto set-up on) each agent gets test flows and
metrics drafted for it. One connection per platform account.

## Use this when

- The agent is built on one of the platforms above, and nothing in Roark has it yet.
- Someone asks to "connect", "integrate", "sync" or "hook up" Retell, Vapi,
  LiveKit, Pipecat and so on.
- A connection exists and needs a new key, a different set of agents, a pause, or
  a backfill of past calls.

## Use a different skill when

- The agent is just a phone number Roark should call: **`register-agent`**.
- You want to import one recording, not connect a platform: **`ingest-calls`**.
- The agent is connected and you want to test it: **`simulate-quickstart`**.

## You will have

A connection id, the agents it brought in (visible with `client.agent.list()`),
and for LiveKit self-hosted or Pipecat, the API key the bot reports calls with.

## 1. Read what the platform needs

Never guess a create body. Ask the API:

```ts
const { data: providers } = await client.agentConnection.listProviders()
const retell = providers.find((p) => p.provider === 'RETELL')
// retell.requiredFields      -> ['name', 'apiKey']
// retell.ingestion           -> 'SYNC' | 'WEBHOOK' | 'SDK' | 'NONE'
// retell.supportsAgentDiscovery, supportsAutoSetUp, supportsBackfill, multipleConnections
```

Provider values: `RETELL`, `VAPI`, `ELEVEN_LABS`, `BLAND`, `LEAPING`, `LIVEKIT`
(LiveKit Cloud), `LIVEKIT_SELF_HOSTED` (LiveKit Agents SDK), `PIPECAT_CLOUD_INTEGRATION`,
`PIPECAT_SELF_HOSTED_INTEGRATION`, `KORE`, `GOOGLE_CES`. The per-provider bodies
are in [references/providers.md](references/providers.md).

## 2. Check whether it is already connected

Most platforms connect once per project, and a second create returns **409**
naming the existing connection. Look first:

```ts
const { data: existing } = await client.agentConnection.list({ provider: 'RETELL' })
```

If one exists, update it (step 6) instead of creating another. Only LiveKit Cloud
allows several accounts.

## 3. Pick the agents (Retell, Vapi, ElevenLabs, Bland)

```ts
const { data: agents } = await client.agentConnection.discover({ provider: 'VAPI', apiKey })
// [{ id, name, hipaaEnabled }]
```

This also proves the key works: a refused key is a **400**, and nothing is stored.
Show the list to the user and ask which agents to bring in, unless they said
"all". A Vapi assistant with `hipaaEnabled: true` withholds recordings, so its
calls cannot be analysed: say so before selecting it.

## 4. Connect

Ask the user before turning on **auto set-up**: it drafts flows and metrics for
every agent that arrives, which is useful for a few agents and noisy for fifty.

```ts
const { data: connection, observerApiKey } = await client.agentConnection.create({
  provider: 'VAPI',
  name: 'Production Vapi',
  apiKey,
  agentScope: 'SELECTED', // or 'ALL' (default)
  agentIds: ['asst_123', 'asst_456'],
  autoSetUpAgents: true, // default false
  samplingRate: 1, // fraction of production calls to import, default 1
})
```

Defaults when omitted: `agentScope: 'ALL'`, capabilities `PULL_AGENTS` +
`PULL_CALLS` (plus `PUSH_AGENT_CONFIG` on Retell, Vapi and ElevenLabs), no auto
set-up, every call imported. `PUSH_AGENT_CONFIG` only ever writes to the
platform after a person applies a fix in Roark; drop it from `capabilities` if
the user wants the connection strictly read-only.

**The key is never returned again.** Do not echo it back to the user or write it
into a file.

## 5. SDK platforms: hand over the observer key

For `LIVEKIT_SELF_HOSTED` and both Pipecat providers, calls do not come from a
sync: the bot reports them. The create response carries `observerApiKey`
**once**. Put it where the bot reads its secrets (an env var such as
`ROARK_API_KEY`), never in source control, and tell the user it cannot be shown
again. If it is `null`, minting failed: the user creates a key bound to the
connection from the Roark dashboard.

Pipecat can also accept test calls from Roark: set `baseSignalingUrl` (self-hosted
SmallWebRTC) or `pccPublicKey` (Pipecat Cloud), and Roark creates the endpoints.
LiveKit Cloud does the same with `endpoint` (see the reference).

## 6. Check it worked

```ts
const { data } = await client.agentConnection.getByID(connection.id)
// data.sync          -> { status, startedAt, endedAt, isUpToDate, createdAgentCount } | null
// data.syncProblems  -> [{ agentName, reason }]  e.g. INVALID_API_KEY, AGENT_NOT_FOUND
```

The first sync starts straight away and takes a few minutes. `sync` is `null` for
platforms that are not pulled (LiveKit, Pipecat, Kore, Google CES). Agents appear
in `client.agent.list()` as they arrive.

## 7. Change it later

`update` takes `provider` (it must match) plus only the fields to change. The rest
keep their stored values.

```ts
await client.agentConnection.update(connection.id, { provider: 'VAPI', apiKey: newKey }) // rotate, re-checked
await client.agentConnection.update(connection.id, { provider: 'VAPI', agentIds: [...] }) // change the agents
await client.agentConnection.update(connection.id, { provider: 'VAPI', status: 'INACTIVE' }) // pause
```

## 8. Import past calls (Retell, Vapi, ElevenLabs, Leaping)

New connections import calls from now on. To analyse history:

```ts
const { data: backfill } = await client.agentConnection.createBackfill(connection.id, { maxCalls: 250 })
const { data: backfills } = await client.agentConnection.listBackfills(connection.id)
```

Imported calls are analysed, and analysis bills. Tell the user the number before
starting a large backfill.

## Gotchas

- `discover` lists agents; it does not connect anything.
- `agentIds` are the **platform's** ids (`asst_...`, `agent_...`), not Roark agent ids.
- `PULL_CALLS` without `PULL_AGENTS` is refused on platforms that pull agents.
- `metadataEgressStrategy` (LiveKit) needs `metadataFilteringEnabled: true`.
- Deleting a connection (`client.agentConnection.delete(id)`) stops the sync and
  drops the credential; agents and calls already imported stay.
- A 403 means the API key lacks `agent-connection:*` permissions. Ask the user for a
  key with Agent Connections access.

## Next

- `simulate-quickstart` to test an agent the connection brought in.
- `monitor-live-calls` to grade the production calls now arriving.
- `register-agent` to add a phone endpoint to an imported agent.
