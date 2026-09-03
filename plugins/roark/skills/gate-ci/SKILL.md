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

## 1. Start the run

Use `build-run-plan` to configure and start. In CI you usually run a saved plan
by id so the test suite is version-controlled and stable:

```ts
const run = await client.simulation.run({ planId }) // or { plan: {...} }
const jobId = run.simulationRunPlanJobId
// run.simulationJobCount = calls this will place (log it; it bills)
```

## 2. Wait for it to finish

Poll `simulationRunPlanJob.getByID` until the run reaches a terminal status.
Terminal = `COMPLETED | FAILED | CANCELLED | TIMED_OUT`; anything else is still
running. Back off between polls and cap total wait so CI cannot hang forever.

```ts
const TERMINAL = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT'])
let run = await client.simulationRunPlanJob.getByID(jobId)
while (!TERMINAL.has(run.status)) {
  await sleep(15_000) // poll interval; use your runtime's timer
  run = await client.simulationRunPlanJob.getByID(jobId)
}
if (run.status !== 'COMPLETED') {
  // the run itself failed to execute — fail the gate and report run.status
}
```

For a long suite, prefer a **webhook** over long polling: subscribe with
`client.webhook.create` to the run-completion event and let CI resume on the
callback. Confirm the exact event-type name with docs search before relying on
it; do not guess the string.

## 3. Assert the pass/fail metrics

A completed run is not automatically a pass. Read each call's `_check` metrics
(the boolean gates, see `configure-metrics` and `read-results`) and fail if any
is `false`.

```ts
let failures = []
for (const job of run.simulationJobs) {
  if (!job.callId) continue
  const metrics = await client.call.listMetrics(job.callId)
  for (const m of metrics) {
    if (m.captureStatus !== 'SUCCESS') continue // only SUCCESS carries a value
    if (m.slug.endsWith('_check') && m.value === false) {
      failures.push({ callId: job.callId, check: m.slug, reason: m.valueReasoning })
    }
  }
}

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
