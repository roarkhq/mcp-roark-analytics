---
name: build-run-plan
description: >-
  Use to configure and start a Roark simulation that tests a voice or chat
  agent: choose a testing goal (benchmark, flow adherence, red-teaming,
  knowledge grounding, tool-call accuracy, voicemail, load, health check),
  select which customer flows and how much of each to run, set iteration and
  concurrency, attach the metrics that grade it, preview the call count, and run.
  Use whenever someone asks to run a simulation, test their agent, or set up a
  run plan in Roark.
---

# Build a Roark simulation run plan

A **run plan** is the test matrix: which agent endpoints to call, which customer
flows to run and how much of each, with which personas, graded by which metrics.
A **run** executes a plan and places one simulated call per test case.

Work in this order. Do not skip step 5 (the call-count preview).

## 1. Pin down the goal

Ask (or infer) what the user is testing. Map it to a recipe in
[references/templates.md](references/templates.md). Each recipe lists the metric
slugs and the flow-sourcing that Roark's own templates use for that goal, for
example:

- "benchmark my agent" -> **live-bench** recipe
- "make sure it can't be jailbroken / leak PII" -> **red-teaming**
- "check it stays faithful to the knowledge base" -> **knowledge-base-grounding**
- "does it call the right tools" -> **tool-call-accuracy**
- "does it handle voicemail" -> **voicemail-testing**
- "will it hold up under load" -> **load-testing**

The public API has no `templateKey` parameter. A template is knowledge, not a
field: you assemble the same metrics and flows yourself. `configure-metrics`
turns a recipe's slugs into the `metrics` array.

## 2. Resolve the ids you will reference

A plan references endpoints, flows, and metrics by id or slug. Discover them:

```ts
// Agent endpoints (Roark dials/connects to these).
const endpoints = await client.agentEndpoint.list({ agentId })
// Customer flows already authored in the project.
const { data: flows } = await client.customerFlow.list()
// One flow's edge cases, when you want to name specific ones.
const flow = await client.customerFlow.getByID(flowId)
// Metrics available to attach (returns id, slug, name, type, calculationType).
const metrics = await client.metric.listDefinitions()
```

If the user has no flows yet, author one with `client.customerFlow.create(...)`
(confirm the shape with docs search) or run the happy path of a system flow.

## 3. Choose what to run for each flow

Flow selection is deliberate and **never defaulted**, because each thing you
select is a separate billable call. For each attached flow you set:

- `happyPath: true` to run its happy path, and/or
- `edgeCases: 'ALL'` (every edge case the flow has at run time) or an array of
  specific ones: `edgeCases: [{ id, personaOverrideId?, variables? }]`.

You must specify at least one of the two, or the API rejects the plan. Full
rules, overrides, and how to fan one flow across personas or languages are in
[references/flow-selection.md](references/flow-selection.md).

```ts
flows: [
  { id: flowId, happyPath: true, edgeCases: 'ALL' },
  { id: otherFlowId, happyPath: true }, // happy path only
]
```

## 4. Assemble the plan config

The config (shared by `simulation.run` and `simulationRunPlan.create`) is:

| field                          | required | default      | notes                                            |
| ------------------------------ | -------- | ------------ | ------------------------------------------------ |
| `name`                         | yes\*\*  |              | required on `simulationRunPlan.create`            |
| `description`                  | no       |              | free text                                        |
| `direction`                    | yes      |              | `INBOUND` or `OUTBOUND`                           |
| `agentEndpoints`               | yes      |              | `[{ id }]`, at least one                          |
| `metrics`                      | yes      |              | `[{ slug }]` or `[{ id }]`, at least one          |
| `flows`                        | yes\*    |              | `[{ id, happyPath?, edgeCases?, personaOverrideId?, variables? }]` |
| `maxSimulationDurationSeconds` | yes      |              | per-call cap, e.g. `300`                          |
| `iterationCount`               | no       | `1`          | 1-10000; repeats every test case, multiplies cost |
| `maxConcurrentJobs`            | no       | `5`          | parallelism, capped by your account quota        |
| `executionMode`                | no       | `PARALLEL`   | `PARALLEL`, `SEQUENTIAL_SAME_RUN_PLAN`, or `SEQUENTIAL_PROJECT` |
| `silenceTimeoutSeconds`        | no       | `30`         |                                                  |
| `endCallPhrases`               | no       | `['goodbye']`| empty array disables                             |
| `endCallReasons`               | no       | `[]`         | LLM-evaluated end conditions                     |

There is **no plain `SEQUENTIAL`** value: pick which sequencing you mean. There is
also no plan-level `variables` (they go on each `flows[]` entry or at run time), no
scheduling/cron, and no tags.

\* `flows` is the modern path. `scenarios` (+ a required `personas`) is the
deprecated alternative: you must send one or the other, **never both**, and a plan
with neither is rejected. Do not use `scenarios` for new work.
\*\* `name` is required by `simulationRunPlan.create`, and optional on an inline
`simulation.run({ plan })` unless you set `saveAsPlan: true`. Full field
reference: [references/run-plan-fields.md](references/run-plan-fields.md).

## 5. Preview the call count, then run (do not skip)

**Always show the user how many calls the run will place before spending.** The
safe pattern is create-then-start: creating a plan does not run it, and the
response carries `testCaseCount`.

```ts
const created = await client.simulationRunPlan.create({
  name: 'Billing regression',
  direction: 'OUTBOUND',
  maxSimulationDurationSeconds: 300,
  agentEndpoints: [{ id: endpointId }],
  metrics: [{ slug: 'call_outcome' }, { slug: 'instruction_follow' }],
  flows: [{ id: flowId, happyPath: true, edgeCases: 'ALL' }],
  iterationCount: 1,
})

// NOTE the nesting: create returns { runPlan, runPlanJob }, not the plan itself.
const plan = created.runPlan

// Tell the user: "This will place <testCaseCount> calls." Wait for go-ahead
// if the number is large or the user has not already approved it.
console.log(`This run will place ${plan.testCaseCount} calls.`)

// Then start it. Prefer simulation.run({ planId }) - simulationRunPlanJob.start
// is the deprecated twin and returns a smaller payload (no simulationJobCount).
const started = await client.simulation.run({ planId: plan.id })
```

For a quick one-off where the user has already accepted the cost, you can
configure and start in a single call. The response's `simulationJobCount` is the
number of calls placed:

```ts
const run = await client.simulation.run({
  plan: {
    name: 'Smoke test',
    direction: 'INBOUND',
    maxSimulationDurationSeconds: 300,
    agentEndpoints: [{ id: endpointId }],
    metrics: [{ slug: 'agent_spoke' }, { slug: 'time_to_first_word' }],
    flows: [{ id: flowId, happyPath: true }],
  },
  saveAsPlan: false, // true keeps it as a reusable plan; then plan.name is required
})
// run.simulationRunPlanJobId, run.simulationJobCount, run.simulationRunPlanId
```

To re-run an existing plan, pass its id: `client.simulation.run({ planId })`.
Runtime `variables` can override `{{placeholders}}` for this run only; see
flow-selection.md.

## 6. Report back

Give the user the run id (`simulationRunPlanJobId`), the call count, and how to
watch it. Poll with `client.simulationRunPlanJob.getByID(jobId)`: it returns the
run `status` and a `simulationJobs` array, each entry a call with its own
`status`, `processingStatus`, and `callId` once created. Reading per-call metrics
and transcripts (`client.call.listMetrics`, `client.call.getTranscript`) is
covered by the results workflow.

## Common mistakes

- **Omitting flow selection.** `{ id: flowId }` with neither `happyPath` nor
  `edgeCases` is rejected. Say what to run.
- **Mixing `flows` and `scenarios`.** A plan runs one or the other, not both.
- **Guessing metric slugs.** Confirm against `client.metric.listDefinitions()`;
  a slug that is not collected cannot grade anything.
- **Starting a large run without a count.** Create first, read `testCaseCount`,
  confirm, then start.
