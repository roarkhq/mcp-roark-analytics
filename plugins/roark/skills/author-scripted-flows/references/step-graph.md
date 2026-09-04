# The scripted step graph

The conversation is a **directed acyclic graph** of steps, rooted at a synthetic
`START` node (built from the flow title; you never author it). Confirm exact
field names against the installed SDK with the MCP docs search tool, and re-read
with `getByID` after each write.

## Step fields

Every step, regardless of type, may carry these:

| field | type | meaning |
| --- | --- | --- |
| `nodeId` | uuid, optional | The step's identity. **Present = update this existing step; omit = create a new one.** A read always returns it. Preserve it on read-modify-write. |
| `ref` | string (1-64, not a uuid), optional | A caller-chosen, request-local label for a step you are creating in this same request, so another step can merge into it. Never stored, never returned. |
| `steps` | step[] , optional | Inline child steps. **More than one child = a branch point.** |
| `mergeIntoNodeIds` | string[], optional | Successors that already appear elsewhere in this same graph (a merge / convergence edge). Each entry is a `nodeId` (existing step) or a `ref` (step created this request). A step may have both `steps` and `mergeIntoNodeIds`. |

Per-type extra fields:

| type | extra field | notes |
| --- | --- | --- |
| `AGENT_TURN` | `content?: string \| null` | what the agent says |
| `CUSTOMER_TURN` | `content?: string \| null` | what the caller says |
| `CUSTOMER_FIRST_MESSAGE` | `content?: string \| null` | the caller's opening line |
| `CUSTOMER_DTMF` | `dtmfDigits?: string \| null` | required in practice; `0-9 * # w/W` |
| `CUSTOMER_SILENCE` | `silenceDurationSeconds?: number \| null` | positive integer seconds |
| `VOICEMAIL` | (none) | model reaching voicemail |
| `SCENARIO_LINK` | `linkedCustomerFlowId?`, `linkedCustomerFlowVariantId?` (uuid) | continue into another flow/variant |

Each step object is validated strictly: fields that do not belong to the step's
`type` are rejected, not silently dropped.

## Branch and merge

- **Branch**: a step whose `steps` array has more than one child. Each child
  begins a distinct path; every leaf path becomes one derived variant (one
  billable call in `DETERMINISTIC` mode).
- **Merge (convergence)**: when two paths rejoin at a shared step, emit that step
  in full exactly once (under whichever path reaches it first), and from every
  other path reference it by `mergeIntoNodeIds` instead of repeating the subtree.
  Reference by `nodeId` if the step already exists, or by `ref` if it is being
  created in this same request.
- Because merges are references rather than duplicated subtrees, reading a flow,
  editing it, and writing it back preserves it exactly.
- Do **not** place a shared merge-target step at the top level of `graph`:
  top-level steps are wired straight from `START` and would be directly reachable
  on their own.

## Rules and limits

- **Role alternation**: `AGENT_TURN` is the only agent role; every other type is
  a customer turn. Turns must strictly alternate across every edge, including
  merge edges. Violations return `ROLE_ALTERNATION`.
- **Bounds**: at most **100 steps** across at most **25 leaf paths**
  (`TOO_MANY_STEPS`, `TOO_MANY_PATHS`).
- **No cycles** (`CYCLE`); the graph must be non-empty (`EMPTY_GRAPH`).
- Other validation error codes: `DUPLICATE_STEP`, `DUPLICATE_STEP_REF`,
  `UNKNOWN_STEP`, `UNRESOLVED_MERGE_TARGET`, `MISSING_DTMF_DIGITS`. Each names the
  exact problem; fix that and re-write rather than guessing.

## replaceGraph semantics

`PUT` via `client.customerFlow.replaceGraph(flowId, { graph, allowUnmerge? })`:

- **Full replace.** A step omitted from `graph` is removed.
- Returns `{ graph, variantsReshaped, happyPath, edgeCases, warnings }`.
  `variantsReshaped: true` means the set of paths changed and variants were
  re-seeded, so any variant ids you were holding may no longer exist.
- `allowUnmerge: true` is required only to confirm a write that drops
  `mergeIntoNodeIds` references the flow already had; without it that write
  returns 409. A faithful read-modify-write never needs it.
- Scripted flows only. Calling it on an improv/voicemail flow returns 400.

## Worked example: an IVR with a branch and a merge

Caller pays by phone (press 1) or reaches an agent (press 0); both paths end at
the same confirmation step.

```ts
graph: [
  { type: 'CUSTOMER_FIRST_MESSAGE', content: 'Hello' },
  { type: 'AGENT_TURN', content: 'Press 1 to pay, 0 for an agent.',
    steps: [
      // path A: pay by keypad
      { type: 'CUSTOMER_DTMF', dtmfDigits: '1',
        steps: [
          { type: 'AGENT_TURN', content: 'Enter your account number.',
            steps: [
              { type: 'CUSTOMER_DTMF', dtmfDigits: '4483#',
                // rejoin the shared confirmation step created on path B
                mergeIntoNodeIds: ['confirm'] },
            ] },
        ] },
      // path B: transfer to a human, then the shared confirmation
      { type: 'CUSTOMER_DTMF', dtmfDigits: '0',
        steps: [
          { type: 'AGENT_TURN', ref: 'confirm',
            content: 'You are all set. Anything else?',
            steps: [ { type: 'CUSTOMER_TURN', content: 'No, thanks' } ] },
        ] },
    ] },
]
```

Here the `confirm` step is authored once (under path B) with a `ref`, and path A
merges into it via `mergeIntoNodeIds: ['confirm']` rather than duplicating it.
