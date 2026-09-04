---
name: manage-run-plans
description: >-
  Use to manage saved Roark run plans as reusable test suites: list and search
  existing plans, read one back, update its flows/metrics/settings, promote a
  one-off run into a saved plan, re-run a plan by id, and delete a plan. Use when
  someone wants a named regression suite, to change what an existing suite tests,
  to find a previous plan, or to re-run the same tests.
---

# Manage saved run plans

A **run plan** is a saved test suite: the same matrix of endpoints, flows,
personas, and metrics, re-runnable by id. `build-run-plan` covers authoring and
starting one; this skill covers the lifecycle after that: finding, editing,
re-running, and retiring plans.

Reach for this when the user says "our nightly suite", "change what the billing
tests cover", "run the same tests as last time", or "what plans do we have".

## Find a plan

```ts
const { data, pagination } = await client.simulationRunPlan.list({
  limit: 50,        // 1-50, default 20
  after,            // cursor
  searchText: 'billing', // matches name
  agentId,          // plans targeting a given agent
})
```

**Hidden plans are excluded from this list.** Every one-off `simulation.run({ plan })`
without `saveAsPlan: true` still creates a plan behind the scenes, marked hidden, so
it does not clutter the suite list.

Read one back in full (flows, metrics, endpoints, settings, `testCaseCount`):

```ts
const plan = await client.simulationRunPlan.getByID(planId)
```

## Re-run a plan

```ts
const run = await client.simulation.run({ planId })
// run.simulationRunPlanJobId, run.simulationJobCount (calls it will place)
```

Override `{{placeholder}}` variables for one run without editing the plan by
passing `variables` (see `build-run-plan/references/flow-selection.md`). Then read
results with `read-results`.

## Update a plan

Every field is optional; omitted fields are left alone.

```ts
await client.simulationRunPlan.update(planId, {
  metrics: [{ slug: 'call_outcome' }, { slug: 'instruction_follow_check' }],
  flows: [{ id: flowId, happyPath: true, edgeCases: 'ALL' }],
  iterationCount: 2,
})
```

Updatable: `name`, `description`, `direction`, `iterationCount`,
`maxConcurrentJobs`, `maxSimulationDurationSeconds`, `silenceTimeoutSeconds`,
`endCallPhrases`, `endCallReasons`, `executionMode`, `flows`, `personas`,
`agentEndpoints`, `metrics`, `isHidden`, and the deprecated `scenarios`.

Things to know:

- **Passing an array replaces it wholesale**; `flows: []` (or `scenarios: []`)
  detaches all of them. `personas`, `agentEndpoints`, and `metrics` must have at
  least one entry if you send them at all.
- **`autoRun` is not updatable.**
- The create-time rule that you must have flows-or-scenarios (never both) is **not
  re-checked on update**, so a careless update can leave a plan in a shape that
  fails at run time. Re-read the plan after updating and confirm `testCaseCount`
  looks right.
- Changing what a plan runs changes its cost. Re-read `testCaseCount` and tell the
  user the new number before they run it.

## Promote a one-off run into a saved suite

If the user ran something ad hoc and now wants to keep it, un-hide it rather than
rebuilding it. The run response gives you `simulationRunPlanId` even for an unsaved
run:

```ts
const run = await client.simulation.run({ plan: { /* ... */ } })
// later: "actually, save that as our smoke suite"
await client.simulationRunPlan.update(run.simulationRunPlanId, {
  name: 'Smoke suite',
  isHidden: false,
})
```

You can also decide up front with `simulation.run({ plan, saveAsPlan: true })`,
which requires `plan.name`.

## Delete a plan

```ts
await client.simulationRunPlan.delete(planId) // -> { deleted: true }
```

This is a **soft delete** and needs the `simulation:delete` permission. Past runs
and their results are unaffected. Prefer `isHidden: true` if the user only wants it
out of the list.

## Why saved plans matter for CI

A gate should point at a **plan id in the repo**, not an inline config, so the test
suite is reviewable and changes to it show up in version control. `gate-ci` assumes
this. If the user is gating on an inline plan, suggest saving it and referencing the
id.
