# Run plan config: full field reference

These fields are shared by `client.simulationRunPlan.create(...)` and the `plan`
object of `client.simulation.run({ plan })`. Confirm exact names/types against
the installed SDK with the MCP docs search tool if a call is rejected.

## Required

- **`direction`** - `'INBOUND'` or `'OUTBOUND'`. Inbound means the simulated
  caller dials the agent; outbound means the agent dials out.
- **`agentEndpoints`** - `Array<{ id: string }>`, at least one. The endpoints
  Roark reaches the agent on. List with `client.agentEndpoint.list({ agentId })`.
- **`metrics`** - `Array<{ id?: string; slug?: string }>`, at least one. Each
  entry references a metric by exactly one of `id` (UUID) or `slug` (stable slug,
  e.g. `customer_satisfaction`). List with `client.metric.listDefinitions()`.
- **`maxSimulationDurationSeconds`** - integer, per-call hard cap (e.g. `300`).
- **`flows`** (or the deprecated `scenarios`) - at least one. See
  flow-selection.md.

## Optional (with defaults)

- **`iterationCount`** - integer, default `1`, max is large. Repeats every test
  case. Multiplies the call count directly.
- **`maxConcurrentJobs`** - integer, default `5`. Peak parallel calls, capped by
  the account quota.
- **`executionMode`** - `'PARALLEL'` (default) or `'SEQUENTIAL'`.
- **`silenceTimeoutSeconds`** - integer, default `30`.
- **`endCallPhrases`** - `string[]`, default `['goodbye']`. Empty array disables.
- **`endCallReasons`** - `string[]`, default `[]`. Semantic end conditions the
  LLM evaluates against the conversation (e.g. `'Order has been confirmed'`).
- **`description`** - string.
- **`name`** - required on `create`; on `simulation.run` it is optional unless
  `saveAsPlan` is true, in which case it is required.

## Deprecated

- **`scenarios`** - `Array<{ id, variables? }>`, the pre-flows way to describe
  what to run. Requires `personas`. Do not use for new plans.
- **`personas`** - `Array<{ id }>`. Only meaningful with `scenarios`; ignored
  with `flows`, where each variant carries its own persona.
- **`autoRun`** (on `create`) - runs the plan with only its pinned values. Prefer
  `simulation.run`, which also accepts runtime `variables`.

## Running

- **`client.simulation.run({ plan, saveAsPlan?, variables? })`** - configure and
  run in one call. Returns `{ simulationRunPlanJobId, status, createdAt,
  simulationRunPlanId, savedAsPlan, simulationJobCount }`. `saveAsPlan: true`
  keeps the config as a listed, re-runnable plan (needs `plan.name`); omitted or
  false gives a one-off backed by a hidden plan.
- **`client.simulation.run({ planId, variables? })`** - run an existing plan.
- **`client.simulationRunPlan.create({...})`** - create without running. Returns
  the plan resource including **`testCaseCount`** (the call count preview) and
  its `id`.
- **`client.simulationRunPlanJob.start(planId)`** - start a run of an existing
  plan.
- **`client.simulationRunPlanJob.getByID(jobId)`** - poll run status and its
  per-call `simulationJobs` (each with `status`, `processingStatus`, `callId`).
- **`client.simulationRunPlan.update(planId, { isHidden: false, name })`** -
  promote a one-off's hidden plan into a saved, reusable one.
