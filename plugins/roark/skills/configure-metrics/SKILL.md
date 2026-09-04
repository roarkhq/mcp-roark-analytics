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
// each: { id, slug, metricId, variantId, versionId, name, description,
//         type (output type), calculationType, scope, supportedContexts, unit? }
```

`listDefinitions` takes **no arguments**: no search, no filter, no pagination. It
returns every metric visible to the project (system + org + project) in one array,
so filter client-side.

The [templates recipe](../build-run-plan/references/templates.md) maps common
goals to built-in slugs. Attach a metric by putting `{ slug }` in the plan's
`metrics` array. Metric families and output types are in
[references/metric-catalogue.md](references/metric-catalogue.md).

## Add pass/fail checks (gating a run)

A **check** is a `THRESHOLD` metric: it compares a base metric against a line and
emits a boolean, which is what lets a run gate a deploy. Roark ships **32 curated
checks**, SYSTEM-owned and identical in every project, named with a `_check`
suffix.

**Attach the check alone. Its source metric is auto-included.**

```ts
metrics: [{ slug: 'instruction_follow_check' }]
```

Roark pulls in the source metric automatically for any derived metric, so you do
not need to attach the pair (attaching both is harmless but redundant). Attach the
base metric too only when you also want its raw score reported.

Two things to keep in mind:

- The naming is **curated, not mechanical**. Most are `<base>_check`, but not all:
  `transcription_meaning_changing_check` sources `transcription_discrepancy`, and
  `transfer_failure_check` sources `transfer_failure_count`. Confirm a check exists
  in `listDefinitions()` rather than appending `_check` to a slug and hoping.
- Only ~32 of the ~100 base metrics have a shipped check. For anything else, make
  your own gate (below).

## Custom gates

In preference order:

1. **A threshold on any existing metric** - the first-class mechanism:
   `POST /v1/metric/definitions/{idOrSlug}/thresholds` with
   `{ operator, value }` (plus optional `aggregationMode`, `countThreshold`).
   **This route is not in the SDK client**, so it needs a raw HTTP call with the
   same bearer token; tell the user that rather than pretending a method exists.
2. **`LLM_JUDGE` with `outputType: 'BOOLEAN'`** - fully supported by
   `client.metric.createDefinition` (below). This is the practical choice from the
   MCP.
3. **`PATTERN` with `operation: 'PATTERN_EXISTS'`** - boolean, for temporal
   conditions.
4. **`FORMULA` with `outputType: 'BOOLEAN'`** - only valid with **two or more**
   sources, so it cannot express "metric X <= 2000". Do not reach for it as a
   simple threshold.

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

- **Create is the only write in the SDK.** `client.metric.createDefinition` and
  `client.metric.listDefinitions` are the *only* two metric methods. Update,
  delete, get-one, and thresholds exist as HTTP routes but **not** in the client -
  do not write `client.metric.update(...)`, it does not exist.
- **Many fields are immutable**, and an update naming one returns 400: `slug`,
  `metricId`, `outputType`, `scope`, `participantRole`, `calculationType`,
  `source`, `analysisPackageId`, `organizationId`, `projectId`,
  `supportsMultipleVariants`. Pick the slug and output type deliberately.
- **System metrics cannot be modified at all** (403). To vary one, create your own.
- **`llmPrompt` is capped at 2000 characters**; `name` at 100, `slug` at 50. Keep
  judge prompts tight and single-purpose. One metric = one question.
- **Match `outputType` to the question.** BOOLEAN for pass/fail, SCALE for a
  graded score (needs `scaleMin`/`scaleMax`), CLASSIFICATION for labels (needs
  `classificationOptions`), NUMERIC/COUNT for counts, TEXT for free text. Sending
  scale fields on a BOOLEAN metric is rejected.
- **Per-participant metrics need a role.** `scope: 'PER_PARTICIPANT'` requires
  `participantRole`, one of `AGENT`, `CUSTOMER`, `SIMULATED_CUSTOMER`,
  `BACKGROUND_SPEAKER`. In a simulation the caller leg is `SIMULATED_CUSTOMER`,
  in a live call it is `CUSTOMER` - a customer-scoped gate should account for both.
- **Some metrics only apply to one kind of conversation.** Simulation-only metrics
  (`agent_responsive`, `agent_spoke`, `scenario_adherence`, `agent_expectations`)
  return nothing on live calls; live-only ones (the `tool_invocation_*` family,
  `redundant_question_count`, the transcription-accuracy family) return nothing on
  simulations. A metric that does not apply reports `NOT_APPLICABLE`, not a
  failure. Metrics are also gated to `call` vs `chat`.
- **Pass `slug` or `metricId`, never both** (400). `metricId` is a deprecated alias.
- **A metric only grades what it is attached to.** Creating it does not add it to
  any run; attach it in the run plan's `metrics` array.
