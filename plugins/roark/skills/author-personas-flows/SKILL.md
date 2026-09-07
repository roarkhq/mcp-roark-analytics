---
name: author-personas-flows
description: >-
  Use to define who calls the agent (personas) and what they do (customer
  flows) in Roark: pick from the system persona library or create a custom
  persona (voice, language, speech and behavioral profile), and author a flow
  with a happy path and edge cases. Use when a run plan needs a persona or flow
  that does not exist yet, or someone asks to design test conversations.
---

# Author personas and customer flows

A simulated call is a **persona** (the caller) running a **customer flow** (what
the conversation is about). `build-run-plan` attaches these; this skill creates
them when they do not exist.

## Personas

Roark ships a large system persona library. Prefer reusing one:

```ts
const { data: personas } = await client.simulationPersona.list({ searchText: 'spanish' })
```

Create a custom persona only when the library does not cover the voice or
behavior you need. A minimal create needs identity, language, accent, and gender;
everything else has a sensible default:

```ts
const persona = await client.simulationPersona.create({
  name: 'Maria',
  language: 'ES', // ISO 639-1; primary language
  accent: 'MX', // ISO 3166-1 accent code
  gender: 'FEMALE', // MALE | FEMALE
  backstoryPrompt: 'A busy parent calling to reschedule an appointment', // optional but valuable
})
```

The full field set (speech profile, behavioral profile, background noise,
code-switching, idle handling) is in
[references/personas.md](references/personas.md). Update with
`client.simulationPersona.update(id, {...})`.

## Customer flows

A **customer flow** is one type of conversation. It has:

- a **mode**: `IMPROV` (the simulated caller improvises from a brief),
  `SCRIPTED` (a step graph the conversation follows), or `VOICEMAIL`.
- a **happy path**: the way the conversation is meant to go.
- **edge cases**: every other way of running it (an angry caller, a wrong number,
  a mid-call correction). Each edge case can carry its own persona and variables.
- **agent expectations**: short pass/fail statements the agent is graded against
  (e.g. "greets the caller by name once"), evaluated by the `agent_expectations`
  metric.

Reuse existing flows first:

```ts
const { data: flows } = await client.customerFlow.list()
const flow = await client.customerFlow.getByID(flowId) // see its happy path + edge cases
```

Authoring depends on mode. IMPROV flows are a brief plus edge cases and are quick
to write; SCRIPTED flows are a conversation graph and are more involved. The
concepts, the operations (`create`, `updateHappyPath`, `replaceGraph`, and the
`customerFlowEdgeCase` add/update/remove/promote calls), and when to reach for
each are in [references/flows.md](references/flows.md).

> The SCRIPTED step-graph payload is detailed (a recursive node tree with
> branch/merge semantics). Author the shape with the MCP docs search tool open,
> confirming node fields against the installed SDK rather than guessing.

## Next

Once the persona and flow exist, hand off to `build-run-plan` to attach them,
choose how much of the flow to run, and add metrics.
