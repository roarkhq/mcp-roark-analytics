---
name: subscribe-webhooks
description: >-
  Use when you want Roark to call your HTTP endpoint when something finishes,
  instead of polling: a simulation run or single simulated call completes or
  fails, a call or chat analysis completes, a metric collection job finishes, or
  an issue opens or resolves. Create, list, and delete subscriptions and verify
  their signatures. Not for making your agent dial out; that is
  configure-outbound-dial.
---

# Get notified when a run or analysis finishes

Most skills poll (`simulationRunPlanJob.getByID`, `metricCollectionJob.getByID`).
For long work, such as a big run, a backfill, or CI that should not sit in a loop,
subscribe once and let Roark call you.

## Use this when

- A pipeline or app should react the moment a run, analysis, or backfill ends.
- Polling is too slow or too long for the job at hand.
- You want an alert when Roark opens or resolves an issue.

## Use a different skill when

- Roark must send a request that makes your agent place an outbound call:
  `configure-outbound-dial`.
- You only need to check a run once: `read-results` polls it.
- You want a pass/fail gate: `gate-ci` (it can use these webhooks instead of
  polling).

## You will have

A webhook subscription id for the events you chose, its signing secret stored on
your side, and an endpoint that verifies each delivery.

## 1. Create the subscription

Worked example: tell CI when a run ends, in any terminal way.

```ts
const { data: sub } = await client.webhook.create({
  url: 'https://ci.example.com/hooks/roark', // required
  events: [
    'SIMULATION_RUN_PLAN_JOB_COMPLETED',
    'SIMULATION_RUN_PLAN_JOB_FAILED',
    'SIMULATION_RUN_PLAN_JOB_CANCELLED',
  ], // at least one
  description: 'Resume CI when a Roark run ends',
  headers: { Authorization: 'Bearer <your token>' }, // optional; sent on every delivery
})
// sub.signingSecret is returned ONLY here. Store it now; it cannot be fetched later.
```

## 2. Pick the events

- **Run (the batch):** `SIMULATION_RUN_PLAN_JOB_STARTED`,
  `SIMULATION_RUN_PLAN_JOB_COMPLETED`, `SIMULATION_RUN_PLAN_JOB_FAILED`,
  `SIMULATION_RUN_PLAN_JOB_CANCELLED`.
- **One simulated call:** `SIMULATION_JOB_STARTED`, `SIMULATION_JOB_COMPLETED`,
  `SIMULATION_JOB_FAILED`, `SIMULATION_JOB_CANCELLED`.
- **Call analysis:** `CALL_ANALYSIS_COMPLETED`, `CALL_ANALYSIS_FAILED`,
  `CALL_ANALYSIS_CANCELLED`.
- **Chat analysis:** `CHAT_ANALYSIS_COMPLETED`, `CHAT_ANALYSIS_FAILED`.
- **Metric collection job:** `METRIC_COLLECTION_JOB_COMPLETED`,
  `METRIC_COLLECTION_JOB_FAILED`.
- **Issues:** `ISSUE_OPENED`, `ISSUE_RESOLVED`.

Do not use `CALL_EVALUATION_COMPLETED` / `CALL_EVALUATION_FAILED`: they are
deprecated and not routed. For an event not listed here, confirm the current set
with SDK docs search rather than guessing a string.

## 3. Verify every delivery

Each delivery is signed with the `signingSecret`. Verify it on your endpoint
before trusting the payload, and check your custom `headers` too. Confirm the
exact signature header and scheme with docs search. Do not skip verification on a
public endpoint.

## 4. List and delete

```ts
const { data: subs } = await client.webhook.list({ limit: 50 }) // reads never include the secret
const { data: one } = await client.webhook.getByID(sub.id)
await client.webhook.delete(sub.id) // -> { success: true }
```

Lost the secret? Delete the subscription and create a new one.

## Next

- `gate-ci` to resume a pipeline on the callback, then assert the checks.
- `read-results` to read the run the event points at.
- `monitor-live-calls` for the backfill jobs behind the metric collection events.
