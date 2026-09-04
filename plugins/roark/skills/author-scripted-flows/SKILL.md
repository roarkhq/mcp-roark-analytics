---
name: author-scripted-flows
description: >-
  Use to author a SCRIPTED Roark customer flow: a conversation graph that walks
  an agent through an exact sequence, including IVR menu navigation and DTMF
  keypad entry (touch tones like "1w2w3#"), silence, voicemail, and branch/merge
  routing. Use whenever a test needs deterministic routing, an IVR/phone-tree,
  pressing digits, or a precise turn-by-turn script rather than an improvised
  conversation.
---

# Author scripted flows (IVR, DTMF, exact routing)

An **IMPROV** flow lets the simulated caller improvise from a brief (see
`author-personas-flows`, which is where you should start for open-ended
conversation). A **SCRIPTED** flow is different: it is a **conversation graph**
the call follows step by step. Reach for scripted only when the test needs it:

- **IVR / phone trees** - navigate a menu ("Press 1 for billing").
- **DTMF entry** - the caller keys in digits (account number, PIN, menu choice).
- **Deterministic routing** - assert the agent takes an exact path.
- **Silence / voicemail** - model the caller going quiet, or a voicemail beep.

Scripted graphs are more work than improv and easy to get subtly wrong, so keep
the MCP docs search tool open and re-read the flow with `getByID` after every
write to confirm the graph you intended.

## The shape in one look

```ts
const flow = await client.customerFlow.create({
  type: 'SCRIPTED',
  title: 'Billing IVR - pay by phone',
  description: 'Caller navigates the phone tree and pays a bill by keypad',
  agentIds: [agentId],           // optional for scripted; defaults to []
  branchingMode: 'DETERMINISTIC', // or 'ADAPTIVE' (see below)
  graph: [
    { type: 'CUSTOMER_FIRST_MESSAGE', content: 'Hi, I need to pay my bill' },
    { type: 'AGENT_TURN', content: 'Sure. Press 1 for billing, 2 for support.',
      steps: [
        { type: 'CUSTOMER_DTMF', dtmfDigits: '1',
          steps: [
            { type: 'AGENT_TURN', content: 'Enter your account number.',
              steps: [
                { type: 'CUSTOMER_DTMF', dtmfDigits: '4483#' },
              ] },
          ] },
      ] },
  ],
})
```

`graph` is required and must have at least one step. **Variants are derived from
the graph** (one per path through it): you do NOT send `happyPath` / `edgeCases`
for a scripted flow, and you cannot add edge cases to it with
`customerFlowEdgeCase.add` (that is improv-only). To change a scripted flow's
variants, edit the graph.

## DTMF and IVR

DTMF lives only on `CUSTOMER_DTMF` steps, in the `dtmfDigits` string:

- Valid characters: `0-9`, `*`, `#`, and `w`/`W` for a short pause.
- Example: `"1w2w3#"` presses 1, pause, 2, pause, 3, then #.
- A `CUSTOMER_DTMF` step with empty/missing `dtmfDigits` is rejected
  (`MISSING_DTMF_DIGITS`).

Model an IVR by alternating the agent's menu prompt (`AGENT_TURN`) with the
caller's key press (`CUSTOMER_DTMF`), branching on the digit where the tree
branches. To cover several menu choices, give the `AGENT_TURN` multiple child
`steps` (one `CUSTOMER_DTMF` per choice) - that is a branch point, and each path
becomes its own variant / billable call.

## Branching mode

- **`DETERMINISTIC`** ("Simulate every path") - one call per path through the
  graph; each call follows its path exactly. Use to exhaustively test an IVR.
- **`ADAPTIVE`** ("Adapt to your agent") - the paths collapse into one call per
  persona; the simulated caller picks a branch based on what the agent actually
  said. Use when you care about the agent's routing decision, not every path.

Both speak the authored lines verbatim; the mode only changes how branches are
walked, not how metrics or expectations grade. `ADAPTIVE` requires `SCRIPTED`.

## Step types

Every step is one of these (all except `START`, which Roark synthesizes from the
title). Full field-by-field detail and the graph rules are in
[references/step-graph.md](references/step-graph.md).

| type | role | carries |
| --- | --- | --- |
| `AGENT_TURN` | agent | `content?` (what the agent says) |
| `CUSTOMER_TURN` | customer | `content?` |
| `CUSTOMER_FIRST_MESSAGE` | customer | `content?` (opens the call) |
| `CUSTOMER_DTMF` | customer | `dtmfDigits` (required) |
| `CUSTOMER_SILENCE` | customer | `silenceDurationSeconds?` (positive int) |
| `VOICEMAIL` | customer | (nothing) |
| `SCENARIO_LINK` | customer | `linkedCustomerFlowId?`, `linkedCustomerFlowVariantId?` |

**Roles must strictly alternate** along
every edge: `AGENT_TURN` is the only agent role; every other type counts as a
customer turn, so an agent turn must be followed by a customer turn and vice
versa (violations return `ROLE_ALTERNATION`).

## Editing an existing graph

`replaceGraph` replaces the whole graph (a step you omit is removed):

```ts
const full = await client.customerFlow.getByID(flowId) // read current graph
// ...edit full.graph, preserving nodeId on steps you keep...
const res = await client.customerFlow.replaceGraph(flowId, { graph: edited })
// res.variantsReshaped === true means the path set changed and variant ids were re-seeded
```

Keep each step's `nodeId` when you read-modify-write so Roark updates in place
instead of recreating (and so held variant ids survive). The branch/merge rules,
the `ref` / `mergeIntoNodeIds` convergence mechanics, the `allowUnmerge` guard,
and the 100-step / 25-path limits are all in
[references/step-graph.md](references/step-graph.md).

## Next

A scripted flow is attached to a run the same way as any flow: hand off to
`build-run-plan`. Because each graph path is a separate variant and therefore a
separate billable call, watch the path count (`getByID` shows the derived
variants) before running.
