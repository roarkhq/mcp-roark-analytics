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
// run.status: RUNNING_SIMULATIONS ... COMPLETED | FAILED | CANCELLED | TIMED_OUT
// run.simulationJobs: one entry per call
```

Each entry in `simulationJobs` is a call attempt:

- `simulationJobId`, `status`, `processingStatus` (`PENDING` until it connects)
- `callId` - the graded call, once created (null while queued)
- `roarkPhoneNumber`, `persona`, `agentEndpoint`, timestamps

Wait for the run `status` to reach a terminal state before treating scores as
final. Filter to entries that have a `callId` to read results.

## 2. Read a call's metric scores

```ts
const metrics = await client.call.listMetrics(callId)
```

Each value carries: `slug`, `name`, `type`, `scope`, and **`captureStatus`**.
Always branch on `captureStatus` before reading `value`:

- `SUCCESS` - `value` is present (number, boolean, or string per `type`).
- `NOT_APPLICABLE` / `DATA_MISSING` / `ERROR` - no `value`. These rows only
  appear if you pass `?status=all`; `errorMessage` explains `ERROR`.

Useful extras: `valueReasoning` (why an LLM metric scored as it did),
`confidence`, `participantRole` (for per-participant metrics).

**Pass/fail:** a check metric (a `_check` slug, output type BOOLEAN) is the gate.
`value === true` is a pass. To answer "did the run pass", read the check metrics
across the run's calls; any check `false` is a failure worth surfacing, along
with its base metric's `value` and `valueReasoning`.

```ts
for (const m of metrics) {
  if (m.captureStatus !== 'SUCCESS') continue
  if (m.slug.endsWith('_check') && m.value === false) {
    // a gate failed — report it with the related base metric + reasoning
  }
}
```

## 3. Read a transcript

```ts
const transcript = await client.call.getTranscript(callId)
// transcript.participants[], transcript.entries[] (turns in order)
```

Use this to explain a failure: quote the turn where the agent went wrong. Call
metadata is available via `client.call.getByID(callId)`, and
`client.call.listSentimentRuns(callId)` for sentiment over the call.

## 4. Find a call by phone number

If you only have the number a Roark simulated caller used, resolve the job:

```ts
const job = await client.simulationJob.lookup({ phoneNumber: '+15551234567' })
const detail = await client.simulationJob.getByID(job.id)
```

## Reporting

Summarize for the user: run status, how many calls, which checks passed vs
failed, and for each failure the base metric value plus a one-line reason
(`valueReasoning`) and, when helpful, the transcript turn that caused it. Do not
present a metric's `value` without first confirming its `captureStatus` is
`SUCCESS`.
