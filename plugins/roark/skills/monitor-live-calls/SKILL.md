---
name: monitor-live-calls
description: >-
  Use when you want real production calls or chats graded with Roark metrics:
  a metric policy that automatically scores matching live conversations from now
  on, or a metric collection job that backfills scores over existing calls (for
  example after writing a new metric). Not for importing recordings; that is
  ingest-calls. Not for testing before launch; that is simulate-quickstart.
---

# Grade live production calls

Simulations test an agent before it ships. This skill grades the real
conversations it has after it ships.

**The split:** `ingest-calls` brings a recording **in**. This skill decides which
real calls get **graded**, with which metrics: going forward (a policy) or
looking back (a collection job).

## Use this when

- "Score every production call from now on" or "monitor quality on live
  traffic": a **metric policy**.
- "I wrote a new metric, grade last week's calls with it" or "grade these 50
  calls now": a **metric collection job**.
- You need to narrow which live calls are graded (one agent, one source, one
  property value).

## Use a different skill when

- The call is not in Roark yet: `ingest-calls` imports it (provider
  integrations send calls automatically).
- You want to test before launch: `simulate-quickstart` or `build-run-plan`.
- You need to choose or create the metrics themselves: `configure-metrics`.
- You want collectors declared in a repo: `manage-config-as-code`.

## You will have

Either an `ACTIVE` policy that grades new matching conversations as they arrive,
or a finished collection job whose scores you can read per call.

**Read first:** the collectors section of `../roark-concepts/metrics.md`.
Policies **only score forward**. A policy created today says nothing about last
month, so a new metric plus a new policy correctly shows an empty chart until
new calls arrive. Scoring the past is a collection job.

## 1. Resolve metric ids

Policies and jobs take metrics **by id**, not slug (unlike run plans):

```ts
const { data: defs } = await client.metric.listDefinitions()
const metrics = defs
  .filter((d) => ['call_outcome', 'sentiment_score', 'compliance_pii_handling_check'].includes(d.slug))
  .map((d) => ({ id: d.id }))
```

## 2. Grade new production calls: a metric policy

Worked example: grade every call handled by one agent that arrived through
Vapi.

```ts
const { data: policy } = await client.metricPolicy.create({
  name: 'Support agent: live quality',
  modality: 'call', // 'call' | 'chat'; required and immutable
  status: 'ACTIVE', // default ACTIVE; INACTIVE pauses without deleting
  metrics, // [{ id }], at least one, all supporting this modality
  conditions: [
    // groups are OR'd; conditions inside a group are AND'd
    {
      conditions: [
        { conditionType: 'AGENT', conditionKey: agentId },
        { conditionType: 'CALL_SOURCE', conditionKey: 'VAPI' },
      ],
    },
  ],
})
```

- **Omit `conditions` to match every conversation.**
- `conditionType`: `AGENT` (an agent id), `CALL_SOURCE` (for example `VAPI`,
  `RETELL`, `API`), `CALL_PROPERTY` (a `properties` key), or `INTEGRATION` (an
  integration id).
- `CALL_PROPERTY` also needs `conditionOperator` and `conditionValue`.
  Operators: `EQUALS`, `NOT_EQUALS`, `CONTAINS`, `STARTS_WITH`, `GREATER_THAN`,
  `LESS_THAN`, `GREATER_THAN_OR_EQUALS`, `LESS_THAN_OR_EQUALS`.
- `modality` cannot change; a chat policy is a new policy.
- These field names are the SDK shape. Config-as-code collectors express the same
  idea with a different vocabulary (`filters` with `type` / `key` / `operator` /
  `value`, metrics by slug). Do not mix them; see `manage-config-as-code`.

Maintain:

```ts
await client.metricPolicy.update(policy.id, { status: 'INACTIVE' })
// conditions: omit = keep; [] = clear (match everything)
const { data: policies } = await client.metricPolicy.list() // includes SYSTEM policies
await client.metricPolicy.delete(policy.id) // soft delete
```

`type: 'SYSTEM'` policies are managed by Roark and cannot be updated or deleted
(400). Only your `USER` policies are editable.

## 3. Grade calls that already happened: a collection job

Name the conversations by id; there is no date-range selector, so gather ids
with `client.call.list` first (see `ingest-calls`).

```ts
const { data: job } = await client.metricCollectionJob.create({
  callIds: [callIdA, callIdB], // or chatIds; exactly one of the two
  metrics, // [{ id }], 1-20
})
```

Limits: 1-500 ids, 1-20 metrics, and `conversations x metrics <= 5000` per job.
Split larger backfills. It starts immediately and uses credits (a **402** means
the account is out). Poll it:

```ts
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const TERMINAL = new Set(['COMPLETED', 'FAILED', 'CANCELED']) // note: CANCELED, one L
let { data: j } = await client.metricCollectionJob.getByID(job.id)
while (!TERMINAL.has(j.status)) {
  await sleep(10_000)
  ;({ data: j } = await client.metricCollectionJob.getByID(job.id))
}
// j.totalItems, j.completedItems, j.failedItems count call-metric pairs
```

Then read each call's scores with
`client.call.listMetrics(callId, { flatten: 'true' })`, branching on
`captureStatus` before `value` (see `read-results`).

The API also has `POST /metric/collection-jobs/{id}/retry` and a per-job
metric-values route, but neither is in the SDK client.

## Next

- `configure-metrics` to create a metric worth monitoring.
- `ingest-calls` to bring calls in and list them.
- `subscribe-webhooks` for `METRIC_COLLECTION_JOB_COMPLETED` instead of polling.
