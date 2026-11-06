---
name: read-results
description: >-
  Use when a Roark simulation has been started and someone asks how it went: poll
  the run to a finished status, list its calls, read each call's pass/fail checks
  and metric scores with their reasoning, and quote the transcript turn behind a
  failure. Also finds a simulated call by the number Roark dialed from. Not for
  production calls; for those see ingest-calls and monitor-live-calls.
---

# Read how a simulation went

After a run starts, this skill answers "did it pass, and if not, why".

## Use this when

- A run is in progress or finished and the user wants status, pass/fail, or the
  reason a check failed.
- You need to inspect one simulated call: its scores, reasoning, or transcript.

## Use a different skill when

- No run has started: `build-run-plan` or `simulate-quickstart`.
- The calls are real production calls, not simulations: `ingest-calls` reads
  them, `monitor-live-calls` grades them.
- You want to be notified when a run finishes instead of polling:
  `subscribe-webhooks`.
- You want the result to pass or fail a pipeline: `gate-ci` (it uses the same
  reads).

## You will have

The run's final status, how many calls ran, which checks passed and failed, and
for each failure the score, the one-line reason, and the transcript turn that
caused it.

**Before you report a pass:** a run that completes is not a run that passed.
Completion means the calls happened; checks say whether the agent met the bar. A
run with no checks attached has nothing to fail. See `../roark-concepts/metrics.md`.

## 1. Poll the run to a terminal status

```ts
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const TERMINAL = new Set(['COMPLETED', 'FAILED', 'TIMED_OUT', 'CANCELLED'])

let { data: run } = await client.simulationRunPlanJob.getByID(jobId)
while (!TERMINAL.has(run.status)) {
  await sleep(15_000)
  ;({ data: run } = await client.simulationRunPlanJob.getByID(jobId))
}
// run.status, run.startedAt, run.endedAt, run.simulationJobs[]
```

The run `status` has 12 values: `PENDING`, `QUEUED`, `CREATING_SNAPSHOTS`,
`CREATING_SIMULATIONS`, `PREPARING_CAPACITY`, `RUNNING_SIMULATIONS`,
`ENDING_SIMULATIONS`, `CANCELLING`, `COMPLETED`, `FAILED`, `TIMED_OUT`,
`CANCELLED`. Only the last four are terminal. `CANCELLING` and
`ENDING_SIMULATIONS` are still in flight.

Each `simulationJobs` entry is one call attempt: `simulationJobId`, `status`
(`PENDING`, `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `TIMED_OUT`,
`CANCELLED`, `CANCELLING`), `processingStatus` (where it got to, from `CONNECTING`
through `COLLECTING_METRICS` to `COMPLETED`), `callId` (null until the call
exists), `roarkPhoneNumber`, `persona`, `scenario`, `agentEndpoint`.

Two gaps to state plainly rather than paper over:

- **No error field.** A `FAILED` job carries no reason. Report its
  `processingStatus` and missing `callId`; do not invent a cause.
- **No flow or edge-case id.** `scenario` is the flow variant (`{ id,
  description }`), so you cannot map a call back to a named edge case from this
  response.

To find a run you did not start:

```ts
const { data: runs } = await client.simulationRunPlanJob.list({
  limit: 50,
  simulationRunPlanId, // runs of one plan
  status: 'COMPLETED',
})
// list entries carry no simulationJobs; getByID does
```

## 2. Read each call's checks and scores

Pass `flatten: 'true'` for one row per value, and `status: 'all'` to see rows
that did not succeed. The default response is grouped, with values nested under
`values[]`, so a loop reading `m.value` on it finds nothing.

Worked example: summarise every failed check in the run.

```ts
const failures = []
let checksSeen = 0
for (const job of run.simulationJobs) {
  if (!job.callId) {
    failures.push({ job: job.simulationJobId, check: 'call never connected', reason: job.processingStatus })
    continue
  }
  const { data: rows } = await client.call.listMetrics(job.callId, { flatten: 'true', status: 'all' })
  for (const r of rows) {
    if (!r.slug.endsWith('_check')) continue
    checksSeen++
    if (r.captureStatus !== 'SUCCESS') continue // NOT_APPLICABLE, DATA_MISSING, ERROR carry no value
    if (r.value === false) failures.push({ callId: job.callId, check: r.slug, reason: r.valueReasoning })
  }
}
if (checksSeen === 0) console.log('No _check metrics on this run: nothing could fail.')
```

Per-value fields: `value` (only on `SUCCESS`), `captureStatus`, `valueReasoning`
(why an LLM metric scored as it did), `confidence` (0-1), `context` (`CALL`,
`SEGMENT`, `SEGMENT_RANGE`), `participantRole`, `errorMessage` (on `ERROR`), and,
for `property_transcript_mismatch` only, `propertyVerdicts`. `NOT_APPLICABLE`
usually means the metric does not apply to this kind of call (see
`configure-metrics`); it is not a failure. Only the latest collection per metric
is returned.

## 3. Read the transcript behind a failure

```ts
const { data: transcript } = await client.call.getTranscript(callId)
// participants[]: { type: AGENT | CUSTOMER | SIMULATED_CUSTOMER | BACKGROUND_SPEAKER, id }
// entries[]: { participantId, role, text, startOffsetMs, endOffsetMs }
```

Quote the turn where the agent went wrong. Call metadata:
`client.call.getByID(callId)`; sentiment: `client.call.listSentimentRuns(callId)`.

## 4. Find a call by the number Roark dialed from

```ts
const { data: job } = await client.simulationJob.lookup({
  roarkPhoneNumber: '+15551234567', // required, E.164 (not `phoneNumber`)
  callReceivedAt: '2026-09-04T10:00:00Z', // optional, but DEFAULTS TO NOW
})
// job.simulationJobId, job.callId, job.runPlan { id, name, variables }, persona, ...
```

Without `callReceivedAt`, only a call in progress matches, so looking up a
finished call 404s. This is the only place the resolved `runPlan.variables` for
one call are visible.

## Reporting

Tell the user: run status, number of calls, checks passed vs failed, and for each
failure the check, the base score, the reason (`valueReasoning`), and the turn
that caused it. Never present a `value` without confirming its `captureStatus` is
`SUCCESS`.

**MCP note:** the plugin's `get_simulation_results` tool returns a run's results
in one call (it can also compare with another run); `list_call_metrics` and
`get_call_transcript` cover steps 2 and 3.

## Next

- Fix the agent, then re-run with `manage-run-plans`.
- `author-personas-flows` to add an edge case for a failure you found.
- `gate-ci` to make these checks block a release.
