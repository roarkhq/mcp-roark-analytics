---
name: configure-outbound-dial
description: >-
  Use only when Roark must send an HTTP request to your own platform to make
  your agent place an OUTBOUND simulated call: define that request (url, method,
  headers, body template with placeholders, signing secret) and attach it to the
  agent's endpoint. Also the checklist when outbound simulated calls are not
  dialing. Inbound and phone-number agents skip this; it is not how you start a
  simulation (that is build-run-plan).
---

# Trigger outbound simulated calls

In an **outbound** test, your agent calls Roark's simulated customer. If your
platform cannot simply be dialed, Roark has to ask it to start the call by
sending an HTTP request you define. That stored request is an **http request
definition**.

## Use this when

- You are testing an agent that places calls (run `direction: 'OUTBOUND'`), and
  your platform starts a call when its API is hit.
- Outbound simulated calls are not dialing and you need the checklist below.

## Use a different skill when

- The agent answers calls (inbound) or Roark just calls a phone number: skip
  this entirely, use `register-agent` then `build-run-plan`.
- You want to start a simulation: `build-run-plan` or `simulate-quickstart`.
- You want Roark to notify *you* when something finishes: that is
  `subscribe-webhooks`, a different kind of HTTP request.

## You will have

An http request definition id, attached to an `OUTGOING` endpoint with
`outboundDialType: 'HTTP_REQUEST'`, and the signing secret stored so your
platform can verify requests came from Roark.

## 1. Define the request

```ts
const { data: def } = await client.httpRequestDefinition.create({
  scope: 'AGENT_OUTBOUND_DIAL', // required; the only scope accepted here
  url: 'https://your-telephony.example.com/calls',
  method: 'POST', // POST (default) | PUT | PATCH | GET
  headers: { Authorization: 'Bearer <your platform token>' },
  body: { to: '{{phoneNumberToDial}}' }, // placeholders are filled per call
})
// def.signingSecret is returned ONLY on create. Store it now; it cannot be read later.
```

- `body` is a string or an object (objects are stored as JSON). `{{placeholder}}`
  tokens such as `{{phoneNumberToDial}}` are filled when each call is placed.
  Confirm the available placeholder names with SDK docs search.
- `headers` carry whatever auth your platform needs.
- The response also has `parsedBody` (parsed JSON, or the raw string).

## 2. Attach it to the endpoint

Creating the definition does nothing on its own. The endpoint has to point at it:

```ts
// on an existing endpoint (both fields are updatable)
await client.agentEndpoint.update(endpointId, {
  outboundDialType: 'HTTP_REQUEST', // default is 'NONE'
  outboundDialHttpRequestDefinitionId: def.id, // required when type is HTTP_REQUEST
})

// or when creating the endpoint (see register-agent)
await client.agentEndpoint.create({
  agentId,
  value: '+15555551234',
  direction: 'OUTGOING', // or INCOMING_AND_OUTGOING
  outboundDialType: 'HTTP_REQUEST',
  outboundDialHttpRequestDefinitionId: def.id,
})
```

## 3. Run it

Build a run plan with `direction: 'OUTBOUND'` and this endpoint
(`build-run-plan`). For each call, Roark sends your request with the placeholders
filled and signs it with the signing secret.

## Maintain it

```ts
const { data: defs } = await client.httpRequestDefinition.list({ limit: 50 })
const { data: one } = await client.httpRequestDefinition.getByID(def.id)
await client.httpRequestDefinition.update(def.id, { headers: { Authorization: 'Bearer <new token>' } })
// update takes any of url, description, method, body, headers (not scope)
```

There is no delete in the SDK; update the definition in place.

## When outbound calls do not dial

Check in this order:

1. The endpoint has `outboundDialType: 'HTTP_REQUEST'` and the right
   `outboundDialHttpRequestDefinitionId`. This is the most common miss: the
   definition exists but nothing points at it.
2. The endpoint `direction` allows outgoing.
3. The run plan `direction` is `OUTBOUND`.
4. The definition `url` and auth `headers` are correct.
5. Your platform accepts the `method` and body shape.
6. Your platform verifies, rather than rejects, the Roark signature.

## Next

- `register-agent` for the endpoint itself.
- `build-run-plan` to start an outbound run.
- `flows-car-dealership` and `flows-debt-collection` include outbound flow
  examples.
