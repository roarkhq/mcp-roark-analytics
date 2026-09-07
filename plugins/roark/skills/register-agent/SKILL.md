---
name: register-agent
description: >-
  Use to register the voice or chat agent under test in Roark and give it an
  endpoint Roark can reach: create the agent, then add a phone endpoint (E.164)
  with a call direction. Use when someone is setting up a new agent in Roark, or
  a run plan needs an agentEndpoint id that does not exist yet.
---

# Register an agent and its endpoint

Roark tests an **agent** by placing calls to one of its **endpoints**. A run plan
references endpoints by id, so this is the prerequisite for `build-run-plan` when
the agent is new.

## 1. Find or create the agent

Check whether it already exists before creating a duplicate:

```ts
const existing = await client.agent.list({ searchText: 'Support Bot' })
const agent =
  existing.data.find((a) => a.name === 'Support Bot') ??
  (await client.agent.create({
    name: 'Support Bot',
    description: 'Inbound customer support line', // optional
    customId: 'support-bot-prod', // optional: your own stable id for lookup
  }))
```

`customId` is your own identifier; set it if you want to correlate the Roark
agent with a record in your system. Read one back with `client.agent.getByID(id)`
and rename/redescribe with `client.agent.update(id, {...})`.

## 2. Add an endpoint

An endpoint is where Roark reaches the agent. Via the API you create **phone**
endpoints, addressed by an E.164 number, with a call direction:

```ts
const endpoint = await client.agentEndpoint.create({
  agentId: agent.id,
  value: '+15555551234', // E.164; rejected otherwise
  direction: 'INCOMING', // INCOMING | OUTGOING | INCOMING_AND_OUTGOING
  environment: 'production', // default 'production'
})
```

- **`direction`** must match how you will test. Inbound simulations need an
  endpoint that accepts `INCOMING`; outbound simulations need `OUTGOING`.
- **Outbound dialing that hits your own system** can attach an HTTP request
  definition: set `outboundDialType: 'HTTP_REQUEST'` and
  `outboundDialHttpRequestDefinitionId`. Otherwise leave `outboundDialType: 'NONE'`
  (the default).

List an agent's endpoints with `client.agentEndpoint.list({ agentId })` and
update one with `client.agentEndpoint.update(id, {...})`.

## Note on non-phone transports

WebSocket, LiveKit, ElevenLabs, and other non-phone endpoint types exist, but
they are provisioned through Roark's provider integrations rather than created
with the `value`-as-E.164 create call above. If the user needs one of those, use
docs search to confirm the current path and direct them to the relevant
integration rather than guessing a payload.

## Next

With an `agent.id` and an `endpoint.id`, hand off to `build-run-plan`. If the
agent also needs personas or customer flows, use `author-personas-flows` first.
