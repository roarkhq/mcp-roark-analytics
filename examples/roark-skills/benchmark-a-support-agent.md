# Worked example: benchmark a support agent

A run the `build-run-plan` + `configure-metrics` skills would produce for
"benchmark my support agent against its main flows." It shows the full path,
including the call-count preview.

```ts
// 1. Resolve ids. Pick the agent, its endpoints, and its flows.
const agents = await client.agent.list()
const agent = agents.data.find((a) => a.name === 'Support Bot')

const endpoints = await client.agentEndpoint.list({ agentId: agent.id })
const inbound = endpoints.data.find((e) => e.type === 'PHONE')

const { data: flows } = await client.customerFlow.list()
const billing = flows.find((f) => f.title === 'Billing question')
const reschedule = flows.find((f) => f.title === 'Reschedule appointment')

// 2. Pick metrics from the live-bench recipe, confirming the slugs exist.
const available = new Set((await client.metric.listDefinitions()).map((m) => m.slug))
const wanted = [
  'call_outcome',
  'instruction_follow',
  'scenario_adherence',
  'interruption_appropriateness',
  'overtalk_ratio',
  'response_time',
  'time_to_first_word',
  'user_effort_score',
  // paired checks that gate the run
  'instruction_follow_check',
  'scenario_adherence_check',
  'user_effort_score_check',
]
const metrics = wanted.filter((slug) => available.has(slug)).map((slug) => ({ slug }))

// 3. Create the plan WITHOUT running it, so we can preview the call count.
const plan = await client.simulationRunPlan.create({
  name: 'Support Bot benchmark',
  direction: 'INBOUND',
  maxSimulationDurationSeconds: 300,
  agentEndpoints: [{ id: inbound.id }],
  metrics,
  flows: [
    { id: billing.id, happyPath: true, edgeCases: 'ALL' },
    { id: reschedule.id, happyPath: true },
  ],
  iterationCount: 1,
})

// 4. Preview and confirm before spending.
//    -> "This run will place ${plan.testCaseCount} calls. Proceed?"
//    Only start after the user (or the caller's stated budget) approves.

// 5. Start the run.
const started = await client.simulationRunPlanJob.start(plan.id)

// 6. Poll and report.
const status = await client.simulationRunPlanJob.getByID(started.simulationRunPlanJobId)
// status.status, status.simulationJobs[].{ status, processingStatus, callId }
```

Notes:

- `edgeCases: 'ALL'` on the billing flow covers edge cases added later. If the
  billing flow has 6 edge cases, that entry alone is 7 calls (happy path + 6).
- Swapping to a one-off: replace steps 3 and 5 with a single
  `client.simulation.run({ plan: { ...same config... }, saveAsPlan: false })`,
  whose response carries `simulationJobCount`. Prefer create-then-start whenever
  the count could be large, so the user sees it first.
