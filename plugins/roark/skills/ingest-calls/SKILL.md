---
name: ingest-calls
description: >-
  Use when you have a recording of a real call that already happened and want it
  in Roark for analysis: import it from a recording URL with call.create (plus an
  optional transcript, tool calls, agent and customer details), then list,
  fetch, and read calls back with their transcript, metrics, and sentiment. Not
  for grading production traffic automatically or backfilling scores; that is
  monitor-live-calls. Not for simulations; that is read-results.
---

# Import a real recording into Roark

Roark analyzes real calls as well as simulated ones. This skill puts a finished
call into Roark from its recording, and reads calls back.

**The split:** `ingest-calls` brings a call **in** (one recording at a time, or a
batch you loop over) and reads it. `monitor-live-calls` decides which calls get
**graded** with which metrics, from now on or retroactively.

## Use this when

- You have recordings from another system (a call center, a CRM, your own
  telephony) and want Roark to analyze them.
- You want to look up existing calls: filter, fetch one, read its transcript,
  metrics, or sentiment.

## Use a different skill when

- You want every production call graded automatically, or a new metric run over
  past calls: `monitor-live-calls`.
- Your calls come from Vapi, Retell, LiveKit, or Pipecat: those integrations send
  calls to Roark by webhook (see the end of this skill), no import code needed.
- The calls are simulations: `read-results`.

## You will have

A Roark call id for each recording (analysis runs asynchronously after import),
and the calls readable with their transcript, metrics, and sentiment.

## 1. Import a call

Worked example: import one support call, keyed on your own id so re-imports are
safe.

```ts
const { data: call } = await client.call.create({
  recordingUrl: 'https://storage.example.com/calls/98765.mp3', // required; WAV/MP3/MP4/OGG, signed URL ok
  startedAt: '2026-09-01T15:04:00Z', // required, ISO 8601
  interfaceType: 'PHONE', // 'PHONE' | 'WEB'
  callDirection: 'INBOUND', // 'INBOUND' | 'OUTBOUND'
  agent: { name: 'Frontdesk' }, // reuses an exact name match in the project, else creates
  externalId: 'crm-98765', // optional; unique per project, a re-import returns 409
  properties: { queue: 'billing' }, // optional; filterable, and matched by metric policies
})
// minimal response (id, status, agents, customers, externalId); analysis continues async
```

Optional fields worth knowing:

- `stereoRecordingUrl`: a two-channel recording, for better speaker separation.
- `transcript`: your own turns instead of Roark's transcription, as
  `{ role, startOffsetMs, endOffsetMs, text, ... }` with `role` `AGENT` or
  `CUSTOMER`.
- `toolInvocations`: the agent's tool calls (`{ name, parameters, result,
  startOffsetMs, agent, ... }`) so tool metrics can grade them.
- `customer` / `customers[]`: `{ label?, phoneNumberE164? }`.
- `endedStatus`: how the call ended (for example `CUSTOMER_ENDED_CALL`,
  `VOICE_MAIL_REACHED`, `AGENT_TRANSFERRED_CALL`); confirm the enum with SDK
  docs search.
- `vapiCallId` **or** `livekitRoomId` (never both): links the call to an existing
  trace.
- Agent linkage: `agent` or `agents[]`, never both. Each is `{ roarkId }`,
  `{ customId }`, or `{ name, description?, customId? }`. Optionally an
  `endpoint` and the `prompt.resolvedPrompt` used on that call.

Importing with agent attribution also needs the `agent:create` permission, or the
whole request is rejected (403).

## 2. Read calls back

```ts
const { data: calls, pagination } = await client.call.list({
  limit: 50, // 1-100
  status: 'ENDED',
  searchText: 'refund', // title, summary, transcript
  sortBy: 'startedAt', // createdAt (default) | startedAt | endedAt | duration | title | status
  sortDirection: 'desc', // default desc
  properties: { queue: { exists: true } }, // one operator per property
  simulationRunPlanJobId, // optional: only calls from one simulation run
})

const { data: one } = await client.call.getByID(callId)
// title, summary, status, durationMs, endedStatus, recordingUrl (pre-signed, about 1h),
// recordingUrlAccess, properties, policyIds, agents, customers
const { data: transcript } = await client.call.getTranscript(callId)
const { data: metrics } = await client.call.listMetrics(callId, { flatten: 'true' }) // branch on captureStatus, see read-results
const { data: sentiment } = await client.call.listSentimentRuns(callId)
// each: status, averageSentiment (0-1), averageCategoricalSentiment, commonEmotion
```

`recordingUrlAccess` is `AVAILABLE`, `NOT_AVAILABLE`, or `RESTRICTED`.
`RESTRICTED` means the credential lacks `recording:read`, not that the recording
is missing.

**Filter by agent or property value.** `GET /v1/call` also accepts `agentId`
(one UUID, or up to 100 comma-separated with no spaces) and
`properties[<name>][eq]=<value>` (case-insensitive exact match; built-in
`agent_name` / `agentName` and `agent_id` work too). The plugin's `list_calls`
tool accepts both today. The published SDK type for `call.list` declares
`sortBy`, `sortDirection`, and `properties.<name>.exists`, but not yet `agentId`
or `eq`, so a snippet passing those fails the code tool's typecheck until the
type is regenerated. Use `list_calls` for them.

## Chats (real, but not in the SDK)

Chats are the text mirror of calls: same participants, transcript, and metrics
model, no audio. Ingest with `POST /v1/chat` (`startTimestamp`, `endTimestamp`,
`messages[]` with `role: 'AGENT' | 'CUSTOMER'`, plus `agent`/`agents`, optional
`toolInvocations`, `properties`, `externalId`; needs `chat:create`), and read
with `GET /v1/chat`, `/v1/chat/{id}`, `/v1/chat/{id}/transcript`,
`/v1/chat/{id}/metrics`. **There is no `client.chat.*`**: call the REST endpoint
directly. Chats cannot be simulated; grade them with a `modality: 'chat'` policy
in `monitor-live-calls`.

## Calls from Vapi, Retell, LiveKit, Pipecat

These arrive by the provider's end-of-call webhook pointed at Roark, not through
an SDK method. There is no `client.vapi.*` or `client.retell.*`. Alternatively,
record the call yourself and import it with `call.create`, linking the trace with
`vapiCallId` or `livekitRoomId`.

## Next

- `monitor-live-calls` to grade imported or production calls with metrics.
- `configure-metrics` to choose or create those metrics.
- `read-results` for how to read metric rows safely (`captureStatus`).
