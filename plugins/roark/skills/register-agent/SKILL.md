---
name: register-agent
description: >-
  Use when the voice agent you want to test is not in Roark yet, or has no phone
  number Roark can call: find or create the agent, then add a phone endpoint
  with the right call direction, and get the endpoint id a run plan needs. Also
  explains WebSocket, LiveKit, ElevenLabs and other non-phone endpoints, which
  are set up in the product. Skip it when the agent already has an endpoint.
---

# Connect your agent to Roark

Roark tests an **agent** by calling one of its **endpoints** (usually a phone
number). A run plan points at endpoint ids, so this is the step that produces
them.

## Use this when

- The agent under test does not exist in the Roark project yet.
- The agent exists but has no endpoint for the direction you want to test
  (inbound calls need `INCOMING`, outbound need `OUTGOING`).

## Use a different skill when

- The agent and endpoint already exist: skip this, list them, and go to
  `build-run-plan` (or `simulate-quickstart`).
- Roark must call your platform's API to make the agent dial out:
  `configure-outbound-dial` defines that request; come back here to attach it.
- You want agents declared in a repo: `manage-config-as-code`.

## You will have

An `agent.id` and an `endpoint.id` with the right `direction`, ready for a run
plan's `agentEndpoints: [{ id }]`.

## 1. Find the agent, or create it

`create` never deduplicates, so look first:

```ts
const { data: existing } = await client.agent.list({ searchText: 'Support Bot' })
let agent = existing.find((a) => a.name === 'Support Bot')

if (!agent) {
  const { data: created } = await client.agent.create({
    name: 'Support Bot',
    description: 'Inbound customer support line', // optional
    customId: 'support-bot-prod', // optional: your own stable id, unique per project
  })
  agent = created
}
```

Those three fields are the whole input. There is no `prompt`, `voice`,
`metadata`, `tags`, or `status` on an agent.

- `searchText` matches `name` or `description`, not `customId`.
- Names are not unique; a search can return several.
- A duplicate `customId` currently returns a **500**, not a clean conflict, so
  check before creating. `customId` cannot be changed later.
- `update` accepts only `name` and `description`. There is no `agent.delete`.

## 2. Find or add a phone endpoint

```ts
const { data: endpoints } = await client.agentEndpoint.list({ agentId: agent.id })
let endpoint = endpoints.find((e) => e.value === '+15555551234')

if (!endpoint) {
  const { data: created } = await client.agentEndpoint.create({
    agentId: agent.id,
    value: '+15555551234', // E.164, rejected otherwise
    direction: 'INCOMING', // required: INCOMING | OUTGOING | INCOMING_AND_OUTGOING
    environment: 'production', // default 'production'
  })
  endpoint = created
}
```

- **`direction` is required** and must match the test. Endpoints use
  `INCOMING`/`OUTGOING`; a run plan's `direction` is spelled `INBOUND`/`OUTBOUND`.
- The endpoint created here is always `PHONE`; there is no `type` field.
- `update` can change only `environment`, `outboundDialType`, and
  `outboundDialHttpRequestDefinitionId`. To change `value` or `direction`, create
  a new endpoint.
- `agentEndpoint.list` filters: `agentId`, `limit`, `after`, `searchText` (matches
  `environment` or `value`, not the agent name).

For outbound runs where Roark triggers the dial through your API, set
`outboundDialType: 'HTTP_REQUEST'` and `outboundDialHttpRequestDefinitionId` on
the endpoint. The definition comes from `configure-outbound-dial`.

## Non-phone endpoints (set up in the product)

Roark supports `PHONE`, `WEBSOCKET`, `LIVEKIT`, `SMALL_WEBRTC`, `ELEVENLABS_WS`,
`KORE`, `GOOGLE_CES`, and `DAILY`. **Only `PHONE` can be created through the
API.** For the rest, the user creates the endpoint in the Roark product or by
connecting a provider integration; you then look it up:

```ts
const { data: endpoints } = await client.agentEndpoint.list({ agentId })
const ws = endpoints.find((e) => e.type === 'ELEVENLABS_WS')
```

What `value` holds per type: `WEBSOCKET` a `ws://`/`wss://` URL; `LIVEKIT` and
`SMALL_WEBRTC` server or signaling URLs; `ELEVENLABS_WS` an ElevenLabs agent id;
`KORE` and `GOOGLE_CES` app-id labels backed by an integration; `DAILY` a Pipecat
Cloud session-start URL.

Two things to tell the user:

- `WEBSOCKET`, `ELEVENLABS_WS`, `KORE`, and `GOOGLE_CES` are chat-modality
  endpoints: their sessions land as chats, and a voicemail flow pointed at one is
  rejected ("Voicemail flows can only run against voice endpoints").
- `KORE`, `GOOGLE_CES`, and `DAILY` need their provider integration connected, or
  the simulation fails partway through.

Do not guess a create payload for these.

**MCP note:** the plugin's named tools `create_agent`, `create_agent_endpoint`,
`list_agents`, and `list_agent_endpoints` do the same as the calls above.

## Next

- `author-personas-flows` or a `flows-*` playbook if there is nothing to test yet.
- `build-run-plan` to attach the endpoint id to a plan.
- `configure-outbound-dial` if outbound calls must be triggered through your API.
