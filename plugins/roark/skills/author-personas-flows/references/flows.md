# Customer flow authoring

What a flow is, how to choose improv over scripted, and what variants cost:
`../../roark-concepts/flows.md`. This file is the API shape. Confirm exact
payloads with the MCP docs search tool, especially the SCRIPTED step graph, which
is intricate.

## Modes

The concept names the API spellings; `VOICEMAIL` flows are Roark-seeded and
read-only, and scripted graphs have their own skill,
**`author-scripted-flows`**.

## Anatomy, as the API addresses it

The concept describes variants; these are the handles you use on them.

- **Happy path** - addressed by `PUT /customer-flow/{flowId}/happy-path`, and
  covered in a run plan with `happyPath: true`. It has **no standalone id**.
- **Edge cases** - each has an id, and can carry its own persona override and
  variables. This is what a run plan selects with `edgeCases`.
- **Agent expectations** - flow-level ones apply to every variant; an edge case
  can add its own. Graded by the `agent_expectations` metric, which the run plan
  must actually attach.
- **Variables** - `{{placeholder}}` tokens filled per attachment or at run time.

## Operations

```ts
// Create a flow (shape depends on mode; confirm with docs search).
const flow = await client.customerFlow.create({
  title: 'Reschedule appointment',
  description: 'Caller wants to move an existing booking',
  // agents, mode, happy path / brief, expectations, ...
})

// Read it back to see happy path + edge cases + expectations.
const full = await client.customerFlow.getByID(flow.id)

// Edit flow-LEVEL fields (not the variants, not the graph). All optional;
// omitted fields are left unchanged.
await client.customerFlow.update(flow.id, {
  title: 'Reschedule an appointment',
  description: '...',
  agentIds: [agentId], // replaces the linked agents; improv needs >= 1
  agentExpectations: [{ prompt: 'confirms the new time' }], // replaces the set
  branchingMode: 'ADAPTIVE', // scripted flows only
})

// Soft-delete a flow.
await client.customerFlow.delete(flow.id) // -> { deleted: true }

// Replace a scripted flow's conversation graph wholesale.
await client.customerFlow.replaceGraph(flow.id, { /* step tree */ })

// Edit just the happy path.
await client.customerFlow.updateHappyPath(flow.id, { /* ... */ })

// Edge cases.
const edge = await client.customerFlowEdgeCase.add(flow.id, { /* variant */ })
await client.customerFlowEdgeCase.update(flow.id, edge.id, { /* ... */ })
await client.customerFlowEdgeCase.remove(flow.id, edge.id)
// Promote an edge case to be the new happy path (the old one becomes an edge case).
await client.customerFlowEdgeCase.promote(flow.id, edge.id)
```

## The scripted step graph

Scripted flows send a `graph` (a step tree with branch/merge semantics) instead
of a happy path and edge cases, and are involved enough to have their own skill:
**`author-scripted-flows`** covers the step types, DTMF/IVR, the
`nodeId`/`ref`/`steps`/`mergeIntoNodeIds` mechanics, role alternation, the
step/path limits, and `replaceGraph`. Go there for anything scripted.

## Guidance

- Start with **IMPROV** unless the test needs deterministic routing or DTMF; it
  is far less work and covers most conversational testing.
- Give the flow a small number of high-value edge cases rather than many
  near-duplicates. Remember each edge case a run selects is a separate billable
  call.
- Put assertions in **agent expectations** when they are conversation-specific;
  use metrics (see `configure-metrics`) for reusable, cross-flow scoring.
