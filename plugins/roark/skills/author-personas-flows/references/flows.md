# IMPROV customer flow operations

What a flow is, variants, and expectations: `../../roark-concepts/flows.md`. This
file is the API shape for **IMPROV** flows. Scripted flows (a step graph with
IVR, DTMF, and exact turns) are entirely in `../../author-scripted-flows/SKILL.md`.

Over the API the field is `type` and the improvised value is `IMPROV`, where the
internal model says `mode: 'UNSCRIPTED'`.

## Anatomy, as the API addresses it

- **Happy path** - edited with `customerFlow.updateHappyPath(flowId, ...)` and
  selected in a run plan with `happyPath: true`. It has no standalone id. Requires
  `personaOverrideId` and `environmentId` on create.
- **Edge cases** - each has an id, and can carry its own `prompt`,
  `personaOverrideId`, `environmentId`, and `additionalExpectations`. A run plan
  selects them with `edgeCases: 'ALL'` or `edgeCases: [{ id }]`.
- **Agent expectations** - flow-level ones apply to every variant; an edge case
  adds its own with `additionalExpectations`. Graded by the `agent_expectations`
  metric, which the run plan must attach.
- **Variables** - `{{placeholder}}` tokens filled per attachment or at run time
  (see `../../build-run-plan/references/flow-selection.md`).

## Operations

```ts
// Create (full example in the main skill).
const { data: flow } = await client.customerFlow.create({
  type: 'IMPROV',
  title: 'Reschedule an appointment',
  agentIds: [agentId], // at least one for IMPROV
  happyPath: { title, prompt, personaOverrideId, environmentId },
  edgeCases: [{ title, prompt, personaOverrideId }], // persona and environment optional per edge case
})

// Read it back: happy path, edge cases (with ids), expectations.
const { data: full } = await client.customerFlow.getByID(flow.id)

// Flow-level fields. All optional; omitted fields are unchanged.
await client.customerFlow.update(flow.id, {
  title: 'Reschedule an appointment',
  description: '...',
  agentIds: [agentId], // replaces the linked agents; IMPROV keeps at least one
  agentExpectations: [{ prompt: 'Confirms the new time' }], // replaces the whole set
})

// Edit the happy path. Accepts title, prompt, personaOverrideId, environmentId,
// additionalExpectations, includeFlowExpectations, openingLine.
await client.customerFlow.updateHappyPath(flow.id, { prompt: '...' })

// Edge cases.
const { data: edge } = await client.customerFlowEdgeCase.add(flow.id, {
  title: 'Angry caller', // required
  prompt: 'Has been on hold twice',
  personaOverrideId, // optional
  additionalExpectations: [{ prompt: 'Apologises for the wait' }], // optional
})
await client.customerFlowEdgeCase.update(flow.id, edge.id, { /* same fields */ })
await client.customerFlowEdgeCase.remove(flow.id, edge.id)
// Promote an edge case to be the happy path (the old happy path becomes an edge case).
await client.customerFlowEdgeCase.promote(flow.id, edge.id)

// Soft-delete a flow.
await client.customerFlow.delete(flow.id) // -> { deleted: true }
```

Confirm an exact payload with SDK docs search if a call is rejected; the error
names the offending field.

## Guidance

- Start with IMPROV unless the test needs an exact path. It is far less work and
  covers most conversational testing.
- Give a flow a few high-value edge cases rather than many near-duplicates. Each
  one a run selects is a separate billable call.
- Put conversation-specific assertions in agent expectations; use metrics (see
  `configure-metrics`) for scoring that applies across flows.
