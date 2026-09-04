---
name: subscribe-webhooks
description: >-
  Use to subscribe to Roark events over HTTP webhooks instead of polling: get
  notified when a simulation run or job finishes, a call or chat analysis
  completes, a metric collection job finishes, or an issue opens/resolves.
  Register, list, and delete webhook subscriptions, and verify their signatures.
  Use when someone wants event-driven notifications, to react to a run finishing,
  or to avoid long polling in CI.
---

# Subscribe to Roark webhooks

Most workflows poll (`simulationRunPlanJob.getByID`, `metricCollectionJob.getByID`).
For long-running work - a big simulation, a backfill, CI that should not sit in a
poll loop - subscribe to a webhook and let Roark call you when it finishes.

## Register a subscription

```ts
const sub = await client.webhook.create({
  url: 'https://your-app.example.com/hooks/roark', // required
  events: ['SIMULATION_RUN_PLAN_JOB_COMPLETED', 'SIMULATION_RUN_PLAN_JOB_FAILED'], // >= 1
  description: 'Notify CI when a run finishes',
  headers: { Authorization: 'Bearer ...' }, // optional; sent on every delivery
})
// sub.signingSecret is returned ONLY here, on create. Store it now; you cannot fetch it later.
```

## Event types

Pass one or more of these in `events`:

- **Simulation run plan job**: `SIMULATION_RUN_PLAN_JOB_STARTED`,
  `SIMULATION_RUN_PLAN_JOB_COMPLETED`, `SIMULATION_RUN_PLAN_JOB_FAILED`,
  `SIMULATION_RUN_PLAN_JOB_CANCELLED`.
- **Per-call simulation job**: `SIMULATION_JOB_STARTED`, `SIMULATION_JOB_COMPLETED`,
  `SIMULATION_JOB_FAILED`, `SIMULATION_JOB_CANCELLED`.
- **Call analysis**: `CALL_ANALYSIS_COMPLETED`, `CALL_ANALYSIS_FAILED`,
  `CALL_ANALYSIS_CANCELLED`.
- **Chat analysis**: `CHAT_ANALYSIS_COMPLETED`, `CHAT_ANALYSIS_FAILED`.
- **Metric collection job**: `METRIC_COLLECTION_JOB_COMPLETED`,
  `METRIC_COLLECTION_JOB_FAILED`.
- **Issues**: `ISSUE_OPENED`, `ISSUE_RESOLVED`.

Do not use `CALL_EVALUATION_COMPLETED` / `CALL_EVALUATION_FAILED` - they are
deprecated legacy events, not routed. If you need an event that is not listed,
confirm the current set with the MCP docs search tool rather than guessing a
string.

## Verify deliveries

Every delivery is signed with the `signingSecret` from create. Verify the
signature on your endpoint before trusting the payload, and (if you set custom
`headers`) check those too. Confirm the exact signature header and scheme with
docs search; do not skip verification on a public endpoint.

## List and delete

```ts
const { data } = await client.webhook.list({ limit: 50 }) // no signingSecret on reads
const one = await client.webhook.getByID(sub.id)
await client.webhook.delete(sub.id) // -> { success: true }
```

Reads never return the signing secret. If you lose it, delete the subscription
and create a new one to get a fresh secret.

## Using it in CI

`gate-ci` polls by default because it is simplest. For a long suite, swap the
poll loop for: register a `SIMULATION_RUN_PLAN_JOB_COMPLETED` (and `...FAILED`)
webhook, start the run, and let the pipeline resume on the callback. The assert
step (read each call's `_check` metrics) is unchanged.
