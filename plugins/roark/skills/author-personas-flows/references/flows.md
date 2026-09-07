# Customer flow authoring

A flow is one type of conversation. Confirm exact payloads with the MCP docs
search tool, especially the SCRIPTED step graph, which is intricate.

## Modes

- **IMPROV** - the simulated caller improvises from a free-text brief. Best for
  realistic, open-ended conversations. Quick to author: a brief per variant.
- **SCRIPTED** - a step graph the conversation follows. Best for IVR menus, DTMF
  entry, and precise routing. Two branching modes:
  - `DETERMINISTIC` ("Simulate every path"): one call per path through the graph,
    each following its path exactly.
  - `ADAPTIVE` ("Adapt to your agent"): the paths collapse into one call per
    persona; the caller picks a branch based on what the agent actually said.
- **VOICEMAIL** - Roark-seeded greeting flows for voicemail testing; read-only.

Both scripted modes speak the exact authored lines; the mode only changes how
branches are walked, not how metrics or expectations grade.

## Anatomy

- **Happy path** - the way the flow is meant to go. Addressed by
  `PUT /customer-flow/{flowId}/happy-path`, and covered in a run plan with
  `happyPath: true`. It has no standalone id.
- **Edge cases** - every other way of running the flow. Each has an id, and can
  carry its own persona override and variables. This is what a run plan selects
  with `edgeCases`.
- **Agent expectations** - short LLM-graded pass/fail statements
  ("confirms the appointment time"). Flow-level ones apply to every variant; an
  edge case can add its own. Graded by the `agent_expectations` metric.
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

## The scripted step graph (high level)

A scripted graph is a tree of steps. Each step has a `nodeId` (its identity:
include it to update an existing step, omit it to create one), continues into
child `steps` (more than one child is a branch point), and can rejoin other steps
via `mergeIntoNodeIds` (or `ref` for a step created in the same request).
Branches that come back together are modeled by merge targets, not by repeating
the shared step, so reading a flow, editing it, and writing it back preserves it
exactly.

There are limits on total steps and leaf paths. Because the payload is easy to
get subtly wrong, build it iteratively with docs search open and re-read the flow
with `getByID` to confirm the graph you intended.

## Guidance

- Start with **IMPROV** unless the test needs deterministic routing or DTMF; it
  is far less work and covers most conversational testing.
- Give the flow a small number of high-value edge cases rather than many
  near-duplicates. Remember each edge case a run selects is a separate billable
  call.
- Put assertions in **agent expectations** when they are conversation-specific;
  use metrics (see `configure-metrics`) for reusable, cross-flow scoring.
