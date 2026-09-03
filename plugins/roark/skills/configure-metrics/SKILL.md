---
name: configure-metrics
description: >-
  Use to choose or create the metrics that grade a Roark simulation or live
  calls: attach built-in metrics by slug, add pass/fail checks to gate a run,
  or author a custom metric (LLM judge, formula, or temporal pattern) with
  client.metric.createDefinition. Use whenever someone asks what to measure, how
  to score their voice agent, how to add a threshold, or how to write a custom
  Roark metric.
---

# Configure Roark metrics

Metrics grade each finished call. A run plan attaches them by id or slug (see
`build-run-plan`). This skill covers choosing them and creating new ones.

## First: prefer built-in metrics

Roark ships a large library of audio-native and conversational metrics. Before
authoring anything, list what exists and match it to the goal:

```ts
const metrics = await client.metric.listDefinitions()
// each: { id, slug, name, type (output type), calculationType, scope, ... }
```

The [templates recipe](../build-run-plan/references/templates.md) maps common
goals to built-in slugs. Attach a metric by putting `{ slug }` in the plan's
`metrics` array. Metric families and output types are in
[references/metric-catalogue.md](references/metric-catalogue.md).

## Add pass/fail checks (gating a run)

A **check** is a boolean metric derived from a base metric: it turns a score into
pass/fail so a run can gate a deploy. Roark ships checks alongside many base
metrics, named with a `_check` suffix (e.g. `instruction_follow` ->
`instruction_follow_check`). To gate, attach **both** the base metric and its
check:

```ts
metrics: [
  { slug: 'instruction_follow' },
  { slug: 'instruction_follow_check' },
]
```

A check whose base metric is not also attached can never evaluate, so always
attach the pair. There is no "create a standalone threshold" method in the SDK;
for a custom gate, use a `FORMULA` metric with a boolean expression (below).

## Author a custom metric

Use `client.metric.createDefinition(...)`. Three kinds are creatable via the API,
selected by `calculationType`:

- **`LLM_JUDGE`** - an LLM grades each call against your prompt. The workhorse for
  bespoke qualitative checks ("did the agent confirm the appointment date").
- **`FORMULA`** - a numeric or boolean expression over other metrics. Use boolean
  formulas for custom gates.
- **`PATTERN`** - detects a trigger condition followed by an outcome within a time
  window (temporal reasoning over the call).

Minimal LLM judge:

```ts
const m = await client.metric.createDefinition({
  calculationType: 'LLM_JUDGE',
  name: 'Confirmed appointment date',
  outputType: 'BOOLEAN',
  llmPrompt: 'Did the agent read back and confirm the appointment date with the caller?',
})
// attach it to a run by m.slug (auto-generated from the name) or m.id
```

Output types, per-type required fields, per-participant scoping, and full
`FORMULA` / `PATTERN` shapes are in
[references/custom-metrics.md](references/custom-metrics.md).

## Rules that will bite you

- **`slug` and `outputType` are immutable.** You cannot change them on update; a
  new version is created for editable fields only. Pick the slug deliberately.
- **`llmPrompt` is capped at 2000 characters.** Keep judge prompts tight and
  single-purpose. One metric = one question.
- **Match `outputType` to the question.** BOOLEAN for pass/fail, SCALE for a
  graded score (needs `scaleMin`/`scaleMax`), CLASSIFICATION for labels, NUMERIC
  for counts/durations. Sending scale fields on a BOOLEAN metric is rejected.
- **Per-participant metrics need a role.** `scope: 'PER_PARTICIPANT'` requires
  `participantRole` (e.g. `AGENT` or `CUSTOMER`).
- **A metric only grades what it is attached to.** Creating it does not add it to
  any run; attach it in the run plan's `metrics` array.
