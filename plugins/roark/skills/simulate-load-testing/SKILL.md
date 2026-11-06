---
name: simulate-load-testing
description: >-
  Use to run Roark's Load testing simulation template against a voice agent:
  choose one flow, set iterationCount and maxConcurrentJobs, attach the load
  metrics, preview the (large, billable) call count, ramp up in stages, and read
  latency, dropped calls, and failures from the results. Use when someone asks
  whether their agent holds up under volume, concurrency, or a traffic spike.
---

# Load testing a voice agent

The **Load testing** template runs many simulations in parallel to surface
latency, dropped calls, and concurrency limits (see
`../roark-concepts/templates-catalogue.md`). This skill is how to set it up
safely. The plan mechanics are `build-run-plan`; read its step 5 before starting
anything.

## Read this first: volume is the whole point, and every call bills

A load test is the one run where the call count is meant to be large, which is
exactly why it is the easiest place to spend far more than intended.

- **Every simulated call is a real, billable call.** A load test of
  `iterationCount: 500` is 500 billable calls.
- **The agent's own stack bills too.** Telephony, speech, and model providers
  behind the agent under test charge for each call Roark places. Tell the user.
- **Warn the owners of the agent.** A load test against a production number looks
  like a traffic spike to their providers and their on-call. Prefer a staging
  endpoint, and get explicit approval for production.
- **Never start a load run without stating `testCaseCount` and getting a yes.**
  Not for a ramp step, not for a re-run. Each stage is its own confirmation.

## 1. Pick one flow, happy path only

Load tests measure the agent's infrastructure, not its conversation logic, so
keep the conversation simple and repeatable: one short improv flow, happy path
only, quiet environment. Reuse an existing flow (`client.customerFlow.list()`) or
create a minimal one with `author-personas-flows`. Do not use `edgeCases: 'ALL'`
here; it multiplies the count by the number of edge cases.

A short, realistic brief that ends naturally keeps each call cheap and
comparable:

```ts
happyPath: {
  title: 'Short status check',
  prompt: 'You want to confirm your appointment tomorrow at 10am. Once confirmed, say thanks and goodbye.',
  personaOverrideId: calmPersonaId,
  environmentId: quietEnvId,
}
```

## 2. Configure volume

Two fields control load, both in `../build-run-plan/references/run-plan-fields.md`:

- **`iterationCount`** (1-10000) repeats every test case. With one flow, one
  happy path, and one endpoint, the call count equals `iterationCount`.
- **`maxConcurrentJobs`** (default 5) is peak parallel calls. It is **capped by
  the account quota**; asking for more does not exceed it. Concurrency is what
  stresses the agent; iterations are what you pay for.
- `executionMode` stays `'PARALLEL'` (the default). The sequential modes defeat
  the purpose.
- Keep `maxSimulationDurationSeconds` tight (for example `120` for the brief
  above) so a stuck call does not run long.

Call count = `flows x (happyPath) x personas x endpoints x iterationCount`. Use
one endpoint unless the user explicitly wants to load several.

## 3. Metrics

The load-testing recipe in `../build-run-plan/references/templates.md`:

- `agent_responsive_check` (pulls in `agent_responsive`): did the agent answer
  and keep responding.
- `response_time`, `time_to_first_word`: latency per call.
- Optionally `latency_spike_count` and `call_duration`.

Confirm each with `client.metric.listDefinitions()`. Keep the metric set small:
only threshold, temporal, and formula metrics are free (see
`../roark-concepts/metrics.md`), and a load test does not need conversation-quality
grading on every call.

## 4. Ramp in stages

Do not open at full volume. Run the same plan shape at increasing sizes and stop
at the first stage that degrades. The user picks the numbers; a typical shape:

| stage | `maxConcurrentJobs` | `iterationCount` | calls |
| --- | --- | --- | --- |
| smoke | 2 | 4 | 4 |
| baseline | 5 | 20 | 20 |
| target | the user's expected peak | the user's choice | = iterationCount |

These numbers are an example of the shape, not a recommendation for any agent.
Ask the user what peak concurrency they expect in production and stop there.

```ts
const { data: created } = await client.simulationRunPlan.create({
  name: 'Load: baseline',
  direction: 'INBOUND',
  maxSimulationDurationSeconds: 120,
  agentEndpoints: [{ id: stagingEndpointId }],
  metrics: [{ slug: 'agent_responsive_check' }, { slug: 'response_time' }, { slug: 'time_to_first_word' }],
  flows: [{ id: flowId, happyPath: true }],
  iterationCount: 20,
  maxConcurrentJobs: 5,
})
const plan = created.runPlan

// Stop here. Tell the user:
// "This stage places <plan.testCaseCount> billable calls, up to 5 at a time, against <endpoint>.
//  Start it?"  Then, only on a yes:
const { data: run } = await client.simulation.run({ planId: plan.id })
```

To move to the next stage, update the saved plan (`manage-run-plans`) or create a
new one, and confirm the new `testCaseCount` again.

On the remote connector, `run_simulation` starts immediately and has no preview.
Compute the count (here, `iterationCount`), state it, wait for a yes, then call it.
For large stages prefer the local code-execution server so the API's own
`testCaseCount` is what you show the user.

## 5. What to watch

Poll `client.simulationRunPlanJob.getByID(jobId)` as in `read-results`. Then
compare stages, not absolute numbers:

- **Failures and drops.** Count `simulationJobs` by `status`: `FAILED` and
  `TIMED_OUT` are the load signal. A job with no `callId` never connected. There
  is no error string on a failed job; report the count and the
  `processingStatus` it stopped at, and do not invent a cause.
- **Responsiveness.** `agent_responsive_check` false means the agent went silent
  or never answered.
- **Latency.** `response_time` and `time_to_first_word` per call. Report the
  spread per stage (median and the slowest calls) and whether it grew as
  concurrency grew.
- **Per-call detail.** For the slowest or failed calls, read the transcript
  (`client.call.getTranscript`) to see where the agent stalled.

Roark does not define pass/fail latency targets for your agent. If the user has
their own target, compare against it; otherwise present the trend across stages
and let them decide.

## Copy-paste prompt

> Use the Roark skills simulate-load-testing and build-run-plan. Load test
> "<agent name>" on the staging endpoint <number>, using one short happy-path
> flow. Start with a smoke stage of 4 calls at concurrency 2. Attach
> agent_responsive_check, response_time and time_to_first_word. Create each stage
> as a plan, tell me testCaseCount, and wait for my confirmation before every
> stage. After each stage, report failed and timed-out calls and the latency
> spread.

## Next

- `simulate-quickstart`: authoring the flow if none exists.
- `build-run-plan`: plan fields, preview, and starting.
- `configure-metrics`: metric choice.
- `read-results`: polling and reading per-call metrics.
- `manage-run-plans`: re-running or editing the stage plans.
