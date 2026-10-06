---
name: gate-ci
description: >-
  Use to gate a deploy or CI pipeline on a Roark simulation: start a run, wait
  for it to finish, check whether the pass/fail metrics passed, and turn that
  into a green/red result (exit code). Use when someone wants Roark to block a
  release, run in CI, or answer "did this build pass its voice tests".
---

# Gate CI/CD on a Roark run

Roark's headline use is gating a deploy: run the simulation, and fail the
pipeline if the agent does not meet the bar. There is no single "gate" call, so
compose three steps: **start -> wait -> assert**.

**The gate is the checks, not the run.** `../roark-concepts/metrics.md`: a check
is a threshold metric that turns a score into a boolean, and it is free, because
thresholds are computed from values that already exist and reach no model. A
pipeline wired to a plan with no checks attached goes green forever without ever
having tested the bar.

## The credential CI runs as

CI needs its own credential, not a developer's. Default to having the **user**
create it: the New credential dialog in the dashboard, or
`roark credential create --name "CI deploy gate"` in their own terminal. They
paste the value into the CI secret store. That is one human step, and it keeps a
live key out of this conversation.

If you do mint it programmatically, `client.me.createAPIKey` returns the key
**exactly once**, in `key`:

```ts
const cred = await client.me.createAPIKey({
  name: 'CI deploy gate',
  scopes: ['WRITE'], // the gate starts a run; READ alone cannot
  permissions: ['simulation:run', 'simulation:read', 'call:read', 'metric:read'],
  expiresAt: '2026-12-31T23:59:59.000Z',
})
console.log(cred.id, cred.name) // never cred.key
```

The rules matter more than the call:

- **Never echo the key.** This MCP runs your snippet and its output lands in the
  transcript. Print `cred.id` and `cred.name`, never `cred.key`. Send the value
  straight to the secret store (`gh secret set ROARK_API_BEARER_TOKEN`), and never
  into a file in the repo - the workflow references the secret, it does not
  contain it.
- **It needs a personal credential.** A project API key gets a 403 whose message
  says exactly that. If `ROARK_API_BEARER_TOKEN` came from the dashboard's project
  keys, this call cannot work: tell the user, do not retry and do not go hunting
  for another route.
- **Narrow it.** Every omitted field copies the calling credential's value, so an
  unnarrowed mint is a clone of your own token. Ask for the smallest `scopes` and
  `permissions` the gate needs, and set an `expiresAt`. None of the three can ever
  exceed the credential that minted it, so narrowing is the only direction
  available.
- **One credential per pipeline**, named for it, so revoking is surgical.
  `client.me.listAPIKeys()` lists them with `lastUsedAt`, and
  `client.me.revokeAPIKey(id)` kills one.

## 1. Start the run

Use `build-run-plan` to configure and start. In CI you usually run a saved plan
by id so the test suite is version-controlled and stable:

```ts
const started = await client.simulation.run({ planId }) // or { plan: {...} }
const jobId = started.simulationRunPlanJobId
// started.simulationJobCount = calls this will place (log it; it bills)
```

Use `simulation.run`, not the deprecated `simulationRunPlanJob.start` - the latter
returns no `simulationJobCount`, so CI cannot log what it is about to spend.

## 2. Wait for it to finish

Poll `simulationRunPlanJob.getByID` until the run reaches a terminal status.
Terminal = `COMPLETED | FAILED | TIMED_OUT | CANCELLED`; the other eight statuses
(including `CANCELLING` and `ENDING_SIMULATIONS`) are still in flight. Back off
between polls and cap total wait so CI cannot hang forever.

```ts
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const TERMINAL = new Set(['COMPLETED', 'FAILED', 'TIMED_OUT', 'CANCELLED'])
let run = await client.simulationRunPlanJob.getByID(jobId)
while (!TERMINAL.has(run.status)) {
  await sleep(15_000) // poll interval
  run = await client.simulationRunPlanJob.getByID(jobId)
}
if (run.status !== 'COMPLETED') {
  // the run itself failed to execute — fail the gate and report run.status.
  // There is no error field on the run or its jobs; report the status as-is.
}
```

For a long suite, prefer a **webhook** over long polling: subscribe with
`client.webhook.create` to `SIMULATION_RUN_PLAN_JOB_COMPLETED`,
`SIMULATION_RUN_PLAN_JOB_FAILED`, and `SIMULATION_RUN_PLAN_JOB_CANCELLED`, and let
CI resume on the callback. See `subscribe-webhooks` for the full event list.

## 3. Assert the pass/fail metrics

A completed run is not automatically a pass. Read each call's `_check` metrics
(the boolean gates, see `configure-metrics` and `read-results`) and fail if any
is `false`.

```ts
let failures = []
let checksSeen = 0
for (const job of run.simulationJobs) {
  if (!job.callId) continue
  // flatten: 'true' is REQUIRED — the default response nests values[] per metric.
  const rows = await client.call.listMetrics(job.callId, { flatten: 'true' })
  for (const r of rows) {
    if (!r.slug.endsWith('_check')) continue
    checksSeen++
    if (r.captureStatus !== 'SUCCESS') continue // only SUCCESS carries a value
    if (r.value === false) {
      failures.push({ callId: job.callId, check: r.slug, reason: r.valueReasoning })
    }
  }
}

// Guard against a vacuous pass: no checks attached means nothing was gated.
if (checksSeen === 0) throw new Error('No _check metrics on this plan — the gate would always pass')

const passed = failures.length === 0
// In CI: process.exit(passed ? 0 : 1), and print `failures` so the log explains why.
```

## Turning it into a gate

- **Exit code is the contract.** `0` = pass, non-zero = fail. Print a summary
  (run id, call count, failed checks with reasons) so the CI log is actionable.
- **Decide what "fail" means** with the user: any failed check, or a threshold
  (e.g. pass rate >= 95%). Default to "any `_check` false fails the build" unless
  they say otherwise.
- **Budget the wait.** A hung run must time the job out, not the CI runner. Cap
  total poll time and treat exceeding it as a fail with a clear message.
- **Cost awareness carries over.** Each run places real calls; a per-commit gate
  multiplies that. Suggest a small, fast plan (see the `health-check` /
  `load-testing` recipes) for per-commit gates and the full suite for
  pre-release.

## GitHub Actions shape (illustrative)

```yaml
- name: Roark gate
  env:
    ROARK_API_BEARER_TOKEN: ${{ secrets.ROARK_API_BEARER_TOKEN }}
  run: node roark-gate.mjs # start -> wait -> assert, exit non-zero on failure
```

The script is the three steps above against `@roarkanalytics/sdk`. Keep the plan
id and the pass rule in the repo so the gate is reviewable.
