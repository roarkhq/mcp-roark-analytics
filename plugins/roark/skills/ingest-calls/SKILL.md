---
name: ingest-calls
description: >-
  Use to import an already-happened real call into Roark for analysis, and to
  read calls back: create a call from a recording URL (plus optional transcript,
  tool invocations, agent and customer linkage), then list, fetch, and read its
  transcript, metrics, and sentiment. Use when someone wants to analyze existing
  production recordings, bring calls from another platform into Roark, or query
  calls that already exist.
---

# Ingest and read real calls

Roark can analyze calls that already happened, not just ones it simulates. This
skill covers importing a recording for analysis and reading calls back. (To
*grade* imported calls with metrics, see `monitor-live-calls`; to poll a
*simulation* run, see `read-results`.)

## Import a call from a recording

`client.call.create(...)` ingests a finished call (Roark records it as ended and
non-test, then analyzes it):

```ts
const call = await client.call.create({
  recordingUrl: 'https://.../call.mp3', // required; WAV/MP3/MP4/OGG, signed URL ok
  startedAt: '2026-09-01T15:04:00Z',    // required, ISO 8601
  interfaceType: 'PHONE',               // 'PHONE' | 'WEB'
  callDirection: 'INBOUND',             // 'INBOUND' | 'OUTBOUND'
  agent: { name: 'Frontdesk' },         // agent OR agents[]; see linkage below
  externalId: 'crm-98765',              // optional, stable id from your system; unique per project
})
// response is minimal (id, status, agents, customers, externalId, ...) - analysis runs async
```

Optional fields worth knowing:

- `stereoRecordingUrl` - a two-channel recording (better diarization).
- `transcript` - supply your own turns instead of relying on transcription
  (array of `{ role, startOffsetMs, endOffsetMs, text, ... }`; `role` is `AGENT`
  or `CUSTOMER` with matching `agent` / `customer` metadata).
- `toolInvocations` - tool/function calls the agent made
  (`{ name, parameters, result, startOffsetMs, agent, ... }`) so tool-use metrics
  can grade them.
- `properties` - a free-form `Record<string, unknown>` of metadata; it is
  filterable in `call.list` and is what `CALL_PROPERTY` policy conditions match.
- `customer` / `customers[]` - `{ label?, phoneNumberE164? }`.
- `endedStatus` - how the call ended (e.g. `CUSTOMER_ENDED_CALL`,
  `VOICE_MAIL_REACHED`, `AGENT_TRANSFERRED_CALL`, ...); confirm the enum with docs
  search if you need a specific value.
- OTEL trace linkage: `vapiCallId` **xor** `livekitRoomId`, to stitch the call to
  an existing trace.

Agent linkage (`agent` single or `agents[]`, never both) identifies or creates
the agent: `{ roarkId }`, or `{ customId }`, or `{ name, description?, customId? }`
(reuses an exact project-name match before creating). Optionally attach an
`endpoint` and the `prompt.resolvedPrompt` used on that call.

`externalId` is unique per project - re-importing the same call id returns **409**,
which makes imports idempotent if you key on your own id.

## Reading calls back

```ts
// List with filters and sorting.
const { data, pagination } = await client.call.list({
  limit: 50,                 // 1-100
  status: 'ENDED',
  searchText: 'refund',      // matches title / summary / transcript
  sortBy: 'startedAt',       // createdAt | startedAt | endedAt | duration | title | status
  sortDirection: 'desc',
  simulationRunPlanJobId,    // optional: only calls from a given run
})

const call = await client.call.getByID(callId)
// title, summary (auto-generated), status, durationMs, endedStatus,
// recordingUrl (pre-signed, ~1h), recordingUrlAccess, properties, policyIds, agents, customers

const transcript = await client.call.getTranscript(callId)
const metrics = await client.call.listMetrics(callId) // branch on captureStatus - see read-results
```

`recordingUrlAccess` can be `AVAILABLE` | `NOT_AVAILABLE` | `RESTRICTED`;
`RESTRICTED` means the API key lacks the `recording:read` permission.

## Sentiment

```ts
const runs = await client.call.listSentimentRuns(callId)
// each: status, averageSentiment (0-1), averageCategoricalSentiment
//       (POSITIVE | NEUTRAL | NEGATIVE), commonEmotion
```

## Chats (real, but not in the SDK)

Roark models text conversations as **chats**, the mirror of calls: same
participants/transcript/metrics model, no audio, and messages carry absolute
timestamps instead of offsets.

`POST /v1/chat` ingests one (`startTimestamp`, `endTimestamp`, `messages[]` with
`role: 'AGENT' | 'CUSTOMER'`, plus `agent`/`agents`, optional `toolInvocations`,
`properties`, `externalId`), and `GET /v1/chat`, `/v1/chat/{id}`,
`/v1/chat/{id}/transcript`, `/v1/chat/{id}/metrics` read them back. It needs
`chat:create` (plus `agent:create` when attributing agents).

**None of this is in the SDK client** - there is no `client.chat.*`. Tell the user
to call the REST endpoint directly rather than writing a client method that does not
exist. And note **chats cannot be simulated**: simulation is voice/telephony only,
so the only way to grade chat quality is to ingest real chats and point a
`modality: 'chat'` metric policy at them (see `monitor-live-calls`).

## Importing from Vapi / Retell (not via this SDK)

Roark imports calls from Vapi, Retell, LiveKit, and Pipecat by **receiving their
webhooks**, not through an SDK method. Point the provider's end-of-call webhook at
Roark's provider ingestion endpoint, or record the call yourself and pass its
recording URL to `call.create` (using `vapiCallId` / `livekitRoomId` to link the
trace). There is no `client.vapi.*` / `client.retell.*` in the SDK - do not invent
one; use `call.create` or the webhook integration.
