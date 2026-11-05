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
- `CUSTOMER_TURN` - a line the simulated caller speaks, phrased by the persona.
- `CUSTOMER_VERBATIM_TURN` - a line the simulated caller says word for word. As
  an opening step (directly under the start) it is said the moment the call
  connects, before the agent speaks; only needed when the caller must open, and
  usually the agent does. `CUSTOMER_FIRST_MESSAGE` is the retired name for that
  opening case and is still accepted.
- `CUSTOMER_SILENCE` - the caller says nothing, for a stated duration.
- `CUSTOMER_AUDIO` - audio from Roark's library plays on the line for a stated
  duration, the way an IVR plays hold music or ringback. Nobody is speaking, and
  it runs in a `STRICT` voice flow only: anywhere else it is a pause of that length.
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
`CUSTOMER_SILENCE`, `CUSTOMER_AUDIO` and `CUSTOMER_DTMF` count as customer turns, and `AGENT_DTMF`
counts as an agent turn alongside `AGENT_TURN`. The one exception is branching: a
single customer step may have several agent responses hanging off it, one per
branch.

Beyond those: complete every branch to a natural ending, converge instead of
duplicating identical steps, and use `{{variable}}` placeholders rather than real
personal data.

## Script adherence

`scriptAdherence`, exposed as `scriptAdherence` over the public API and as
`adherence` in config files, decides how closely a run follows the script.
`LOOSE` (the default) hands the whole script to the simulated customer as one
prompt; it keeps the call moving whatever the agent says. `STRICT` runs the
script as a state machine on the agent service: at every agent step the
simulated customer waits, silent, until the agent has said the expected line,
and only then moves on. It cannot provide the next step's answer early because
it has not been told that step exists yet. Strict flows run on voice calls only
(a run that pairs one with a chat agent is refused), always on the standard
simulation provider, and never on realtime models.

`offScriptPolicy` (STRICT only) says what the simulated customer does when the
agent does not say the expected line. Each unmatched utterance is an attempt:
`reaction` runs per attempt (`STAY_SILENT`, `REPEAT` its last scripted line,
`RESPOND` once in character without moving on, or `SAY` a fixed `sayLine`), and
`then` runs when attempts reach `maxAttempts` or the agent stays silent for
`waitSeconds` (`HANG_UP` ends the call with ended reason `SCRIPT_DIVERGED`,
`HANG_UP_INVALIDATE` ends it the same way and invalidates the run: the call keeps
its transcript and recording but is scored by nothing and excluded from the run's
totals, hidden in the run list behind "Show invalidated runs", `MOVE_ON` advances
anyway, `ADAPT` hands the rest of the call to loose behaviour). Unset means stay
silent, 3 attempts, hang up. The flow's policy is the default for every agent
step; an `AGENT_TURN` step can carry its own `offScriptPolicy`, which replaces it
at that step. Invalidate when a missed step makes the rest of the call
meaningless, an authentication menu for instance: put `HANG_UP_INVALIDATE` on that
step and keep a gentler policy on the flow.

An `AGENT_DTMF` step does not follow the flow's policy. If the agent presses
nothing and says no option until just before the run's silence timeout, the call
hangs up in silence with ended reason `SCRIPT_DIVERGED`, without playing the next
step or moving into a following improv flow. The step's own `offScriptPolicy`
changes that: `waitSeconds` is how long to wait, at least 5 and at most that same
limit, and `then` is `MOVE_ON`, `HANG_UP` or `HANG_UP_INVALIDATE`. `reaction` is
`STAY_SILENT` or `REPEAT`: with `REPEAT` the caller says the line before the step
again each time the wait runs out, up to `maxAttempts` waits (at most 5), and `then`
follows the last one. Speech does not end the wait. In a menu with several keypad options, the first one with a
policy decides. To test a dedicated no-answer path, add a `CUSTOMER_SILENCE`
option: the call waits its duration and then follows that path.

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
