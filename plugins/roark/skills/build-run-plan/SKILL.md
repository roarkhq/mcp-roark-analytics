---
name: build-run-plan
description: >-
  Use when you have an agent endpoint and flows and need to design and start a
  Roark simulation in detail: map the testing goal (flow adherence, red teaming,
  conversation quality, multilingual, tool calls, voicemail, health check) to a
  recipe, select which flows and edge cases to run, set iterations and
  concurrency, attach metrics, create the plan, preview testCaseCount, confirm
  with the user, and start. For the end-to-end first run use
  simulate-quickstart; for an already-saved suite use manage-run-plans.
---

# Design and start a simulation

A **run plan** is the test matrix: which endpoints to call, which flows and how
much of each, with which personas, graded by which metrics. A **run** executes a
plan and places one simulated voice call per test case. Every call bills.

## Use this when

- The agent, endpoint, personas, and flows exist, and you need to assemble the
  plan and start it.
- You need the details: which flow parts to select, overrides, variables,
  iteration and concurrency, every plan field.

## Use a different skill when

- This is the first run and things may not exist yet: `simulate-quickstart`
  walks the whole path and calls into this skill.
- The plan is already saved and you want to re-run, edit, or delete it:
  `manage-run-plans`.
- The point is volume (hundreds of calls, concurrency limits):
  `simulate-load-testing`.
- The run has started and you want results: `read-results`.

## You will have

A saved run plan with a known `testCaseCount`, a user who has said yes to that
number, and a started run with its `simulationRunPlanJobId`.

**Read first:** `../roark-concepts/run-plans.md` (what a plan must bind, why
variant selection is never defaulted, what a run snapshots) and
`../roark-concepts/templates.md` (choosing a template by the question asked).

Work in this order. Do not skip step 5.

## 1. Map the goal to a recipe

| The user asks... | Recipe in [references/templates.md](references/templates.md) |
| --- | --- |
| "does it follow the flows we wrote" | flow-adherence |
| "does it sound natural and helpful" | conversation-quality |
| "can it be jailbroken, leak PII" | red-teaming |
| "does it work across languages" | multilingual |
| "does it call the right tools" | tool-call-accuracy |
| "does it stay faithful to the knowledge base" | knowledge-base-grounding |
| "does it handle voicemail" | voicemail-testing |
| "is it up" | health-check |
| "how good is it overall" | live-bench |
| "will it hold up under load" | load-testing, see `simulate-load-testing` |

There is no `templateKey` field to send. Assemble the recipe yourself: its metric
slugs go in `metrics` (via `configure-metrics`), its flows in `flows`. The
generated list of templates is `../roark-concepts/templates-catalogue.md`.

## 2. Resolve the ids

```ts
const { data: endpoints } = await client.agentEndpoint.list({ agentId })
const { data: flows } = await client.customerFlow.list({ searchText: 'Billing' })
const { data: flow } = await client.customerFlow.getByID(flowId) // edge case ids
const { data: defs } = await client.metric.listDefinitions() // confirm slugs
```

Inbound runs need an endpoint accepting `INCOMING`; outbound need `OUTGOING`. No
flows yet? Use `author-personas-flows` (or a `flows-*` playbook), or run the happy
path of a system flow (`customerFlow.list({ includeSystem: true })`).

## 3. Choose what runs for each flow

Nothing is defaulted, because each part you select is a billable call. Per flow
entry, set `happyPath: true`, `edgeCases: 'ALL'` (every edge case at run time),
`edgeCases: [{ id }]` (named ones), or a combination. An entry with neither is
rejected.

```ts
flows: [
  { id: billingFlowId, happyPath: true, edgeCases: 'ALL' },
  { id: cancelFlowId, happyPath: true }, // happy path only
]
```

Fanning one flow across personas or languages (attach it once per
`personaOverrideId`), per-edge-case overrides, and `{{variables}}` are in
[references/flow-selection.md](references/flow-selection.md).

## 4. Fill in the plan

| field | required | default | notes |
| --- | --- | --- | --- |
| `name` | on create | | required by `simulationRunPlan.create` |
| `direction` | yes | | `INBOUND` or `OUTBOUND` |
| `agentEndpoints` | yes | | `[{ id }]`, at least one |
| `metrics` | yes | | `[{ slug }]` or `[{ id }]`, at least one |
| `flows` | yes | | see step 3 |
| `maxSimulationDurationSeconds` | yes | | per-call cap, e.g. `300` |
| `iterationCount` | no | `1` | 1-10000; repeats every test case, multiplies cost |
| `maxConcurrentJobs` | no | `5` | parallel calls, capped by the account quota |
| `executionMode` | no | `PARALLEL` | or `SEQUENTIAL_SAME_RUN_PLAN`, `SEQUENTIAL_PROJECT` |
| `silenceTimeoutSeconds` | no | `30` | |
| `endCallPhrases` | no | `['goodbye']` | empty array disables |
| `endCallReasons` | no | `[]` | LLM-evaluated end conditions |

There is no plain `SEQUENTIAL`, no plan-level `variables`, no schedule, and no
tags. Do not use the deprecated `scenarios` + `personas` shape for new plans; a
plan sends `flows` or `scenarios`, never both. Every field:
[references/run-plan-fields.md](references/run-plan-fields.md).

## 5. Create, preview, confirm, start

Worked example: a billing regression on one inbound endpoint.

```ts
const { data: created } = await client.simulationRunPlan.create({
  name: 'Billing regression',
  direction: 'INBOUND',
  maxSimulationDurationSeconds: 300,
  agentEndpoints: [{ id: endpointId }],
  metrics: [
    { slug: 'agent_expectations_check' },
    { slug: 'scenario_adherence_check' },
    { slug: 'instruction_follow_check' },
  ],
  flows: [{ id: billingFlowId, happyPath: true, edgeCases: 'ALL' }],
  iterationCount: 1,
})
const plan = created.runPlan // create returns { runPlan, runPlanJob }; creating never runs it

// Stop. Tell the user, for example:
// "This plan places 5 simulated calls to +1 555 555 1234. Each is billable. Start it?"
console.log(`This run will place ${plan.testCaseCount} calls.`)
```

Check `testCaseCount` against your own arithmetic (the formula is in
[references/flow-selection.md](references/flow-selection.md)). If they differ,
find out why before going on. **Only after the user says yes:**

```ts
const { data: run } = await client.simulation.run({ planId: plan.id })
// run.simulationRunPlanJobId, run.simulationJobCount (calls placed)
```

Use `simulation.run({ planId })`, not the deprecated `simulationRunPlanJob.start`,
which returns no `simulationJobCount`.

**One-off runs.** `simulation.run({ plan: {...}, saveAsPlan: false })` configures
and starts in one call, so it has no preview. Use it only when the user has
already accepted a count you computed. It still creates a hidden plan
(`run.simulationRunPlanId`), which `manage-run-plans` can promote later.

**MCP note:** the plugin's `run_simulation` tool starts calls immediately and the
plugin has no create-without-running tool. Work the count out, state it, wait for
a yes, then call it; its `simulationJobCount` confirms what was placed. For an
API-computed preview, create the plan on the local code-execution server and run
it by `planId`.

## 6. Report back

Give the user the run id (`simulationRunPlanJobId`), the call count, and how to
watch it. Polling and reading scores is `read-results`.

## Common mistakes

- **No selection on a flow entry.** `{ id }` alone is rejected.
- **Mixing `flows` and `scenarios`.**
- **Guessing metric slugs.** Confirm with `listDefinitions()`.
- **No checks attached.** The run cannot fail; see `configure-metrics`.
- **Expectations without `agent_expectations_check`.** They are never graded.
- **Starting without a count.** Create, read `testCaseCount`, confirm, then start.

## Next

- `read-results` to poll the run and read checks and transcripts.
- `manage-run-plans` to re-run or edit this plan later.
- `gate-ci` to block a release on it.
