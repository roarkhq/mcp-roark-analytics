---
name: flows-car-dealership
description: >-
  Use when testing a car dealership voice agent with Roark: sales inquiries and
  inventory questions, service appointment scheduling, parts availability,
  financing questions, and test-drive follow-up. Gives suggested personas, a
  copy-ready improv flow catalog with happy paths and edge cases, when to use
  scripted flows for the dealership phone tree, the templates and metrics to
  attach, and a prompt to hand a coding agent.
---

# Flow playbook: car dealership

For an agent that answers a dealership's main line, or its sales, service, or
parts desk, or that places test-drive follow-up calls. Run order:
`simulate-quickstart` -> this skill -> `build-run-plan` -> `read-results`.

## Use this when

- You are testing a dealership's sales, service, parts, or finance line.
- You are testing outbound test-drive follow-up calls.

## Use a different skill when

- The call opens with an IVR menu or keypad entry, or a script must be recited
  verbatim: `author-scripted-flows` for that part.
- You need the field-by-field API for personas and flows: `author-personas-flows`.
- The agent is in another industry: `simulate-quickstart` routes to the right
  playbook.
- The flows already exist and you want to run or re-run them: `build-run-plan` or
  `manage-run-plans`.

## You will have

Personas, four inbound IMPROV flows plus one outbound flow with expectations, a
metric list, and separate inbound and outbound run plans whose `testCaseCount`
the user has confirmed.

## Before you author

Ask for:

- Which departments the agent covers and how it **hands off** to a person
  (sales floor, service advisor, parts counter, finance office).
- What it may **quote**: list prices, service menu prices, parts availability, or
  none of these. Dealership agents most often fail by inventing a price, a
  rate, or stock that is not there.
- The **finance rule**: whether the agent may discuss rates or payments at all,
  and what it must say instead (the customer's script, not yours).
- Whether test-drive follow-up is **outbound**. Outbound flows need an endpoint
  with `OUTGOING` and a plan with `direction: 'OUTBOUND'`; see
  `configure-outbound-dial` if Roark must trigger the dial.

## Personas

| role | key traits | used by |
| --- | --- | --- |
| `calm` | `baseEmotion: 'NEUTRAL'` | happy paths |
| `shopper` | `baseEmotion: 'SKEPTICAL'`, `intentClarity: 'INDIRECT'` | sales, finance |
| `rushed` | `baseEmotion: 'RUSHED'`, `speechPace: 'FAST'` | service, parts |
| `driving` | any, used with a `DRIVING` environment | service calls from the car |
| `spanish` | `language: 'ES'` seeded persona | multilingual fan-out |

Pick from the library by traits (`simulate-quickstart` step 3). Collect ids into
`p`, environments into `env` (`env.quiet`, `env.car` with
`backgroundNoise: 'DRIVING'`, `env.street`).

## Flow catalog

### Service: book a maintenance appointment (full example)

```ts
const { data: service } = await client.customerFlow.create({
  type: 'IMPROV',
  title: 'Service: book maintenance',
  agentIds: [agentId],
  happyPath: {
    title: 'Books an oil change and tire rotation',
    prompt:
      'You own a 2021 Toyota RAV4 with about 30,000 miles. You want an oil change and tire ' +
      'rotation this Saturday morning. Your name is Chris Novak, phone 555 0142.',
    personaOverrideId: p.calm,
    environmentId: env.quiet,
  },
  edgeCases: [
    {
      title: 'Warning light on, calling from the car',
      prompt:
        'Your 2021 RAV4 just showed a check-engine light while driving. You want to know if it is ' +
        'safe to keep driving and how soon they can see it.',
      personaOverrideId: p.rushed,
      environmentId: env.car,
    },
    {
      title: 'Asks for an exact price',
      prompt:
        'You want the RAV4 30,000-mile service and insist on an exact total price before booking.',
      personaOverrideId: p.shopper,
    },
    {
      title: 'Requested slot is full',
      prompt:
        'You only want Saturday 8am for the oil change. If it is not available, you want the ' +
        'next Saturday and a loaner car.',
    },
  ],
})

await client.customerFlow.update(service.id, {
  agentExpectations: [
    { prompt: 'Collects year, make, model, mileage, and the service needed before booking' },
    { prompt: 'Reads back the booked date, time, and services' },
    { prompt: 'Only quotes prices the customer script allows, and does not invent a total' },
    { prompt: 'Does not judge whether a car is safe to drive; offers the earliest slot or a service advisor' },
  ],
})
```

### The rest of the catalog

Create with the loop from `flows-customer-support` ("The rest of the catalog").

```ts
const catalog = [
  {
    title: 'Sales: inventory inquiry',
    happyPath: {
      title: 'Finds a matching vehicle and books a visit',
      prompt:
        'You are looking for a used SUV under $30,000 with all-wheel drive and want to see what ' +
        'they have this week. You can visit Thursday evening.',
    },
    edgeCases: [
      { title: 'Asks about a specific listing that sold', prompt: 'You saw a silver 2020 Honda CR-V on their website yesterday, stock number U2291, and want to come see it today.' },
      { title: 'Asks for the lowest price over the phone', prompt: 'You want their best out-the-door price on a new model before you will visit.', persona: 'shopper' },
      { title: 'Has a trade-in', prompt: 'You want an SUV and ask how much they will give for your 2015 Ford Focus with 110,000 miles.' },
    ],
    expectations: [
      'Does not confirm availability of a vehicle it has not checked',
      'Does not invent prices, discounts, or trade-in values',
      'Offers an appointment or a handoff to a salesperson',
    ],
  },
  {
    title: 'Parts availability',
    happyPath: {
      title: 'Checks the part and arranges pickup',
      prompt:
        'You need front brake pads for a 2019 Ford F-150. You want to know if they are in stock ' +
        'and when you can pick them up.',
    },
    edgeCases: [
      { title: 'Does not know the exact model', prompt: 'You need brake pads for "the Ford truck", maybe a 2018 or 2019, and do not have the VIN handy.' },
      { title: 'Part must be ordered', prompt: 'You need a specific side mirror for a 2019 F-150 and want it today. If it must be ordered you want a date.', persona: 'rushed' },
    ],
    expectations: [
      'Asks for enough vehicle detail (or the VIN) to identify the part',
      'States clearly whether it checked stock or is handing off to the parts counter',
    ],
  },
  {
    title: 'Financing questions',
    happyPath: {
      title: 'Explains next steps for financing',
      prompt:
        'You are interested in financing a new sedan and want to know how to apply and what ' +
        'documents to bring.',
    },
    edgeCases: [
      { title: 'Asks to be told an interest rate', prompt: 'You insist on knowing the exact rate you will get, and mention your credit is "pretty good".', persona: 'shopper' },
      { title: 'Asks about approval with bad credit', prompt: 'You ask whether you are guaranteed approval even though you had a repossession two years ago.' },
    ],
    expectations: [
      'Follows the customer finance script and does not quote a rate or approval it cannot confirm',
      'Offers the finance office or the application process as the next step',
    ],
  },
  {
    title: 'Test-drive follow-up (outbound)',
    happyPath: {
      title: 'Customer is still interested',
      prompt:
        'You test drove a blue 2024 Mazda CX-5 last Saturday. You liked it and are open to coming ' +
        'back this week to talk numbers.',
    },
    edgeCases: [
      { title: 'Bought elsewhere', prompt: 'You test drove the CX-5 but bought a car at another dealership yesterday. You want no more calls.' },
      { title: 'Bad time to talk', prompt: 'You test drove the CX-5 but you are driving and ask to be called back tomorrow.', env: 'car' },
    ],
    expectations: [
      'Identifies the dealership and the reason for the call at the start',
      'Respects a request to stop calling or call back later',
    ],
  },
]
```

The test-drive flow needs its own plan with `direction: 'OUTBOUND'`. Do not mix
it into an inbound plan.

## Hand off to scripted flows

Use `author-scripted-flows` when the dealership line starts with a phone tree
("Press 1 for sales, 2 for service, 3 for parts"), when a caller keys in a VIN or
repair order number, or when you need to test that each menu branch reaches the
right department. Each menu branch is a separate path and a separate billable call.

## Templates to start from

- **Flow adherence**: first run for the catalog above.
- **Conversation quality**: sales calls are judged on tone and effort.
- **Tool call accuracy**: if the agent calls inventory or scheduling tools. Note
  the `tool_invocation_*` metrics are documented as live-only in
  `configure-metrics`; on simulated calls check for `NOT_APPLICABLE` in results.
- **Knowledge base grounding**: if the agent answers from service menus or
  inventory feeds; configured in the product.
- **Multilingual**: if the dealership serves Spanish-speaking callers.

## Metrics to attach

- `agent_expectations_check`: required, these flows carry expectations.
- `scenario_adherence_check`, `instruction_follow_check`, `task_completion_check`
- `compliance_hallucination_boundary_check`: no invented prices, stock, or rates.
- `compliance_scope_adherence_check`: stays out of finance and safety judgments
  it is not allowed to make.
- `transfer_outcome`, `transfer_failure_check`: department handoffs.
- `user_effort_score_check`

## Sizing the first run

Inbound: four flows (service, sales, parts, finance), happy paths only: **4
calls**; with `edgeCases: 'ALL'`: **14 calls**. Outbound test-drive plan with all
variants: **3 calls**. Read `testCaseCount` for each plan and confirm before
starting either.

## Copy-paste prompt

> Use the Roark skills simulate-quickstart and flows-car-dealership. My agent is
> "<agent name>", the inbound service and sales line for <dealership> on
> <phone number>. It may quote <what it may quote> and must transfer finance
> questions to the finance office. Create the service and sales flows from the
> catalog, attach agent_expectations_check, compliance_hallucination_boundary_check
> and the Flow adherence metrics, create the plan, and tell me testCaseCount. Do
> not start the run until I confirm.

## Next

`simulate-quickstart`, `author-personas-flows`, `author-scripted-flows`,
`build-run-plan`, `configure-metrics`, `read-results`.
