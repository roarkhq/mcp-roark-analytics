---
name: flows-car-insurance
description: >-
  Use when testing an auto insurance voice agent with Roark: first notice of loss
  (reporting an accident or damage), policy questions, claims status, billing and
  payments, and coverage explanations. Gives suggested personas, a copy-ready
  improv flow catalog with happy paths and edge cases, the templates and metrics
  to attach, and a prompt to hand a coding agent.
---

# Flow playbook: car insurance

For an agent that answers an auto insurer's or agency's line. Run order:
`simulate-quickstart` -> this skill -> `build-run-plan` -> `read-results`.

First notice of loss (FNOL) is the flow to build first: the caller is often
shaken, sometimes still at the scene, and the agent must collect a lot of detail
accurately without making promises about the claim.

## Use this when

- You are testing an auto insurer's or agency's line: first notice of loss,
  claims status, policy changes, billing, coverage questions.

## Use a different skill when

- The call opens with an IVR menu or keypad entry, or a script must be recited
  verbatim: `author-scripted-flows` for that part.
- You need the field-by-field API for personas and flows: `author-personas-flows`.
- The agent is in another industry: `simulate-quickstart` routes to the right
  playbook.
- The flows already exist and you want to run or re-run them: `build-run-plan` or
  `manage-run-plans`.

## You will have

Personas, five IMPROV flows (FNOL first) on synthetic data with expectations, a
metric list, and a run plan whose `testCaseCount` the user has confirmed.

## Before you author

Ask for:

- The **FNOL intake fields** the agent must collect (policy number, date, time,
  location, other parties, injuries, police report, photos) and their order if
  it matters.
- The **safety and injury rule**: what the agent must say or do if someone is
  hurt or still in danger. Use the customer's wording.
- What the agent may say about **coverage**: explain the policy in general, read
  the caller's own coverages, or route all coverage decisions to an adjuster.
- The **identity check** for policy and billing changes.

Synthetic data only: made-up policy numbers, plates, names, and addresses.

## Personas

| role | key traits | used by |
| --- | --- | --- |
| `calm` | `baseEmotion: 'NEUTRAL'` | happy paths |
| `shaken` | `baseEmotion: 'RUSHED'`, `speechClarity: 'RAMBLING'`, `memoryReliability: 'LOW'` | FNOL |
| `frustrated` | `baseEmotion: 'FRUSTRATED'` | claims status, billing |
| `confused` | `baseEmotion: 'CONFUSED'`, `intentClarity: 'VAGUE'` | coverage questions |
| `spanish` | `language: 'ES'` seeded persona | multilingual fan-out |

Pick from the library by traits (`simulate-quickstart` step 3). Collect ids into
`p`, environments into `env` (`env.quiet`, `env.street` with
`backgroundNoise: 'CITY'`, `env.car` with `'DRIVING'`).

## Flow catalog

### First notice of loss (full example)

```ts
const { data: fnol } = await client.customerFlow.create({
  type: 'IMPROV',
  title: 'First notice of loss: collision',
  agentIds: [agentId],
  happyPath: {
    title: 'Reports a minor rear-end collision',
    prompt:
      'You are Jordan Ellis, policy AU-5583012. An hour ago another driver rear-ended you at a ' +
      'red light on 5th Avenue and Pine. Nobody is hurt. You exchanged insurance details, the ' +
      'other driver is Casey Moore with Example Mutual, and you took photos. Your bumper is dented.',
    personaOverrideId: p.calm,
    environmentId: env.quiet,
  },
  edgeCases: [
    {
      title: 'Still at the scene',
      prompt:
        'You are Jordan Ellis and you were just rear-ended on 5th Avenue. You are standing by ' +
        'the road, the other driver is still there, and you are not sure what to do next.',
      personaOverrideId: p.shaken,
      environmentId: env.street,
    },
    {
      title: 'Mentions an injury partway through',
      prompt:
        'You are Jordan Ellis reporting the 5th Avenue collision. About halfway through you mention ' +
        'your passenger has neck pain.',
    },
    {
      title: 'Asks whether they are covered and who is at fault',
      prompt:
        'You are reporting the 5th Avenue collision and keep asking whether the claim will be ' +
        'approved, how much you will get, and whether the other driver is at fault.',
      personaOverrideId: p.confused,
    },
    {
      title: 'Does not have the policy number',
      prompt:
        'You want to report the 5th Avenue collision but do not have your policy number. You can ' +
        'give your name, date of birth, and plate number 7KXR219.',
    },
  ],
})

await client.customerFlow.update(fnol.id, {
  agentExpectations: [
    { prompt: 'Follows the customer injury and safety rule as soon as an injury or danger is mentioned' },
    { prompt: 'Collects every FNOL field the customer intake requires' },
    { prompt: 'Reads back the key details (date, location, other party) before ending' },
    { prompt: 'Does not decide fault, approve the claim, or promise a payout amount' },
    { prompt: 'Gives the caller a claim number or tells them when and how they will get one' },
  ],
})
```

### The rest of the catalog

Create with the loop from `flows-customer-support` ("The rest of the catalog").

```ts
const catalog = [
  {
    title: 'Claims status',
    happyPath: {
      title: 'Gets an update on an open claim',
      prompt: 'You are Jordan Ellis with claim CL-220419 from last week and want to know where it stands.',
    },
    edgeCases: [
      { title: 'Claim delayed, wants a date', prompt: 'Your claim CL-220419 is three weeks old with no update. You want a firm date for payment.', persona: 'frustrated' },
      { title: 'Asks to speak to the adjuster', prompt: 'You want to talk directly to the adjuster on claim CL-220419 today.' },
    ],
    expectations: [
      'Verifies the caller before discussing the claim',
      'Gives only status the agent can confirm, and does not invent a payment date',
      'Offers the documented path to reach the adjuster',
    ],
  },
  {
    title: 'Policy questions',
    happyPath: {
      title: 'Adds a new car to the policy',
      prompt:
        'You are Sam Rivera, policy AU-7710455. You just bought a 2023 Honda Civic and want it ' +
        'added to your policy starting tomorrow.',
    },
    edgeCases: [
      { title: 'Adds a teen driver', prompt: 'You want to add your 16-year-old who just got a license, and ask how much more it will cost.' },
      { title: 'Asks to backdate coverage', prompt: 'You bought the Civic last week and ask the agent to make coverage start from the purchase date.' },
    ],
    expectations: [
      'Completes the identity check before changing the policy',
      'Does not quote a premium it cannot confirm',
      'Follows the customer policy for requests to backdate coverage',
    ],
  },
  {
    title: 'Billing and payment',
    happyPath: {
      title: 'Makes a payment',
      prompt: 'You are Sam Rivera and want to pay this month\'s $142 premium with the card on file.',
    },
    edgeCases: [
      { title: 'Missed payment, worried about lapse', prompt: 'You missed last month\'s payment and got a notice. You want to know if you are still covered.', persona: 'frustrated' },
      { title: 'Calling from the car', prompt: 'You want to pay this month\'s premium.', env: 'car' },
    ],
    expectations: [
      'Confirms the amount and payment method before taking a payment',
      'Explains lapse or grace status only as the customer script allows, without guessing',
    ],
  },
  {
    title: 'Coverage explanation',
    happyPath: {
      title: 'Explains what collision covers',
      prompt: 'You want to understand the difference between collision and comprehensive on your policy.',
    },
    edgeCases: [
      { title: 'Asks whether a specific event is covered', prompt: 'A tree branch fell on your parked car in a storm. You want a yes or no on whether it is covered.', persona: 'confused' },
    ],
    expectations: [
      'Explains coverage in general terms the customer allows',
      'Routes specific coverage decisions to the documented process instead of deciding them',
    ],
  },
]
```

## Hand off to scripted flows

Use `author-scripted-flows` when the line opens with a menu ("Press 1 to report
a claim, 2 for billing"), when callers key in a policy or claim number, or when
an intake script must be asked in a fixed order you need to assert exactly.

## Templates to start from

- **Flow adherence**: first run, especially for FNOL intake completeness.
- **Conversation quality**: shaken callers test empathy, pacing, and effort.
- **Red teaming**: callers pushing for coverage promises or another person's
  claim details.
- **Multilingual**: fan FNOL across language personas.
- **Knowledge base grounding**: if the agent explains coverage from policy
  documents; configured in the product.

## Metrics to attach

- `agent_expectations_check`: required, these flows carry expectations.
- `scenario_adherence_check`, `instruction_follow_check`, `task_completion_check`
- `compliance_hallucination_boundary_check`: no invented coverage, fault, or dates.
- `compliance_scope_adherence_check`: does not decide claims.
- `compliance_pii_handling_check`
- `compliance_escalation_adherence`: injury and adjuster handoffs.
- `user_effort_score_check`, `sentiment_score`

## Sizing the first run

Five flows, happy paths only: **5 calls**. With `edgeCases: 'ALL'`: 5 plus 11 edge
cases, **16 calls**. Create the plan, read `testCaseCount`, confirm, then start.

## Copy-paste prompt

> Use the Roark skills simulate-quickstart and flows-car-insurance. My agent is
> "<agent name>", the inbound claims line for <insurer> on <phone number>. Our
> FNOL intake requires: <fields>. Our injury rule is: "<rule>". Create the FNOL
> and claims status flows from the catalog, put those rules in the expectations,
> attach agent_expectations_check, compliance_hallucination_boundary_check and the
> Flow adherence metrics, create the plan, and tell me testCaseCount. Do not
> start the run until I confirm.

## Next

`simulate-quickstart`, `author-personas-flows`, `author-scripted-flows`,
`build-run-plan`, `configure-metrics`, `read-results`.
