---
name: "scripted-flows"
description: "The step graph behind a scripted flow - node types, the DAG and role-alternation rules, branching modes, and how paths become variants."
---

<!-- Synced from https://github.com/roarkhq/app-roark-analytics/tree/main/src/packages/roark-concepts. Do not edit here: edits are overwritten by the next sync. -->

# Scripted flow graphs

A scripted flow replaces the improv brief with an exact conversation graph. Use
it when the precise turns are under test: IVR and DTMF menus, verbatim compliance
scripts, fixed-order exchanges.

## Steps

Each node is one turn, typed by who speaks and how:

- `AGENT_TURN` - a line the agent under test is expected to produce. In an IVR
  phase this is the menu prompt.
- `CUSTOMER_TURN` - a line the simulated caller speaks.
- `CUSTOMER_FIRST_MESSAGE` - a verbatim customer opening. Only needed when the
  caller must speak first; usually the agent opens.
- `CUSTOMER_SILENCE` - the caller says nothing, for a stated duration.
- `CUSTOMER_DTMF` - the caller presses keys, where a `w` means a pause.
- `AGENT_DTMF` - the agent under test sends keypad tones, carrying `dtmfDigits`
  exactly as the customer variant does. For flows where the agent drives a
  downstream menu rather than the caller.
- `VOICEMAIL` - the call reaches voicemail.
- `SCENARIO_LINK` - hands off into another flow, walked under its own branching
  mode rather than the caller's.

## The two structural rules

**It is a DAG.** An edge may only point at a _new_ downstream step. Convergence
means two branches meeting at a single new shared step; it never means pointing
back at an ancestor. A back-edge is the most common way to author a graph that
cannot be walked.

**Roles alternate along every path.** Customer, then agent, then customer.
`CUSTOMER_SILENCE` and `CUSTOMER_DTMF` count as customer turns, and `AGENT_DTMF`
counts as an agent turn alongside `AGENT_TURN`. The one exception is branching: a
single customer step may have several agent responses hanging off it, one per
branch.

Beyond those: complete every branch to a natural ending, converge instead of
duplicating identical steps, and use `{{variable}}` placeholders rather than real
personal data.

## Branching modes

`scriptedBranchingMode`, exposed as `branchingMode` over the public API, decides
_when_ a branch is chosen and nothing else. It
never changes grading, and both modes speak the authored lines exactly.

- `DETERMINISTIC` (the default) turns each unique path into its own variant, and
  each call follows its path exactly.
- `ADAPTIVE` collapses the paths into one call _per persona_, on which the
  simulated customer picks the branch matching what the agent actually said.

The cost difference is the point: eight paths is eight calls per persona under
`DETERMINISTIC` and one under `ADAPTIVE`. Deterministic proves every path is
reachable; adaptive tests which path the agent leads a caller down.

Unscripted flows are always deterministic, and a linked flow is walked under its
own mode rather than the linking flow's.

## Paths become variants

Scripted variants are derived, not authored: adding a branch adds variants, and
therefore adds calls to every run plan selecting all of this flow's variants.
There are no variant ids to hand-manage, and no way to add a variant except by
changing the graph.
