---
name: read-results
description: >-
  Use to read the results of a Roark simulation run: poll a run's status, list
  its calls, and read each call's metric scores (with pass/fail) and transcript.
  Use when someone asks how a run did, whether it passed, why a metric failed, or
  wants to inspect a specific simulated call.
---

# Read Roark run results

After `build-run-plan` starts a run, this skill reads what came back.

## 1. Poll the run

```ts
const run = await client.simulationRunPlanJob.getByID(jobId)
// run.simulationRunPlanJobId, run.simulationRunPlanId, run.status,
// run.createdAt, run.startedAt, run.endedAt, run.simulationJobs[]
```

`status` has **12** values, not 4:

`PENDING`, `QUEUED`, `CREATING_SNAPSHOTS`, `CREATING_SIMULATIONS`,
`PREPARING_CAPACITY`, `RUNNING_SIMULATIONS`, `ENDING_SIMULATIONS`, `CANCELLING`,
`COMPLETED`, `FAILED`, `TIMED_OUT`, `CANCELLED`.

**Terminal = `COMPLETED | FAILED | TIMED_OUT | CANCELLED`.** Poll until the status
is one of those four. Note `CANCELLING` and `ENDING_SIMULATIONS` are **not**
terminal, so never treat "starts with CANCEL" as finished.

Each entry in `simulationJobs` is one call attempt:

- `simulationJobId`, `status` (`PENDING`, `QUEUED`, `PROCESSING`, `COMPLETED`,
  `FAILED`, `TIMED_OUT`, `CANCELLED`, `CANCELLING`)
- `processingStatus`: `PENDING`, `CONNECTING`, `WAITING_FOR_OUTBOUND_CALL`,
  `SIMULATING`, `ENDING`, `ANALYZING`, `WAITING_FOR_LIVE_CONVERSATION`,
  `EVALUATING`, `COLLECTING_METRICS`, `COMPLETED`
- `callId` - the graded call, once created (`null` while queued)
- `roarkPhoneNumber` (`null` until a number is leased), `persona` (the full
  persona), `scenario` (`{ id, description }`), `agentEndpoint`, timestamps

Two gaps to know:

- **There is no error field.** A `FAILED` job carries no reason string. Infer from
  `processingStatus` and a missing `callId`, and say that plainly instead of
  inventing a cause.
- **No flow or edge-case identifier is returned.** For flow-based runs, `scenario`
  is the flow *variant* - you cannot map a call back to a named edge case from this
  response.

To find a run you did not just start:

```ts
const { data, pagination } = await client.simulationRunPlanJob.list({
  limit: 50,               // 1-50, default 20
  simulationRunPlanId,     // runs of one plan
  status: 'COMPLETED',
  labelName: 'nightly',    // unknown name returns an empty list, not an error
})
// list entries add `triggeredBy` but carry NO simulationJobs; getByID is the reverse
```

## 2. Read a call's metric scores

**The default response is grouped, not flat.** Pass `flatten: 'true'` for one row
per value, and `status: 'all'` to see non-SUCCESS rows at all:

```ts
const rows = await client.call.listMetrics(callId, { flatten: 'true', status: 'all' })
```

Grouped (the default) looks like:

```ts
// [{ metricDefinitionId, slug, metricId, name, description, type, scope, unit?,
//    values: [ { value?, captureStatus, context, ... } ] }]
```

so `captureStatus` and `value` live on entries inside `values[]`, **not** on the
top-level object. A loop over the default response reading `m.value` finds nothing.

Always branch on `captureStatus` before reading `value`:

- `SUCCESS` - `value` is present (number, boolean, or string per `type`).
- `NOT_APPLICABLE` / `DATA_MISSING` / `ERROR` - **no `value` field at all**. These
  appear only with `status: 'all'`; `errorMessage` explains `ERROR`.
  `NOT_APPLICABLE` usually means the metric does not apply to this kind of
  conversation (see `configure-metrics`), which is not a failure.

Per-value fields: `valueReasoning` (why an LLM metric scored as it did),
`confidence` (0-1), `context` (`CALL` | `SEGMENT` | `SEGMENT_RANGE`),
`participantRole` (lower-case `agent`/`customer`), `computedAt`, `policyIds`,
`segment` / `fromSegment` / `toSegment`, and - only for
`property_transcript_mismatch` - `propertyVerdicts` (`MATCH` | `MISMATCH` |
`NOT_MENTIONED` per property, with reasoning), which is the best explanation of a
property failure.

Only values from the latest collection job per metric are returned.

**Pass/fail:** a check metric (a `_check` slug, type BOOLEAN) is the gate.
`value === true` passes.

```ts
const rows = await client.call.listMetrics(callId, { flatten: 'true' })
for (const r of rows) {
  if (r.captureStatus !== 'SUCCESS') continue
  if (r.slug.endsWith('_check') && r.value === false) {
    // a gate failed — report it with the base metric value + r.valueReasoning
  }
}
```

A run only has gates if `_check` metrics were attached to the plan. **If none were,
this loop finds nothing and reports a false "pass"** - check that at least one
check metric is present before claiming the run passed.

## 3. Read a transcript

```ts
const transcript = await client.call.getTranscript(callId)
// transcript.participants[]: { type: AGENT | CUSTOMER | SIMULATED_CUSTOMER | BACKGROUND_SPEAKER, id, ... }
// transcript.entries[]: { participantId, role, text, startOffsetMs, endOffsetMs }
```

Use this to explain a failure: quote the turn where the agent went wrong. Call
metadata is available via `client.call.getByID(callId)`, and
`client.call.listSentimentRuns(callId)` for sentiment over the call.

## 4. Find a call by the number Roark dialed from

```ts
const job = await client.simulationJob.lookup({
  roarkPhoneNumber: '+15551234567', // required, E.164
  callReceivedAt: '2026-09-04T10:00:00Z', // optional; DEFAULTS TO NOW
})
// job.simulationJobId, job.callId, job.runPlan { id, name, variables }, persona, ...
```

Two traps: the parameter is **`roarkPhoneNumber`** (not `phoneNumber`), and
`callReceivedAt` defaults to *now*, which only matches a currently-ongoing call - so
looking up a finished call without it 404s. The response already is the full job
(its id field is `simulationJobId`), so no follow-up `getByID` is needed.
`simulationJob.*` is the only place you can see `runPlan.variables`, the resolved
variable values for that specific call.

## Reporting

Summarize for the user: run status, how many calls, which checks passed vs
failed, and for each failure the base metric value plus a one-line reason
(`valueReasoning`) and, when helpful, the transcript turn that caused it. Do not
present a metric's `value` without first confirming its `captureStatus` is
`SUCCESS`.
