---
name: register-agent
description: >-
  Use to register the agent under test in Roark and give it an endpoint Roark can
  reach: create the agent, then add a phone endpoint (E.164) with a call
  direction. Also covers non-phone transports (WebSocket, LiveKit, ElevenLabs,
  Kore, Google CES, Daily), which cannot be created through this API. Use when
  setting up a new agent, or when a run plan needs an agentEndpoint id that does
  not exist yet.
---

# Register an agent and its endpoint

Roark tests an **agent** by placing calls to one of its **endpoints**. A run plan
references endpoints by id, so this is the prerequisite for `build-run-plan` when
the agent is new.

## 1. Find or create the agent

The API does **no** deduplication: every `create` inserts. Look first:

```ts
const existing = await client.agent.list({ searchText: 'Support Bot' })
const found = existing.data.find((a) => a.name === 'Support Bot')

const agent =
  found ??
  (await client.agent.create({
    name: 'Support Bot',
    description: 'Inbound customer support line', // optional
    customId: 'support-bot-prod', // optional: your own stable id
  }))
```

Those three fields are the **entire** input. There is no `prompt`, `voice`,
`metadata`, `tags`, or `status` on an agent: do not try to set one.

Gotchas:

- **`searchText` matches `name` OR `description`, not `customId`.** You cannot look
  an agent up by `customId` through the list filter, so keep your own mapping or
  match on name.
- **`customId` is unique per project**, and a duplicate currently surfaces as a
  **500**, not a clean conflict. Check before creating.
- Names are **not** unique, so a name match may return several.
- **`customId` cannot be changed.** `update` accepts only `name` and `description`
  (`description: null` clears it).
- There is **no `agent.delete` in the SDK**.

Read one back with `client.agent.getByID(id)`. List filters: `limit` (1-50, default
20), `after` (cursor = last agent's id), `searchText`; sorted `createdAt` desc.

## 2. Add a phone endpoint

```ts
const endpoint = await client.agentEndpoint.create({
  agentId: agent.id,
  value: '+15555551234', // E.164; rejected otherwise
  direction: 'INCOMING', // REQUIRED: INCOMING | OUTGOING | INCOMING_AND_OUTGOING
  environment: 'production', // default 'production'
})
```

**This endpoint is always a phone endpoint.** There is no `type` field in the
payload: the API hardcodes `PHONE`. See the next section for everything else.

- **`direction` is required** (no default) and must match how you will test:
  inbound simulations need an endpoint accepting `INCOMING`, outbound need
  `OUTGOING`. Note the values are `INCOMING`/`OUTGOING`, while a *run plan's*
  `direction` is `INBOUND`/`OUTBOUND`.
- **Outbound dialing through your own system**: set
  `outboundDialType: 'HTTP_REQUEST'` plus
  `outboundDialHttpRequestDefinitionId` (required in that case). Default is
  `outboundDialType: 'NONE'`. See `configure-outbound-dial` for the definition.

`update` is narrow: only `environment`, `outboundDialType`, and
`outboundDialHttpRequestDefinitionId` can be changed. **`value`, `direction`,
`type`, and `agentId` are not updatable** - make a new endpoint instead.

List with `client.agentEndpoint.list({ agentId })`; other filters are `limit`,
`after`, and `searchText` (which matches `environment` or `value`, **not** the
agent's name).

## Non-phone transports (cannot be created here)

Roark supports eight endpoint types:

`PHONE`, `WEBSOCKET`, `LIVEKIT`, `SMALL_WEBRTC`, `ELEVENLABS_WS`, `KORE`,
`GOOGLE_CES`, `DAILY`

**Only `PHONE` is creatable through this API.** For any other type, the endpoint is
created in the Roark platform UI or by connecting a provider integration; your job
is then to look it up and use its id:

```ts
const { data: endpoints } = await client.agentEndpoint.list({ agentId })
const ws = endpoints.find((e) => e.type === 'ELEVENLABS_WS')
```

What `value` means per type, so you can recognise them: `WEBSOCKET` is a
`ws://`/`wss://` URL; `LIVEKIT` and `SMALL_WEBRTC` are server/signaling URLs (with
extra room/auth config settable only in the UI); `ELEVENLABS_WS` is an ElevenLabs
**agent id**, not a URL; `KORE` and `GOOGLE_CES` are app-id labels backed by a
provider integration; `DAILY` is a Pipecat Cloud session-start URL.

Two consequences worth telling the user:

- `WEBSOCKET`, `ELEVENLABS_WS`, `KORE`, and `GOOGLE_CES` are **chat-modality**
  endpoints: their sessions land as chats rather than calls, and a run plan that
  points a `VOICEMAIL` flow at one is rejected ("Voicemail flows can only run
  against voice endpoints").
- `KORE`, `GOOGLE_CES`, and `DAILY` need their provider integration connected, or
  the simulation fails partway through.

Do not guess a payload for these; direct the user to the UI or the integration.

## Next

With an `agent.id` and an `endpoint.id`, hand off to `build-run-plan`. If the
agent also needs personas or customer flows, use `author-personas-flows` first.
