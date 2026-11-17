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
    {
      type: 'CUSTOMER_FIRST_MESSAGE',
      content: 'Hi, I need to pay my bill',
      steps: [
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
    },
  ],
})

const { data: full } = await client.customerFlow.getByID(flow.id) // confirm the derived paths
```

**The next step goes inside the previous step's `steps`.** Steps side by side in
one array are alternative branches, never a sequence, and that includes the top
level of `graph`, whose entries all hang off `START`. Writing
`graph: [{ CUSTOMER_FIRST_MESSAGE }, { AGENT_TURN, steps: [...] }]` gives two
paths, and the first one is only the opening line. Nest every step you want in
the same conversation, as above, and put more than one step in a `steps` array
only where the call should fork.

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

## Caller cues: change the caller mid-call

A step's `content` can carry inline tokens that move the simulated caller at that
point of the script. In the app they are typed with `#` in the editor; over the
API they are plain text in `content`.

| token | the caller, from that step on |
| --- | --- |
| `#{emotion:<emotion>}` | feels it. One of the persona base emotions, lower case: `neutral`, `cheerful`, `confused`, `frustrated`, `skeptical`, `rushed`, `distracted`, `angry`, `anxious`, `sad` |
| `#{language:<code>}` | speaks that language: ISO 639-1 with an optional region (`es`, `pt-BR`). The agent has to understand it |
| `#{noise:<environment id>}` | moves somewhere that sounds different: the environment's id (a uuid) from `client.simulationEnvironment.list()` |
| `#{interrupt}` | cuts in on the agent. The sentence holding the token says when and what to say |

How a script runs them depends on `scriptAdherence` (set on create or with
`customerFlow.update`):

- **`STRICT`**: each step's cues fire when the call reaches that step, exactly.
  If a step holds two cues of one kind, the last wins. On an `AGENT_TURN`,
  `#{interrupt}` means cut in while the agent is speaking that step, and the
  rest of the sentence says when ("once it has read eight digits"). The tokens
  and the interrupt sentence are taken out of what is said or listened for.
- **`LOOSE`** (the default): the whole script is one prompt, so each cue becomes
  an instruction in it ("from here on you feel angry") and every `#{interrupt}`
  sentence becomes a call-wide rule for when to cut in. Lines said word for word
  (`CUSTOMER_FIRST_MESSAGE`, `CUSTOMER_VERBATIM_TURN`) lose their cues here; put
  them on a `CUSTOMER_TURN` instead.

A strict script with every kind of cue, nested correctly (each next step inside
the previous step's `steps`):

```ts
const { data: envs } = await client.simulationEnvironment.list()
const train = envs.find((e) => e.name === 'Train') // any environment whose noise fits the new place

const { data: flow } = await client.customerFlow.create({
  type: 'SCRIPTED',
  title: 'Double charge - wrong card read back',
  scriptAdherence: 'STRICT',
  graph: [
    {
      type: 'CUSTOMER_FIRST_MESSAGE',
      content: '#{emotion:angry} Hi, I was charged twice for my cleaning.',
      steps: [
        {
          type: 'AGENT_TURN',
          content: 'The agent asks for the card that was charged.',
          steps: [
            {
              type: 'CUSTOMER_TURN',
              content: '#{emotion:frustrated} Read out the card number 4111 1111 1111 1111.',
              steps: [
                {
                  type: 'AGENT_TURN',
                  content:
                    'The agent reads the card number back. #{interrupt} Cut in once it has read eight digits and say that is the card.',
                  steps: [
                    {
                      type: 'CUSTOMER_TURN',
                      content: `#{noise:${train.id}} Say you are boarding a train.`,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
})
```

Caveats:

- **Voice only.** A chat run has no voice or sound to change: a mood still
  reads as an instruction on a step the caller phrases, every other cue is
  dropped, and a line sent word for word loses all of them.
- **Emotion is audible only on ElevenLabs v3 and v4 voices.** On any other voice
  it changes what the caller says, not how it sounds. The persona's
  `baseEmotion` is where the call starts; the cue moves it.
- **Noise** names an environment by id, so renaming it is safe; a cue whose
  environment was deleted is dropped, and an environment with no background
  noise means "somewhere quiet".
- **Language**: a call can switch between at most eight languages, the one it
  starts in included.
- Fired cues show in the call transcript: "Emotion changed to angry",
  "Language switched to Spanish", "Environment changed to Train", "Interrupted
  the agent". Use them to confirm a cue fired when reading results.

## Next

- `build-run-plan` to attach the flow. Count the paths first (each is a billable
  call in `DETERMINISTIC` mode), then preview `testCaseCount`.
- `author-personas-flows` for the improvised part of a call, after the menu.
- `configure-metrics` for the checks that grade it.
