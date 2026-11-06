---
name: manage-run-plans
description: >-
  Use when a Roark run plan already exists and you want to work with it as a
  saved test suite: find it ("our nightly suite", "the billing tests"), read what
  it covers, change its flows, metrics, or settings, re-run it by id, promote a
  one-off run into a saved suite, or delete it. Not for building a plan from
  scratch; that is build-run-plan (or simulate-quickstart for a first run).
---

# Reuse or update a saved test suite

A saved run plan is a re-runnable test suite: the same endpoints, flows,
personas, and metrics, run again by id. This skill is everything after the plan
exists.

## Use this when

- The user refers to an existing suite: "our nightly suite", "run the same
  tests as last time", "what plans do we have".
- You need to change what a suite covers, or save a one-off run so it can be
  repeated.
- You want to retire a suite.

## Use a different skill when

- No plan exists yet: `build-run-plan` (or `simulate-quickstart`).
- The run has started and you want results: `read-results`.
- You want the suite to block a deploy: `gate-ci` (it runs a saved plan by id).

## You will have

The plan id of the suite, its current `testCaseCount`, and, if asked, an edited
plan or a newly started run, always after the user confirmed the call count.

**Read first:** `../roark-concepts/run-plans.md`. A run snapshots the plan when it
starts: editing a flow, persona, or metric never changes a run that already
happened. That keeps runs comparable, and it is why you re-run to pick up a
change.

## 1. Find the plan

```ts
const { data: plans, pagination } = await client.simulationRunPlan.list({
  limit: 50, // 1-50, default 20
  searchText: 'billing', // matches name
  agentId, // optional: plans targeting one agent
})
```

**Hidden plans are not listed.** Every one-off `simulation.run({ plan })` without
`saveAsPlan: true` creates a hidden plan so it does not clutter this list.

Read one back in full (flows, metrics, endpoints, settings, `testCaseCount`):

```ts
const { data: plan } = await client.simulationRunPlan.getByID(planId)
```

## 2. Re-run it, after confirming the count

Worked example: "run the billing suite again".

```ts
const { data: plans } = await client.simulationRunPlan.list({ searchText: 'Billing regression' })
const { data: plan } = await client.simulationRunPlan.getByID(plans[0].id)

// Tell the user: "Billing regression places <plan.testCaseCount> billable calls. Run it?"
// Only after a yes:
const { data: run } = await client.simulation.run({ planId: plan.id })
// run.simulationRunPlanJobId, run.simulationJobCount
```

A flow attached with `edgeCases: 'ALL'` picks up edge cases added since the last
run, so the count can grow without anyone editing the plan. Read it fresh every
time.

Override `{{placeholder}}` values for one run without editing the plan by passing
`variables` (see `../build-run-plan/references/flow-selection.md`).

## 3. Update it

Every field is optional; omitted fields are left alone.

```ts
await client.simulationRunPlan.update(planId, {
  metrics: [{ slug: 'agent_expectations_check' }, { slug: 'instruction_follow_check' }],
  flows: [{ id: flowId, happyPath: true, edgeCases: 'ALL' }],
  iterationCount: 2,
})
```

Updatable: `name`, `description`, `direction`, `iterationCount`,
`maxConcurrentJobs`, `maxSimulationDurationSeconds`, `silenceTimeoutSeconds`,
`endCallPhrases`, `endCallReasons`, `executionMode`, `flows`, `personas`,
`agentEndpoints`, `metrics`, `isHidden`, and the deprecated `scenarios`.

- **An array replaces the whole set.** `flows: []` detaches every flow.
  `personas`, `agentEndpoints`, and `metrics` need at least one entry if sent.
- **`autoRun` is not updatable.**
- **Update does not re-check the flows-or-scenarios rule**, so a careless update
  can leave a plan that fails at run time. Re-read it afterwards.
- **A change to what runs is a change to cost.** Re-read `testCaseCount` and tell
  the user the new number before the next run.

## 4. Promote a one-off run into a saved suite

The run response carries `simulationRunPlanId` even for an unsaved run. Un-hide
it rather than rebuilding:

```ts
await client.simulationRunPlan.update(run.simulationRunPlanId, {
  name: 'Smoke suite',
  isHidden: false,
})
```

Or decide up front with `simulation.run({ plan, saveAsPlan: true })`, which
requires `plan.name`.

## 5. Delete it

```ts
await client.simulationRunPlan.delete(planId) // -> { deleted: true }
```

A soft delete, needing the `simulation:delete` permission. Past runs and their
results are unaffected. If the user only wants it out of the list, prefer
`isHidden: true`.

## Why saved plans matter for CI

A gate should point at a plan id kept in the repo, not an inline config, so the
suite is reviewable and changes show up in version control. `gate-ci` assumes
this.

## Next

- `read-results` after a re-run.
- `gate-ci` to run this suite on every release.
- `build-run-plan` for plan fields and flow selection details.
