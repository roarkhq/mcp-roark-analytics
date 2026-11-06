---
name: flows-home-services
description: >-
  Use when testing a home services voice agent with Roark (plumbing, HVAC,
  electrical, cleaning, pest control, appliance repair): booking a job,
  rescheduling, technician ETA, billing questions, and emergency versus routine
  triage. Gives suggested personas, a copy-ready improv flow catalog with happy
  paths and edge cases, the templates and metrics to attach, and a prompt to hand
  a coding agent.
---

# Flow playbook: home services

For an agent that books and manages jobs for a home services company. Run order:
`simulate-quickstart` -> this skill -> `build-run-plan` -> `read-results`.

The highest-risk call in this industry is triage: a caller describing something
that the company's own policy treats as an emergency (a burst pipe, a gas smell,
no heat in freezing weather) must be routed the way that policy says, not booked
into next Tuesday. Build that flow first.

## Use this when

- You are testing booking, rescheduling, ETA, or billing calls for plumbing,
  HVAC, electrical, cleaning, pest control, or appliance repair.
- You need to check emergency versus routine triage against the company's rule.

## Use a different skill when

- The call opens with an IVR menu or keypad entry, or a script must be recited
  verbatim: `author-scripted-flows` for that part.
- You need the field-by-field API for personas and flows: `author-personas-flows`.
- The agent is in another industry: `simulate-quickstart` routes to the right
  playbook.
- The flows already exist and you want to run or re-run them: `build-run-plan` or
  `manage-run-plans`.

## You will have

Personas, five IMPROV flows (triage first) with expectations, a metric list, and
a run plan whose `testCaseCount` the user has confirmed.

## Before you author

Ask for:

- The **service area** (zip codes or cities) and services offered, so edge cases
  can test out-of-area and out-of-scope requests.
- The **emergency rule**: which situations count as emergencies, and what the
  agent must do (dispatch, transfer, tell the caller to contact the utility or
  emergency services). Use the customer's wording; do not write safety advice.
- What the agent may say about **price**: a diagnostic fee, a range, or nothing.
- How **ETA** is looked up and what the agent says when it cannot get one.

## Personas

| role | key traits | used by |
| --- | --- | --- |
| `calm` | `baseEmotion: 'NEUTRAL'` | happy paths |
| `panicked` | `baseEmotion: 'RUSHED'`, `speechClarity: 'RAMBLING'`, `interruption: 'OCCASIONAL'` | emergencies |
| `frustrated` | `baseEmotion: 'FRUSTRATED'` | late technician, billing |
| `elderly` | `age: 'ELDERLY'`, `speechPace: 'SLOW'` | booking, triage |

Pick from the library by traits (`simulate-quickstart` step 3). Collect ids into
`p`, environments into `env` (`env.quiet`, `env.kids` with
`backgroundNoise: 'CHILDREN_PLAYING'`, `env.street`).

## Flow catalog

### Triage: emergency versus routine (full example)

```ts
const { data: triage } = await client.customerFlow.create({
  type: 'IMPROV',
  title: 'Triage: emergency vs routine',
  agentIds: [agentId],
  happyPath: {
    title: 'Routine leak, books a visit',
    prompt:
      'Your kitchen faucet has been dripping for a week. It is not urgent. You live at 12 Oak ' +
      'Lane, zip 30301, and want someone this week, ideally a weekday afternoon.',
    personaOverrideId: p.calm,
    environmentId: env.quiet,
  },
  edgeCases: [
    {
      title: 'Burst pipe, water spreading',
      prompt:
        'A pipe under your sink has burst and water is spreading across the kitchen floor right ' +
        'now. You do not know where the shut-off valve is.',
      personaOverrideId: p.panicked,
      environmentId: env.kids,
    },
    {
      title: 'Smells gas',
      prompt:
        'You called to book a furnace tune-up, then mention there is a strong gas smell near the ' +
        'furnace today.',
      personaOverrideId: p.elderly,
    },
    {
      title: 'Outside the service area',
      prompt: 'Your faucet drips and you want a visit. Your zip code is 99501.',
    },
  ],
})

await client.customerFlow.update(triage.id, {
  agentExpectations: [
    { prompt: 'Asks what is happening before offering a time slot' },
    { prompt: 'Follows the customer emergency rule for situations it defines as emergencies' },
    { prompt: 'Gives only the safety instructions written in the customer script, and no others' },
    { prompt: 'Tells an out-of-area caller plainly that the address is not covered' },
    { prompt: 'Reads back the address and booked window for routine jobs' },
  ],
})
```

### The rest of the catalog

Create with the loop from `flows-customer-support` ("The rest of the catalog").

```ts
const catalog = [
  {
    title: 'Book a job',
    happyPath: {
      title: 'Books an AC tune-up',
      prompt:
        'You want a routine air conditioning tune-up before summer. Address 48 Pine Street, zip ' +
        '30305. Any morning next week works. Name Taylor Brooks, phone 555 0198.',
    },
    edgeCases: [
      { title: 'Wants a price before booking', prompt: 'You want the AC tune-up but will not book until you hear the exact price.' },
      { title: 'Service not offered', prompt: 'You ask them to install a swimming pool heater.' },
      { title: 'Kids in the background', prompt: 'You want the AC tune-up booked.', env: 'kids' },
    ],
    expectations: [
      'Collects service, address, and contact details before booking',
      'Quotes only what the customer pricing policy allows',
      'Reads back the booked window',
    ],
  },
  {
    title: 'Reschedule a job',
    happyPath: {
      title: 'Moves the appointment',
      prompt:
        'You have a plumber booked for tomorrow between 8 and 12 at 12 Oak Lane. Something came ' +
        'up; you want Friday instead.',
    },
    edgeCases: [
      { title: 'Cancels same day', prompt: 'Your plumber is due in an hour and you want to cancel. You ask whether there is a fee.', persona: 'frustrated' },
      { title: 'Cannot find the booking', prompt: 'You want to reschedule but the booking might be under your partner\'s name, Morgan Brooks.', persona: 'elderly' },
    ],
    expectations: [
      'Finds the booking with the details the customer process requires before changing it',
      'States any cancellation or rescheduling policy the customer script requires',
    ],
  },
  {
    title: 'Technician ETA',
    happyPath: {
      title: 'Gets an arrival estimate',
      prompt: 'Your technician window is 1 to 5pm today at 48 Pine Street. It is 3pm and you want an update.',
    },
    edgeCases: [
      { title: 'Technician is late', prompt: 'Your window was 8 to 12 and it is now 1pm. Nobody has shown up or called.', persona: 'frustrated' },
      { title: 'Asks for the technician\'s personal number', prompt: 'You want an ETA and ask for the technician\'s personal cell number so you can call them directly.' },
    ],
    expectations: [
      'Gives the ETA if it can look it up, or says plainly that it cannot and what happens next',
      'Does not share the technician\'s personal contact details',
      'Offers the customer documented remedy for a missed window, if one exists',
    ],
  },
  {
    title: 'Billing question',
    happyPath: {
      title: 'Explains an invoice',
      prompt: 'You got an invoice for $245 for last week\'s visit and want the line items explained.',
    },
    edgeCases: [
      { title: 'Disputes a charge', prompt: 'Your invoice shows a $95 trip fee you were never told about. You want it removed.', persona: 'frustrated' },
    ],
    expectations: [
      'Explains the invoice or routes to billing according to policy',
      'Does not promise a credit or refund it is not authorised to give',
    ],
  },
]
```

## Hand off to scripted flows

Use `author-scripted-flows` when the line opens with a menu ("Press 1 to book,
2 for an emergency"), when callers key in a job or invoice number, or when the
customer's emergency script must be recited verbatim in a fixed order.

## Templates to start from

- **Flow adherence**: first run; the triage flow above carries the expectations
  that matter most.
- **Conversation quality**: panicked and frustrated callers test tone and effort.
- **Tool call accuracy**: if the agent books through a scheduling tool. The
  `tool_invocation_*` metrics are documented as live-only (`configure-metrics`);
  expect `NOT_APPLICABLE` on simulated calls.
- **Health check**: a cheap scheduled probe, useful for after-hours lines.
- **Load testing**: storm or heatwave days drive call spikes; see
  `simulate-load-testing`.

## Metrics to attach

- `agent_expectations_check`: required, these flows carry expectations.
- `scenario_adherence_check`, `instruction_follow_check`, `task_completion_check`
- `compliance_escalation_adherence`: emergency routing.
- `compliance_scope_adherence_check`: no improvised safety advice or out-of-scope
  promises.
- `compliance_hallucination_boundary_check`: no invented prices or ETAs.
- `transfer_outcome`, `transfer_failure_check`: emergency transfers.
- `user_effort_score_check`, `frustration_score`

## Sizing the first run

Five flows, happy paths only: **5 calls**. With `edgeCases: 'ALL'`: 5 plus 11 edge
cases, **16 calls**. Create the plan, read `testCaseCount`, confirm, then start.

## Copy-paste prompt

> Use the Roark skills simulate-quickstart and flows-home-services. My agent is
> "<agent name>", the inbound booking line for <company> on <phone number>,
> serving zip codes <list>. Our emergency rule is: "<rule>". Create the triage
> flow and the booking flow from the catalog, put our emergency rule in the
> expectations, attach agent_expectations_check, compliance_escalation_adherence
> and the Flow adherence metrics, create the plan, and tell me testCaseCount. Do
> not start the run until I confirm.

## Next

`simulate-quickstart`, `author-personas-flows`, `author-scripted-flows`,
`build-run-plan`, `configure-metrics`, `read-results`.
