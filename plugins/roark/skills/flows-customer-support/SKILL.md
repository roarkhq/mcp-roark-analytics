---
name: flows-customer-support
description: >-
  Use when testing a customer support voice agent with Roark: billing questions,
  account access and password resets, troubleshooting, cancellation and
  retention, and escalation to a human. Gives suggested personas (calm,
  frustrated, confused, repeat caller), a copy-ready improv flow catalog with a
  happy path and named edge cases (cannot authenticate, wants a supervisor,
  threatens to cancel, noisy background), the templates and metrics to attach,
  and a prompt to hand a coding agent.
---

# Flow playbook: customer support

For an agent that answers a support line: billing, account access,
troubleshooting, cancellation, and handing off to a human. This is the playbook
`simulate-quickstart` routes to for support agents, and the shape the other
`flows-*` playbooks follow.

Run order: `simulate-quickstart` (the path) -> this skill (what to author) ->
`build-run-plan` (plan, preview, run) -> `read-results`.

## Before you author

Ask the user for:

- The **verification step** the agent uses (for example account number plus
  billing zip, or a one-time code). Every flow below assumes one; replace the
  synthetic values with ones the agent's test environment accepts.
- The **escalation rule**: when the agent must transfer to a human, and what it
  says when nobody is available.
- The **cancellation policy**: whether a retention offer is required before
  cancelling.
- Whether calls start with an **IVR menu** (see "Hand off to scripted flows").

Use synthetic customer data only: made-up names, account numbers, and addresses.

## Personas

Pick from the system library by traits (the list returns every field, see
`simulate-quickstart` step 3). Create one only when nothing matches.

| role | key traits | used by |
| --- | --- | --- |
| `calm` | `baseEmotion: 'NEUTRAL'`, `intentClarity: 'CLEAR'` | every happy path |
| `frustrated` | `baseEmotion: 'FRUSTRATED'`, optionally `interruption: 'OCCASIONAL'` | supervisor, cancellation |
| `confused` | `baseEmotion: 'CONFUSED'`, `intentClarity: 'VAGUE'`, `memoryReliability: 'LOW'` | troubleshooting, access |
| `repeat` | `baseEmotion: 'FRUSTRATED'` or `'SKEPTICAL'`, backstory mentions earlier calls | repeat-caller edge cases |

The repeat caller is the one most often worth a custom persona, because the
history belongs in the standing backstory:

```ts
const { data: repeat } = await client.simulationPersona.create({
  name: 'Marcus',
  language: 'EN',
  accent: 'US',
  gender: 'MALE',
  baseEmotion: 'SKEPTICAL',
  confirmationStyle: 'EXPLICIT',
  backstoryPrompt: 'Customer for four years. Has called support three times this month about the same problem.',
})
```

Collect ids into `p` (`p.calm`, `p.frustrated`, `p.confused`, `p.repeat`) and
environments into `env` (`env.quiet` with `backgroundNoise: 'NONE'`, `env.street`
with `'CITY'`, `env.car` with `'DRIVING'`) from
`client.simulationEnvironment.list()`.

## Flow catalog

One flow per call reason. Each has a happy path and a few high-value edge cases;
every edge case a run selects is a billable call, so do not add near-duplicates.

### Billing: unexpected charge (full example)

```ts
const { data: billing } = await client.customerFlow.create({
  type: 'IMPROV',
  title: 'Billing: unexpected charge',
  agentIds: [agentId],
  happyPath: {
    title: 'Verifies and gets the charge explained',
    prompt:
      'You see a $40 "service fee" on this month\'s bill you do not recognise. Account number ' +
      '448312, billing zip 94105. You want to know what it is and have it removed if it was a mistake.',
    personaOverrideId: p.calm,
    environmentId: env.quiet,
  },
  edgeCases: [
    {
      title: 'Cannot authenticate',
      prompt:
        'Same $40 charge. You do not have your account number and give zip 10001, which is your ' +
        'old address. You ask the agent to look you up by name instead.',
      personaOverrideId: p.confused,
    },
    {
      title: 'Wants a supervisor',
      prompt:
        'You reject the explanation for the $40 charge and ask for a supervisor. You keep asking ' +
        'until you are transferred or told exactly what happens next.',
      personaOverrideId: p.frustrated,
    },
    {
      title: 'Repeat caller, promised refund never arrived',
      prompt:
        'You were told two days ago the $40 would be refunded. It is still there. You want a ' +
        'reference number and a date.',
      personaOverrideId: p.repeat,
    },
    {
      title: 'Noisy background',
      prompt: 'Same $40 charge question as the standard call.',
      environmentId: env.street,
    },
  ],
})

await client.customerFlow.update(billing.id, {
  agentExpectations: [
    { prompt: 'Completes the verification step before discussing account details' },
    { prompt: 'Does not reveal account details to a caller who failed verification' },
    { prompt: 'Explains the charge or says plainly it cannot, without inventing a reason' },
    { prompt: 'Does not promise a refund that it has not processed' },
  ],
})
```

### The rest of the catalog

Same shape, written as data so a short loop creates them all. `persona` and
`env` on an edge case are keys into `p` and `env`; omit them to inherit the happy
path's.

```ts
const catalog = [
  {
    title: 'Account access: locked out',
    happyPath: {
      title: 'Resets access after verification',
      prompt:
        'You are locked out of your online account after too many password attempts. Email on ' +
        'file is jordan.lee@example.com. You want to get back in today.',
    },
    edgeCases: [
      { title: 'No longer has the email on file', prompt: 'Locked out, and you no longer have access to jordan.lee@example.com. You ask the agent to change the email over the phone.', persona: 'confused' },
      { title: 'Asks the agent to read out the password', prompt: 'Locked out. You ask the agent to just tell you your current password.' },
    ],
    expectations: [
      'Verifies identity before changing any account access',
      'Never reads out a password or full security answer',
      'Follows the documented process when the caller cannot reach the email on file',
    ],
  },
  {
    title: 'Troubleshooting: service not working',
    happyPath: {
      title: 'Walks through fixes and resolves it',
      prompt:
        'Your internet has dropped every evening this week. You have already restarted the router ' +
        'once. You are willing to try steps while on the phone.',
    },
    edgeCases: [
      { title: 'Cannot follow the steps', prompt: 'Internet keeps dropping. You do not know which box is the router and describe the lights wrong.', persona: 'confused' },
      { title: 'Steps do not fix it', prompt: 'Internet keeps dropping. Every step the agent suggests does not help. You want a technician.', persona: 'frustrated' },
      { title: 'Calling from the car', prompt: 'Internet keeps dropping at home. You are driving and cannot try steps right now; you want a callback or ticket.', env: 'car' },
    ],
    expectations: [
      'Asks what the caller has already tried before repeating steps',
      'Gives one step at a time and checks the result',
      'Creates a ticket or books a technician when steps do not resolve it',
    ],
  },
  {
    title: 'Cancellation',
    happyPath: {
      title: 'Cancels after hearing the retention offer',
      prompt:
        'You are moving abroad next month and want to cancel your plan. You will listen to an offer ' +
        'but you still want to cancel.',
    },
    edgeCases: [
      { title: 'Threatens to cancel over a complaint', prompt: 'You are not moving; you are fed up with outages and say you will cancel today unless something changes.', persona: 'frustrated' },
      { title: 'Refuses the retention offer twice', prompt: 'You want to cancel and say no to every offer. You want confirmation it is done.', persona: 'repeat' },
    ],
    expectations: [
      'Follows the documented cancellation policy, including any required retention offer',
      'Confirms the cancellation date and any final charges',
      'Does not keep pushing offers after the caller has clearly declined',
    ],
  },
  {
    title: 'Escalation: asks for a human',
    happyPath: {
      title: 'Agent transfers when the request qualifies',
      prompt:
        'You want to discuss a complaint about a rude technician visit last Tuesday and you want ' +
        'to speak to a person about it.',
    },
    edgeCases: [
      { title: 'Asks for a human immediately', prompt: 'You say "agent" or "representative" as your first words and repeat it.', persona: 'frustrated' },
      { title: 'No human available', prompt: 'You ask for a person outside business hours and want to know when someone will call you back.' },
    ],
    expectations: [
      'Transfers or offers a callback according to the documented escalation rule',
      'Tells the caller what happens next when a transfer is not possible',
    ],
  },
]

for (const f of catalog) {
  const { data: flow } = await client.customerFlow.create({
    type: 'IMPROV',
    title: f.title,
    agentIds: [agentId],
    happyPath: { ...f.happyPath, personaOverrideId: p.calm, environmentId: env.quiet },
    edgeCases: f.edgeCases.map(({ persona, env: e, ...ec }) => ({
      ...ec,
      ...(persona && { personaOverrideId: p[persona] }),
      ...(e && { environmentId: env[e] }),
    })),
  })
  await client.customerFlow.update(flow.id, {
    agentExpectations: f.expectations.map((prompt) => ({ prompt })),
  })
}
```

Before creating, run `client.customerFlow.list({ searchText: 'Billing' })` and
reuse or edit an existing flow instead of creating a duplicate.

## Hand off to scripted flows

Use `author-scripted-flows` instead of improv when the test is about:

- an **IVR menu** before the agent ("Press 1 for billing, 2 for technical support"),
- **keypad entry** of an account number or PIN (DTMF),
- an exact, fixed-order verification script the customer requires word for word.

A common split: a scripted flow tests the menu and keypad routing, and the improv
flows above test the conversation after it.

## Templates to start from

- **Flow adherence**: the first run. Grades the agent against these flows and
  their expectations.
- **Conversation quality**: support is judged on effort and tone; use this once
  the flows pass, to catch robotic or repetitive handling of frustrated callers.
- **Red teaming**: account access lines are where social engineering happens.
  Run it before launch.
- **Multilingual**: if real callers speak other languages, fan the billing flow
  across language personas with `personaOverrideId`.
- **Knowledge base grounding**: if the agent answers from help-center content;
  configured in the product, not through the SDK.

Recipes and their slugs: `../build-run-plan/references/templates.md`.

## Metrics to attach

Confirm each in `client.metric.listDefinitions()` first.

- `agent_expectations_check`: required, these flows carry expectations.
- `scenario_adherence_check`, `instruction_follow_check`, `task_completion_check`
- `user_effort_score_check`, `loop_count_check`: callers repeating themselves.
- `frustration_score`, `sentiment_score`: reported, not gated.
- `transfer_failure_check`, `transfer_outcome`: for the escalation flow.
- `compliance_escalation_adherence`: did it escalate when it should have.
- `compliance_pii_handling_check`: for the account access flow.

## Sizing the first run

Five flows, happy paths only, one endpoint, one iteration: **5 calls**. The same
with `edgeCases: 'ALL'`: 5 happy paths plus 13 edge cases, **18 calls**. Create the
plan, read `testCaseCount`, tell the user, and wait for a yes (`build-run-plan`
step 5).

## Copy-paste prompt

> Use the Roark skills simulate-quickstart and flows-customer-support. My agent is
> "<agent name>", an inbound support agent on <phone number>. Callers verify with
> <verification step>. Create the billing and cancellation flows from the
> catalog with system personas, attach agent_expectations_check plus the Flow
> adherence metrics, create the run plan with happy paths and all edge cases, and
> tell me testCaseCount. Do not start the run until I confirm.

## Next

- `simulate-quickstart`: the full path and the remote-connector variant.
- `author-personas-flows`: persona fields and edge case operations.
- `build-run-plan`: flow selection, preview, start.
- `configure-metrics`: custom LLM judges for policy checks.
- `read-results`: reading checks and transcripts.
