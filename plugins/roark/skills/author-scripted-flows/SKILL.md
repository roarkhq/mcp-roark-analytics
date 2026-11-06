---
name: author-scripted-flows
description: >-
  Use when a Roark test call must follow an exact path rather than an improvised
  conversation: IVR phone-tree menus, keypad (DTMF) entry like "1w2w3#",
  silence, voicemail, a verbatim script, or branch-and-merge routing. Creates a
  SCRIPTED customer flow from a step graph and edits it with replaceGraph. When a
  natural conversation is enough, use author-personas-flows plus a flows-*
  playbook instead.
---

# Write a scripted or IVR conversation

A **SCRIPTED** flow is a conversation graph the call follows step by step: who
speaks, what they say, which digits they press, and where the path branches.
Each path through the graph becomes its own test case.

## Use this when

- The call starts with a phone tree ("Press 1 for billing") or the caller keys
  in digits (account number, PIN, menu choice).
- You must assert an exact route or a fixed turn order, such as a disclosure
  recited at a specific point.
- You need the caller to go silent, or the call to hit a voicemail beep.

## Use a different skill when

- A natural, improvised conversation is enough (most tests): use
  `author-personas-flows`, with content from a `flows-*` playbook.
- You need personas: `author-personas-flows` creates them; scripted flows use the
  same personas.
- The flow exists and you want to run it: `build-run-plan`.

## You will have

A SCRIPTED flow id whose graph produces the paths you intended (confirmed by
reading it back), and a known path count, ready to attach in `build-run-plan`.

**Read first:** `../roark-concepts/scripted-flows.md` for the two structural rules
(the graph is acyclic; agent and customer turns alternate), what each step type
means, and why the branching mode is a cost decision. Re-read the flow with
`getByID` after every write; scripted graphs are easy to get subtly wrong.

## 1. Create the graph

Worked example: a billing IVR where the caller presses 1, then enters an account
number.

```ts
const { data: flow } = await client.customerFlow.create({
  type: 'SCRIPTED',
  title: 'Billing IVR - pay by phone',
  description: 'Caller navigates the phone tree and pays a bill by keypad',
  agentIds: [agentId], // optional for scripted; defaults to []
  branchingMode: 'DETERMINISTIC', // or 'ADAPTIVE', see step 3
  graph: [
    { type: 'CUSTOMER_FIRST_MESSAGE', content: 'Hi, I need to pay my bill' },
    {
      type: 'AGENT_TURN',
      content: 'Sure. Press 1 for billing, 2 for support.',
      steps: [
        {
          type: 'CUSTOMER_DTMF',
          dtmfDigits: '1',
          steps: [
            {
              type: 'AGENT_TURN',
              content: 'Enter your account number.',
              steps: [{ type: 'CUSTOMER_DTMF', dtmfDigits: '4483#' }],
            },
          ],
        },
      ],
    },
  ],
})

const { data: full } = await client.customerFlow.getByID(flow.id) // confirm the derived paths
```

`graph` is required and needs at least one step. **Variants come from the
graph**, one per path. Do not send `happyPath` / `edgeCases`, and do not use
`customerFlowEdgeCase.add` (IMPROV only). To change the variants, edit the graph.

## 2. Steps, DTMF, and IVR

| type | role | carries |
| --- | --- | --- |
| `AGENT_TURN` | agent | `content?` (what the agent says) |
| `AGENT_DTMF` | agent | `dtmfDigits` (the agent sends tones) |
| `CUSTOMER_TURN` | customer | `content?` |
| `CUSTOMER_FIRST_MESSAGE` | customer | `content?` (opens the call) |
| `CUSTOMER_DTMF` | customer | `dtmfDigits` (required) |
| `CUSTOMER_SILENCE` | customer | `silenceDurationSeconds?` (positive int) |
| `VOICEMAIL` | customer | (nothing) |
| `SCENARIO_LINK` | customer | `linkedCustomerFlowId?`, `linkedCustomerFlowVariantId?` |

`START` is synthesized by Roark from the title; do not send it. `AGENT_TURN` and
`AGENT_DTMF` count as agent turns; every other type counts as a customer turn.
Breaking the alternation returns `ROLE_ALTERNATION`.

**DTMF digits:** `0-9`, `*`, `#`, and `w`/`W` for a short pause. `"1w2w3#"`
presses 1, pause, 2, pause, 3, then #. A `CUSTOMER_DTMF` with no digits is
rejected (`MISSING_DTMF_DIGITS`).

**Modelling an IVR:** alternate the agent's menu prompt (`AGENT_TURN`) with the
caller's key press (`CUSTOMER_DTMF`). To cover several menu choices, give the
`AGENT_TURN` several child `steps`, one `CUSTOMER_DTMF` per choice. That is a
branch point, and each branch is its own variant and billable call.

Field-by-field detail, branch and merge (`nodeId`, `ref`, `mergeIntoNodeIds`), and
the 100-step / 25-path limits are in
[references/step-graph.md](references/step-graph.md).

## 3. Choose the branching mode

`branchingMode` is the cost decision:

- `DETERMINISTIC` ("Simulate every path" in the product): one call per path, each
  following its path exactly.
- `ADAPTIVE` ("Adapt to your agent"): one call per persona, where the simulated
  caller picks a branch from what the agent actually said. Requires `SCRIPTED`.

`../roark-concepts/scripted-flows.md` explains when each is right.

## 4. Edit an existing graph

`replaceGraph` replaces the whole graph; a step you leave out is removed.

```ts
const { data: current } = await client.customerFlow.getByID(flowId)
// edit current.graph, keeping nodeId on every step you keep
const { data: res } = await client.customerFlow.replaceGraph(flowId, { graph: edited })
// res.variantsReshaped === true: the path set changed and variant ids were re-seeded
```

Keep each step's `nodeId` in a read-modify-write so Roark updates in place and
held variant ids survive. Flow-level fields (`title`, `agentIds`,
`agentExpectations`, `branchingMode`) change with `customerFlow.update`.

**MCP note:** the plugin's `create_customer_flow` tool creates IMPROV flows only.
Scripted graphs need the local code-execution server.

## Next

- `build-run-plan` to attach the flow. Count the paths first (each is a billable
  call in `DETERMINISTIC` mode), then preview `testCaseCount`.
- `author-personas-flows` for the improvised part of a call, after the menu.
- `configure-metrics` for the checks that grade it.
