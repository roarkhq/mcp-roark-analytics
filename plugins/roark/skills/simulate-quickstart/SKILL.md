---
name: simulate-quickstart
description: >-
  Use when someone wants to create and run a Roark simulation, get started with
  Roark, test their voice agent end to end, or does not know which Roark skill to
  pick. The golden path: pick a use case, reuse or register the agent, author
  personas and improv flows from the matching industry playbook, choose a testing
  goal, attach existing metrics, build the run plan, preview the call count, and
  start only after the user confirms. Routes to the flows-* industry skills.
---

# Simulate quickstart: from "test my agent" to a running simulation

Roark is a voice and chat agent observability and simulation platform. This skill
is the default entry point for simulation work. It does not replace the detailed
skills; it runs them in the right order and tells you which one owns each step.

Simulations through this package are **voice calls**. Chat cannot be simulated
through the SDK (see `roark-overview`), so if the agent under test is chat-only,
say so and stop before step 2.

**Every simulated call is a real call that bills.** This skill never starts a run
until the user has seen the call count and said yes. That is step 7, and it is
not optional.

## Use this when

- Someone wants to create and run a simulation, or says "test my agent".
- This is the first run in a project, or you do not know which skill to load.

## Use a different skill when

- The plan already exists and you only need to re-run it: `manage-run-plans`.
- You need every plan field, override, and variable: `build-run-plan`.
- The goal is volume and concurrency: `simulate-load-testing`.
- You want to grade real production calls, not simulations: `monitor-live-calls`.

## You will have

A registered agent and endpoint, personas and IMPROV flows from the matching
playbook, a metric list with checks, a saved run plan whose `testCaseCount` the
user has confirmed, and, after that yes, a started run with its results.

## The path

| step | what | owning skill |
| --- | --- | --- |
| 1 | Pick the use case and the industry playbook | this skill |
| 2 | Reuse or register the agent and its endpoint | `register-agent` |
| 3 | Pick personas, author improv flows from the playbook | `flows-*`, `author-personas-flows` |
| 4 | Pick a testing goal (an existing template) | `build-run-plan` |
| 5 | Attach existing metrics, plus `agent_expectations` | `configure-metrics` |
| 6 | Build the run plan and read back `testCaseCount` | `build-run-plan` |
| 7 | Tell the user the count, wait for confirmation, then start | `build-run-plan` |
| 8 | Poll and read scores and transcripts | `read-results` |

## 1. Pick the use case

Ask what the agent does, in one sentence, and route to the playbook that matches.
Each playbook carries suggested personas, a flow catalog (happy path plus named
edge cases), the templates to start from, and the metrics to attach.

| The agent... | Playbook |
| --- | --- |
| handles billing, account access, troubleshooting, cancellations | [`flows-customer-support`](../flows-customer-support/SKILL.md) |
| books appointments, refills prescriptions, verifies insurance | [`flows-healthcare`](../flows-healthcare/SKILL.md) |
| answers a dealership's sales, service, parts, or finance line | [`flows-car-dealership`](../flows-car-dealership/SKILL.md) |
| books, reschedules, or triages plumbing, HVAC, electrical jobs | [`flows-home-services`](../flows-home-services/SKILL.md) |
| handles bank or card account inquiries, fraud, transfers, disputes | [`flows-finance`](../flows-finance/SKILL.md) |
| takes first notice of loss, claims status, policy and billing calls | [`flows-car-insurance`](../flows-car-insurance/SKILL.md) |
| arranges payments, handles hardship and disputes for collections | [`flows-debt-collection`](../flows-debt-collection/SKILL.md) |
| needs to hold up under many concurrent calls | [`simulate-load-testing`](../simulate-load-testing/SKILL.md) |

No match? Use the customer support playbook as the shape and write the briefs
from the user's own description of the agent. Ask for two or three real call
reasons and one call that went badly; those become the happy path and the first
edge cases.

Also ask, before writing anything:

- **Direction.** Does the agent take calls (`INBOUND`) or place them (`OUTBOUND`)?
- **Language.** Which languages do real callers speak? Language is set on the
  persona, never in the brief.
- **Required script.** Does the customer have a required greeting, disclosure,
  verification step, or policy the agent must follow? Those become agent
  expectations, worded from the customer's own script. Do not write legal or
  compliance requirements yourself.
- **Phone tree.** Does the call start with an IVR menu or keypad entry? If so,
  that part needs `author-scripted-flows`, not an improv flow.

## 2. Reuse or register the agent

Most projects already have the agent. Look before creating, because `create`
never deduplicates:

```ts
const { data: agents } = await client.agent.list({ searchText: 'Support' })
const agent = agents.find((a) => a.name === 'Acme Support')
const { data: endpoints } = await client.agentEndpoint.list({ agentId: agent.id })
```

An inbound run needs an endpoint whose `direction` accepts `INCOMING`; outbound
needs `OUTGOING`. If the agent or a phone endpoint is missing, follow
`register-agent`. Non-phone endpoints (WebSocket, LiveKit, and the rest) cannot be
created through the API; find them in the list and use their id.

## 3. Personas and flows from the playbook

Read `../roark-concepts/personas.md` and `../roark-concepts/flows.md` once. The
rule that ruins tests silently: anything about who the caller **is** (language,
accent, mood, pace, background noise) lives on the persona. Writing "is angry"
into a brief changes nothing. Briefs describe the **situation**.

**Pick personas from the system library first.** The list returns every trait,
so pick by fields rather than by name:

```ts
let after, personas = []
do {
  const page = await client.simulationPersona.list({ limit: 50, after })
  personas.push(...page.data)
  after = page.pagination.nextCursor
} while (after)

const calm = personas.find((p) => p.language === 'EN' && p.baseEmotion === 'NEUTRAL')
const frustrated = personas.find((p) => p.language === 'EN' && p.baseEmotion === 'FRUSTRATED')
```

Create a custom persona only when nothing fits (accepted values are in
`../author-personas-flows/references/personas.md`):

```ts
const { data: confused } = await client.simulationPersona.create({
  name: 'Dorothy',
  language: 'EN',
  accent: 'US',
  gender: 'FEMALE',
  age: 'ELDERLY',
  baseEmotion: 'CONFUSED',
  speechPace: 'SLOW',
  memoryReliability: 'LOW',
  backstoryPrompt: 'Retired, not comfortable with phone menus, has been a customer for years',
})
```

**Pick an environment.** The happy path needs one. Environments are read-only:

```ts
const { data: envs } = await client.simulationEnvironment.list()
const quiet = envs.find((e) => e.backgroundNoise === 'NONE')
const street = envs.find((e) => e.backgroundNoise === 'CITY')
```

**Create the flow.** This is the IMPROV shape from `author-personas-flows`.
`personaOverrideId` and `environmentId` are required on the happy path; edge
cases inherit them unless they name their own.

### Worked example: customer support, billing dispute

```ts
const { data: flow } = await client.customerFlow.create({
  type: 'IMPROV',
  title: 'Billing: unexpected charge',
  description: 'Caller disputes a charge on their latest bill',
  agentIds: [agent.id],
  happyPath: {
    title: 'Caller verifies and gets the charge explained',
    prompt:
      'You noticed a $40 charge labelled "service fee" on this month\'s bill that you do not ' +
      'recognise. Your account number is 448312 and the billing zip code is 94105. You want to ' +
      'know what the charge is and, if it was a mistake, have it removed.',
    personaOverrideId: calm.id,
    environmentId: quiet.id,
  },
  edgeCases: [
    {
      title: 'Repeat caller, second time this week',
      prompt:
        'Same $40 charge. You called two days ago, were told it would be refunded, and it is ' +
        'still on the bill. You want a reference number this time.',
      personaOverrideId: frustrated.id,
    },
    {
      title: 'Cannot pass verification',
      prompt:
        'You want the $40 charge explained but you do not have your account number, and you ' +
        'give a zip code from your old address. You insist the agent should just look you up by name.',
    },
    {
      title: 'Asks for a supervisor',
      prompt:
        'You do not accept the explanation for the $40 charge and ask to speak to a supervisor ' +
        'or a human. Keep asking until the agent either transfers you or tells you what happens next.',
      personaOverrideId: frustrated.id,
    },
    {
      title: 'Calling from a busy street',
      prompt: 'Same $40 charge question as the standard call.',
      environmentId: street.id,
    },
  ],
})

// Flow-level expectations apply to every variant. Word them from the customer's own script.
await client.customerFlow.update(flow.id, {
  agentExpectations: [
    { prompt: 'Verifies the caller with account number and billing zip before discussing the bill' },
    { prompt: 'Explains what the charge is, or says plainly that it cannot tell' },
    { prompt: 'Does not promise a refund it has not actually processed' },
  ],
})
```

Notice that the frustrated edge cases change the **persona**, and the street
edge case changes the **environment**. Their briefs only state the situation.

To give one edge case its own extra expectation, add it with
`additionalExpectations`:

```ts
await client.customerFlowEdgeCase.add(flow.id, {
  title: 'Threatens to cancel',
  prompt: 'Same $40 charge. You say you will cancel your account today unless it is removed.',
  personaOverrideId: frustrated.id,
  additionalExpectations: [{ prompt: 'Offers the documented retention path before processing a cancellation' }],
})
```

**MCP note:** with the plugin's named tools, the same flow is one
`create_customer_flow` call with `title`, `agentIds`, `happyPath` (`title`,
`prompt`, `personaOverrideId`, `environmentId`) and `edgeCases`. Ids come from
`list_personas`, `list_simulation_environments`, and `list_agents`. That tool
does not set agent expectations; add them with `customerFlow.update` on the local
code-execution server, or attach checks that do not need them (step 5).

## 4. Pick a testing goal

Match the question the user is asking to an existing template. The recipes, with
the metric slugs each one uses, are in
[`../build-run-plan/references/templates.md`](../build-run-plan/references/templates.md),
and the current catalogue is `../roark-concepts/templates-catalogue.md`.

| The user asks... | Start from |
| --- | --- |
| "does it follow the flows I wrote" | Flow adherence |
| "does it sound natural and helpful" | Conversation quality |
| "can it be pushed off policy, leak data, be jailbroken" | Red teaming |
| "does it work in Spanish (or other languages)" | Multilingual |
| "does it call the right tools" | Tool call accuracy |
| "does it answer from our knowledge base" | Knowledge base grounding (configured in-product) |
| "how good is it overall" | Live Bench (uses Roark's own versioned flows) |
| "will it hold up under volume" | Load testing, see `simulate-load-testing` |
| "is it up" | Health check |

For a first run with newly authored flows, **Flow adherence** is almost always the
right start: it grades the agent against the flows and expectations you just wrote.

## 5. Attach existing metrics

Use the recipe's slugs plus anything the playbook recommends. Confirm each slug
exists in the project before attaching:

```ts
const { data: defs } = await client.metric.listDefinitions()
const have = new Set(defs.map((d) => d.slug))
const wanted = [
  'agent_expectations_check', // grades the flow's expectations; needed whenever flows carry them
  'scenario_adherence_check',
  'instruction_follow_check',
  'task_completion_check',
  'call_outcome',
]
const metrics = wanted.filter((s) => have.has(s)).map((slug) => ({ slug }))
```

A check (`_check` slug) is what makes a run pass or fail, and attaching it pulls
in its source metric. A run with no checks attached cannot fail. Custom metrics
are `configure-metrics`.

## 6. Build the plan and preview the call count

Create the plan without running it. The response carries `testCaseCount`:

```ts
const { data: created } = await client.simulationRunPlan.create({
  name: 'Support: billing dispute',
  direction: 'INBOUND',
  maxSimulationDurationSeconds: 300,
  agentEndpoints: [{ id: endpoints[0].id }],
  metrics,
  flows: [{ id: flow.id, happyPath: true, edgeCases: 'ALL' }],
  iterationCount: 1,
})
const plan = created.runPlan // create returns { runPlan, runPlanJob }
```

The worked example is 1 happy path plus 5 edge cases, 1 endpoint, 1 iteration, so
`testCaseCount` should be 6. If it differs from your arithmetic, find out why
before going further (the formula is in
`../build-run-plan/references/flow-selection.md`).

## 7. Confirm, then start

Say the number to the user in plain words, for example: "This plan places 6
simulated calls against +1 555 555 1234. Each one is billable. Start it?" Wait
for a yes. Then:

```ts
const { data: run } = await client.simulation.run({ planId: plan.id })
// run.simulationRunPlanJobId, run.simulationJobCount
```

**MCP note:** the plugin's named tools have no create-without-running tool:
`run_simulation` starts calls immediately. Work the count out from the formula,
tell the user, wait for a yes, and only then call `run_simulation`. Its response's
`simulationJobCount` confirms what was placed. When a preview from the API itself
matters (large or unfamiliar runs), use the local code-execution server for
`simulationRunPlan.create` and run the saved plan by `planId`.

Keep first runs small: happy paths only, or one flow with `edgeCases: 'ALL'`, and
`iterationCount: 1`. Scale up once the first results make sense.

## 8. Read the results

Follow `read-results`: poll `client.simulationRunPlanJob.getByID(jobId)` to a
terminal status, then read each call's metrics with
`client.call.listMetrics(callId, { flatten: 'true', status: 'all' })` and the
transcript with `client.call.getTranscript(callId)`. Report which checks failed
and quote the turn that caused it.

## Copy-paste prompt

A user can hand their coding agent this:

> Use the Roark skills. Start with simulate-quickstart. My agent is "<agent name>",
> an inbound <industry> voice agent on <phone number>. Pick the matching flows-*
> playbook, reuse system personas where possible, create one improv flow with a
> happy path and three edge cases, attach Flow adherence metrics plus
> agent_expectations_check, create the run plan, and tell me testCaseCount.
> Do not start the run until I confirm.

## Next

- Industry playbooks: the `flows-*` skills in the table in step 1.
- Authoring detail: `author-personas-flows`; phone trees and DTMF:
  `author-scripted-flows`.
- Plan fields, flow selection, overrides: `build-run-plan`.
- Metric choice and custom judges: `configure-metrics`.
- Saving the plan as a regression suite or a CI gate: `manage-run-plans`,
  `gate-ci`.
