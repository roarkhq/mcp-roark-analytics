---
name: configure-outbound-dial
description: >-
  Use to configure how Roark places OUTBOUND simulated calls: define the HTTP
  request Roark sends to your telephony/agent platform to trigger it to dial the
  simulated caller. Covers httpRequestDefinition (url, method, headers, body
  template with placeholders, signing secret). Use when setting up outbound
  simulations, when a run needs Roark to kick off the call by hitting your API,
  or when outbound calls are not dialing.
---

# Configure outbound dialing

For **INBOUND** simulations, Roark connects to an agent endpoint directly. For
**OUTBOUND** simulations, Roark instead has to tell *your* system to place the
call - it does that by sending an HTTP request you define. An
**http request definition** is that stored request template.

Reach for this only when a run's `direction` is `OUTBOUND` and Roark must trigger
the dial via your API. If your platform lets Roark dial directly, you do not need
one.

## Define the outbound-dial request

```ts
const def = await client.httpRequestDefinition.create({
  scope: 'AGENT_OUTBOUND_DIAL',        // required; the only accepted scope here
  url: 'https://your-telephony.example.com/calls',
  method: 'POST',                      // POST (default) | PUT | PATCH | GET
  headers: { Authorization: 'Bearer ...' },
  body: { to: '{{phoneNumberToDial}}' }, // template; placeholders filled per call
})
// def.signingSecret is returned ONLY on create - store it so your endpoint can
// verify the request genuinely came from Roark. It is not retrievable later.
```

- **`scope`** must be `AGENT_OUTBOUND_DIAL`. (A `WEBHOOK` scope exists internally
  but is rejected here; event subscriptions are `subscribe-webhooks`.)
- **`body`** may be a string or an object (objects are stored as JSON). Use
  `{{placeholder}}` tokens (e.g. `{{phoneNumberToDial}}`) that Roark fills in when
  it places each call. Confirm the available placeholder names with the MCP docs
  search tool.
- **`headers`** carry whatever auth your platform needs.
- The response also exposes `parsedBody` (the parsed JSON, or the raw string).

## Update, list, read

```ts
const { data } = await client.httpRequestDefinition.list({ limit: 50 })
const one = await client.httpRequestDefinition.getByID(def.id)
await client.httpRequestDefinition.update(def.id, { headers: { Authorization: 'Bearer new' } })
// update takes any subset of url / description / method / body / headers (not scope).
```

There is no delete method in the SDK; update the definition in place if it
changes.

## Attach it to the endpoint (the step that actually wires it up)

Creating the definition does nothing on its own. **An endpoint opts into it**, via
two fields on `agentEndpoint`:

```ts
// on create...
await client.agentEndpoint.create({
  agentId,
  value: '+15555551234',
  direction: 'OUTGOING',
  outboundDialType: 'HTTP_REQUEST',            // default is 'NONE'
  outboundDialHttpRequestDefinitionId: def.id, // required when type is HTTP_REQUEST
})

// ...or on an existing endpoint (both fields ARE updatable)
await client.agentEndpoint.update(endpointId, {
  outboundDialType: 'HTTP_REQUEST',
  outboundDialHttpRequestDefinitionId: def.id,
})
```

`outboundDialType` is `NONE` or `HTTP_REQUEST`, and `HTTP_REQUEST` **requires** the
definition id (enforced by a constraint, so omitting it fails).

## How it fits a run

1. Create the definition once (this skill).
2. Register the agent and a `OUTGOING` (or `INCOMING_AND_OUTGOING`) endpoint, with
   `outboundDialType: 'HTTP_REQUEST'` pointing at the definition
   (`register-agent`).
3. Build an `OUTBOUND` run plan (`build-run-plan`). Roark sends your defined
   request to start each call, filling the placeholders, and signs it with the
   signing secret so your endpoint can verify it.

If outbound calls are not dialing, check in this order: **the endpoint has
`outboundDialType: 'HTTP_REQUEST'` and the right
`outboundDialHttpRequestDefinitionId`** (the most common miss - the definition
exists but nothing points at it); the endpoint's `direction` allows outgoing; the
run `direction` is `OUTBOUND`; the definition `url` / auth `headers` are correct;
your endpoint accepts the `method` and body shape; and your endpoint is verifying
(not rejecting) the Roark signature.
