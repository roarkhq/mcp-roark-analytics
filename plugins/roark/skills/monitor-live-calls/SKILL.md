---
name: monitor-live-calls
description: >-
  Use to grade REAL production calls and chats with Roark metrics (not
  simulations): create a metric policy that auto-evaluates matching live
  conversations, or run a one-off collection job to backfill metrics over a set
  of existing calls/chats. Use when someone wants continuous quality monitoring
  of production traffic, to score live calls, to backfill a new metric over past
  conversations, or to filter which live calls get evaluated.
---

# Monitor live calls and chats

Simulations test an agent *before* it ships (see `build-run-plan`). This skill is
the other half: grading the **real production conversations** an agent has after
it ships. Two resources do this, and they reference metrics **by id, not slug**
(unlike run plans):

- **metric policy** - a standing rule: "when a live call/chat matches these
  conditions, automatically collect these metrics." Fires on new production
  traffic going forward.
- **metric collection job** - a one-off batch: "compute these metrics over this
  explicit list of existing calls/chats." Use to backfill a new metric over past
  conversations, or grade a specific set on demand.

Metric definitions themselves are created with `configure-metrics`; this skill
decides *where and when* they run on live data.

## Resolve metric ids first

Policies and jobs take `metrics: [{ id }]` (definition **uuids**), so look them
up:

```ts
const defs = await client.metric.listDefinitions()
const ids = defs
  .filter((d) => ['call_outcome', 'sentiment_score'].includes(d.slug))
  .map((d) => ({ id: d.id }))
```

## Metric policy: continuous grading of production traffic

```ts
const policy = await client.metricPolicy.create({
  name: 'Evaluate all inbound support calls',
  modality: 'call', // 'call' | 'chat' - REQUIRED and immutable (see below)
  status: 'ACTIVE', // 'ACTIVE' | 'INACTIVE'; default ACTIVE
  metrics: ids, // [{ id }], at least one; must support this modality
  conditions: [
    // groups are OR'd together; conditions inside a group are AND'd
    { conditions: [
      { conditionType: 'AGENT', conditionKey: agentId },
      { conditionType: 'CALL_SOURCE', conditionKey: 'VAPI' },
    ] },
  ],
})
```

- **`modality`** (`call` | `chat`, lowercase) is **required and immutable** -
  changing it means creating a new policy. A policy may only reference metrics
  that support its modality.
- **`conditions`** is optional; **omit it to match every conversation.** Its shape
  is an array of groups OR'd together, each group `{ conditions: [...] }` whose
  entries are AND'd. Condition fields:
  - `conditionType`: `AGENT` (match an agent id) | `CALL_SOURCE` (source name,
    e.g. `VAPI`, `RETELL`, `API`) | `CALL_PROPERTY` (a `properties` key) |
    `INTEGRATION` (integration id).
  - `conditionKey`: the id / source / property key to match.
  - `conditionOperator` + `conditionValue`: **required for `CALL_PROPERTY`**,
    optional otherwise. Operators: `EQUALS`, `NOT_EQUALS`, `CONTAINS`,
    `STARTS_WITH`, `GREATER_THAN`, `LESS_THAN`, `GREATER_THAN_OR_EQUALS`,
    `LESS_THAN_OR_EQUALS`.
- **`status: 'INACTIVE'`** disables a policy without deleting it.

Update / list / delete:

```ts
await client.metricPolicy.update(policy.id, { status: 'INACTIVE' })
// conditions: omit = keep existing; [] = clear all conditions (match everything)
const { data } = await client.metricPolicy.list() // includes SYSTEM policies
await client.metricPolicy.delete(policy.id) // soft delete -> { deleted }
```

`type: 'SYSTEM'` policies are Roark-managed and **cannot be updated or deleted**
(400); only your `USER` policies are editable.

## Metric collection job: backfill over existing conversations

Names the conversations explicitly by id (there is no date-range selector):

```ts
const job = await client.metricCollectionJob.create({
  callIds: [callIdA, callIdB], // OR chatIds - exactly one of the two, never both
  metrics: ids, // [{ id }], 1-20
})
```

Caps, enforced server-side:

- exactly one of `callIds` / `chatIds`, each 1-500 ids;
- `metrics` 1-20;
- `conversations x metrics <= 5000` per job - split a larger backfill into several
  jobs.

It runs immediately and is credit-gated (can return **402** if the account is out
of credits). Poll it to completion:

```ts
const TERMINAL = new Set(['COMPLETED', 'FAILED', 'CANCELED'])
let j = await client.metricCollectionJob.getByID(job.id)
while (!TERMINAL.has(j.status)) {        // PENDING | PROCESSING | COMPLETED | FAILED | CANCELED
  await sleep(10_000)
  j = await client.metricCollectionJob.getByID(job.id)
}
// j.totalItems / completedItems / failedItems are call-metric pairs
```

Then read the resulting scores per call with `client.call.listMetrics(callId)`
(see `read-results`), branching on `captureStatus` before reading `value`.

## Which resource for which ask

- "Score every production call from now on" / "monitor quality live" -> **policy**
  (leave `conditions` off, or scope it to an agent / source).
- "I just wrote a new metric, grade the last N calls with it" -> **collection
  job** over those `callIds`.
- "Grade a specific handful of calls right now" -> **collection job**.
- "Test the agent before launch" -> not this skill; use `build-run-plan`.

> The customer API also exposes `POST /metric/collection-jobs/{id}/retry` and a
> per-job `metric-values` endpoint, but these are not in the SDK client - poll
> `getByID` and read per-call metrics as above. Confirm any additional surface
> with the MCP docs search tool.
