---
name: gate-ci
description: >-
  Use when a deploy or CI pipeline should pass or fail on a Roark simulation:
  run a saved plan, wait for it to finish, check every pass/fail metric, and exit
  non-zero if any failed, with a CI credential that is narrowly scoped and never
  printed. Use for "block the release if the voice tests fail" or "did this build
  pass". Not for a one-off look at results; that is read-results.
---

# Block a release on simulation results

There is no single "gate" call. A gate is three steps: **start -> wait ->
assert**, plus a credential CI can run as.

## Use this when

- A pipeline should go red when the agent fails its simulation checks.
- Someone asks "did this build pass its voice tests" in an automated way.

## Use a different skill when

- You want to look at one run's results by hand: `read-results`.
- The suite does not exist yet: build it with `build-run-plan` and save it
  (`manage-run-plans`), then gate on its id.
- You want CI to wait on a callback instead of polling: add `subscribe-webhooks`.

## You will have

A script (for example `roark-gate.mjs`) that runs a saved plan by id, waits with a
time cap, fails if any `_check` is false or if no checks ran, prints why, and
exits `0` or `1`. Plus a CI secret holding a narrowly scoped Roark key.

**The gate is the checks, not the run.** A check is a threshold metric that turns
a score into a boolean (`../roark-concepts/metrics.md`). A plan with no checks
attached goes green forever without testing anything.

## 1. The credential CI runs as

Default to having the **user** create it: the New credential dialog in the
dashboard, or `roark credential create --name "CI deploy gate"` in their own
terminal. They paste it into the CI secret store. One human step keeps a live key
out of this conversation.

If you mint it in code, `client.me.createAPIKey` returns the key **exactly once**:

```ts
const ninetyDays = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
const { data: cred } = await client.me.createAPIKey({
  name: 'CI deploy gate',
  projectId, // pass it explicitly; you must be an ADMIN of this project
  scopes: ['WRITE'], // the gate starts a run; READ alone cannot
  permissions: ['simulation:run', 'simulation:read', 'metric:read'],
  expiresAt: ninetyDays, // capped by the minting credential's expiry
})
console.log(cred.id, cred.name) // never cred.key
```

- **Never print the key.** Snippet output lands in the transcript. Print `cred.id`
  and `cred.name` only, never `cred.key` or the whole response (the docs-search
  example ends with `console.log(response)`; do not copy it). Send the value to
  the secret store (`gh secret set ROARK_API_BEARER_TOKEN`), never into a repo
  file.
- **Two different 403s.** A project API key gets "these endpoints describe a
  person" (this needs a personal credential). A non-admin gets "only project
  admins can create a personal credential for this project". Read which one it
  was; do not retry either. Omitting `projectId` without a default project is a
  400.
- **Narrow it.** Omitted fields copy the calling credential, so an unnarrowed mint
  clones your token. The three permissions above are what the gate calls; the full
  table is in `../roark-overview/references/conventions.md`.
- **One credential per pipeline**, so revoking is surgical:
  `client.me.listAPIKeys()` shows `lastUsedAt`, `client.me.revokeAPIKey(id)`
  revokes.

## 2. The gate script

Worked example: the three steps as one script.

```ts
// roark-gate.mjs: start -> wait -> assert
import Roark from '@roarkanalytics/sdk'
const client = new Roark() // reads ROARK_API_BEARER_TOKEN
const planId = process.env.ROARK_PLAN_ID // a saved plan id kept in the repo
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// 1. Start. The plan's size was agreed when it was saved; log what this spends.
const { data: started } = await client.simulation.run({ planId })
const jobId = started.simulationRunPlanJobId
console.log(`Run ${jobId}: ${started.simulationJobCount} billable calls`)

// 2. Wait, with a cap so a hung run fails the job instead of the runner.
const TERMINAL = new Set(['COMPLETED', 'FAILED', 'TIMED_OUT', 'CANCELLED'])
const deadline = Date.now() + 30 * 60 * 1000
let { data: run } = await client.simulationRunPlanJob.getByID(jobId)
while (!TERMINAL.has(run.status)) {
  if (Date.now() > deadline) {
    console.error(`Gate timed out with run in ${run.status}`)
    process.exit(1)
  }
  await sleep(15_000)
  ;({ data: run } = await client.simulationRunPlanJob.getByID(jobId))
}
if (run.status !== 'COMPLETED') {
  console.error(`Run ended ${run.status}`) // there is no error field; report the status
  process.exit(1)
}

// 3. Assert every check. flatten: 'true' is required; the default nests values[].
const failures = []
let checksSeen = 0
for (const job of run.simulationJobs) {
  if (!job.callId) {
    failures.push({ job: job.simulationJobId, check: 'no call', reason: job.processingStatus })
    continue
  }
  const { data: rows } = await client.call.listMetrics(job.callId, { flatten: 'true' })
  for (const r of rows) {
    if (!r.slug.endsWith('_check')) continue
    checksSeen++
    if (r.captureStatus !== 'SUCCESS') continue
    if (r.value === false) failures.push({ callId: job.callId, check: r.slug, reason: r.valueReasoning })
  }
}
if (checksSeen === 0) {
  console.error('No _check metrics on this plan: the gate would always pass')
  process.exit(1)
}
console.log(failures.length ? failures : 'All checks passed')
process.exit(failures.length ? 1 : 0)
```

```yaml
# GitHub Actions (illustrative)
- name: Roark gate
  env:
    ROARK_API_BEARER_TOKEN: ${{ secrets.ROARK_API_BEARER_TOKEN }}
    ROARK_PLAN_ID: <saved plan id>
  run: node roark-gate.mjs
```

Use `simulation.run`, not the deprecated `simulationRunPlanJob.start`, which
returns no `simulationJobCount`.

## 3. Decide the rules with the user

- **What fails the build:** default to "any `_check` false fails". If they want a
  pass rate (for example 95% of calls), make it explicit in the script.
- **Cost per pipeline run:** every gate run places real billable calls, and a
  per-commit gate multiplies that. Confirm the plan's `testCaseCount` with the
  user when saving it, then prefer a small plan (the health-check or a
  happy-path-only suite) per commit and the full suite before release.
- **Keep the plan id and the pass rule in the repo** so the gate is reviewable.
- **Long suites:** replace the poll loop with a `SIMULATION_RUN_PLAN_JOB_*`
  webhook (`subscribe-webhooks`). The assert step is unchanged.

## Next

- `manage-run-plans` to save and maintain the suite the gate runs.
- `configure-metrics` to make sure the plan carries checks.
- `read-results` to dig into a failed gate.
