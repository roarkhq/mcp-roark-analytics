---
name: "run-plans"
description: "The simulation run plan - what it binds together, how variant selection and iteration multiply into real calls, and what a run snapshots when it starts."
---

<!-- Synced from https://github.com/roarkhq/app-roark-analytics/tree/main/src/packages/roark-concepts. Do not edit here: edits are overwritten by the next sync. -->

# Simulation run plans

The run plan is the central object: a reusable test suite binding _who_ is
called, _what_ conversations happen, and _how the result is graded_. Running one
produces a job, which expands into many real calls.

## What a plan must bind

- **At least one agent endpoint.** This is what gets called; a plan without one
  has nothing to dial.
- **Conversations**: flow selections (the modern path) or scenarios (legacy). At
  least one of the two.
- **Grading**: metrics, evaluators, or the metrics the selected flows already
  own. A plan that grades nothing runs calls and tells you nothing.

Personas are optional on a flow-based plan, because flows carry their own
personas per variant.

## Configuration that shapes the run

`direction` (inbound or outbound) decides who places the call. `iterationCount`
repeats the whole matrix. `maxConcurrentJobs` governs how many calls are in
flight at once, capped by the account quota. `executionMode` chooses between
running in parallel, serialising within the plan, or serialising across the whole
project. `maxSimulationDurationSeconds` and `silenceTimeoutSeconds` bound a
single call, and `endCallPhrases` / `endCallReasons` decide when a call is
finished.

Iterations lengthen the queue; they do not raise peak load. Concurrency governs
load, which is why a long soak test is a legitimate configuration rather than an
accident.

## Variant selection, and why it is never defaulted

Each flow attached to a plan says which of its variants should run: every
variant, only the default, every non-default variant, or a named set.

**This is deliberately not defaulted.** Each variant it resolves to is a real
phone call that costs real money, so treating a forgotten field as "all variants"
would let an omission spend, and spend more every time somebody adds a variant
later. An unstated selection is an error, not an assumption.

An attachment can override the persona a variant runs as, pin `{{variable}}`
values, and override the iteration count - each at the attachment level (applying
to every variant it resolves) or per variant. This is how one flow fans out
across languages, and how a run weights volume toward the flows that matter
instead of splitting iterations evenly.

The iteration override is the one piece of that the public API does not carry.
`iterationCountOverride` is reachable from the dashboard and the internal GraphQL
API; the customer API's flow entries expose only the persona override and
variables. Over the SDK, `iterationCount` is plan-level and multiplies every
selected variant equally, so weighting volume toward particular flows means a
second plan rather than a heavier count on one attachment.

## The multiplication

A run expands **persona x source or variant x endpoint x iteration** into
individual simulation jobs, each placing one real call through a provider.

Compute and state that product _before_ starting a run. Two variants, three
personas and five iterations is thirty calls, and nothing in the plan makes that
number visible unless someone works it out.

## Runs snapshot the plan

Starting a run freezes what it used: personas, endpoints, flows and metrics are
snapshotted at that moment. Editing any of them afterwards does not change a run
that has already started or retroactively alter results. This is what makes two
runs of the same plan comparable, and why re-running is how you pick up a change.

A run carries a human-readable number rendered like `SR-42`.

## Templates

A plan can be seeded from a run template, which pre-attaches the metrics, the
pass/fail checks and the flows that suit a testing goal. See the templates
concept.
