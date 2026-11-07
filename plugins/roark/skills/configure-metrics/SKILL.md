---
name: configure-metrics
description: >-
  Use when deciding how Roark grades calls: which built-in metrics to attach to
  a simulation, which pass/fail checks make a run pass or fail, or how to write
  a custom metric (an LLM judge, a formula, or a temporal pattern) with
  client.metric.createDefinition. Works for simulations and live calls. Not for
  choosing which production calls get graded; that is monitor-live-calls.
---

# Choose how the simulation is graded

Metrics grade each finished call. A **check** (a `_check` slug) turns a score
into pass or fail. A run plan attaches both by slug; this skill picks them and,
when nothing built-in fits, creates a custom one.

## Use this when

- You are building a run plan and need the `metrics` array.
- Someone asks "what should we measure", "how do we know it passed", or "add a
  threshold".
- No built-in metric answers the question and you need a custom judge.

## Use a different skill when

- You want metrics applied to production traffic automatically, or backfilled
  over past calls: `monitor-live-calls` (it uses the metrics chosen here).
- You want to read the scores after a run: `read-results`.
- You want metrics declared in a repo: `manage-config-as-code`.

## You will have

A `metrics: [{ slug }]` array where every slug exists in the project, with at
least one `_check` so the run can actually fail. Or a new custom metric whose
slug you can attach.

**Read first:** `../roark-concepts/metrics.md`. The rule to absorb: a run that
completes is not a run that passed. Without a check attached, there is nothing
to fail, and a gate passes forever.

## 1. Start from the testing goal

Each Roark template already maps a goal to metrics and checks. The recipes are in
[../build-run-plan/references/templates.md](../build-run-plan/references/templates.md),
and the `flows-*` playbooks add industry picks. Families and every system slug are
in [references/metric-catalogue.md](references/metric-catalogue.md).

## 2. Confirm the slugs exist, then build the array

`listDefinitions` takes **no arguments** and returns every metric visible to the
project (system, organization, project) in one array. Filter client-side.

Worked example: grading a support flow that carries expectations.

```ts
const { data: defs } = await client.metric.listDefinitions()
// each: { id, slug, name, description, type, calculationType, scope, supportedContexts, ... }
const have = new Set(defs.map((d) => d.slug))

const wanted = [
  'agent_expectations_check', // required whenever flows carry expectations
  'scenario_adherence_check',
  'instruction_follow_check',
  'user_effort_score_check',
  'frustration_score', // reported only, no gate
]
const missing = wanted.filter((s) => !have.has(s))
if (missing.length) console.log('Not in this project:', missing)

const metrics = wanted.filter((s) => have.has(s)).map((slug) => ({ slug }))
// -> pass to the run plan's `metrics`
```

## 3. Checks: what makes a run pass or fail

A check is a `THRESHOLD` metric that compares a base metric against a line and
emits a boolean. Roark ships **32 curated checks**, identical in every project.

- **Attach the check alone.** Its source metric is pulled in automatically.
  Attach the base too only if you also want its raw score listed.
- **Names are curated, not mechanical.** Most are `<base>_check`, but
  `transcription_meaning_changing_check` sources `transcription_discrepancy` and
  `transfer_failure_check` sources `transfer_failure_count`. Confirm a check
  exists; do not append `_check` and hope.
- Only about a third of base metrics have a shipped check. For the rest, build a
  gate as in step 4.

## 4. When nothing built-in fits: a custom metric

In order of preference for a custom pass/fail gate:

1. **A threshold on an existing metric** via
   `POST /v1/metric/definitions/{idOrSlug}/thresholds` with `{ operator, value }`.
   **Not in the SDK client**: it needs a raw HTTP call with the same bearer
   token. Say so rather than inventing a method.
2. **`LLM_JUDGE` with `outputType: 'BOOLEAN'`**: fully supported by the SDK.
3. **`PATTERN` with `operation: 'PATTERN_EXISTS'`**: boolean, for "X happened
   after Y within a window".
4. **`FORMULA` with `outputType: 'BOOLEAN'`**: needs two or more sources, so it
   cannot express "metric X <= 2000".

The everyday case, an LLM judge:

```ts
const { data: m } = await client.metric.createDefinition({
  calculationType: 'LLM_JUDGE',
  name: 'Confirmed appointment date',
  outputType: 'BOOLEAN',
  llmPrompt: 'Did the agent read back and confirm the appointment date with the caller?',
})
// attach with { slug: m.slug } (generated from the name) or { id: m.id }
```

Output types, per-participant scoping, and the full `FORMULA` and `PATTERN`
shapes are in [references/custom-metrics.md](references/custom-metrics.md).

## Rules that will bite you

- **The SDK has two metric methods:** `createDefinition` and `listDefinitions`.
  Update, delete, get-one, and thresholds exist only as HTTP routes. There is no
  `client.metric.update`.
- **Many fields are immutable** (`slug`, `outputType`, `scope`,
  `participantRole`, `calculationType`, and more). Choose the name and output
  type deliberately.
- **System metrics cannot be modified** (403). Create your own to vary one.
- **Limits:** `llmPrompt` 2000 characters, `name` 100, `slug` 50. One metric, one
  question.
- **Match `outputType` to the question:** BOOLEAN pass/fail, SCALE graded
  (needs `scaleMin`/`scaleMax`), CLASSIFICATION labels (needs
  `classificationOptions`), NUMERIC/COUNT, TEXT.
- **Per-participant metrics need a role:** `scope: 'PER_PARTICIPANT'` requires
  `participantRole` (`AGENT`, `CUSTOMER`, `SIMULATED_CUSTOMER`,
  `BACKGROUND_SPEAKER`). The simulated caller is `SIMULATED_CUSTOMER`; a live
  caller is `CUSTOMER`.
- **Some metrics apply to one kind of conversation.** Simulation-only:
  `agent_responsive`, `agent_spoke`, `scenario_adherence`, `agent_expectations`.
  Live-only: the `tool_invocation_*` family, `redundant_question_count`, the
  transcription-accuracy family. A metric that does not apply reports
  `NOT_APPLICABLE`, not a failure. Metrics are also gated to call vs chat.
- **Pass `slug` or `metricId`, never both** (400). `metricId` is deprecated.
- **Creating a metric does not attach it.** Add it to a plan's `metrics`, or to a
  policy in `monitor-live-calls`.

**MCP note:** `list_metric_definitions` on the plugin returns the same list.
Creating a metric needs the local code-execution server.

## Next

- `build-run-plan` to put the `metrics` array on a plan.
- `read-results` to read the checks back.
- `monitor-live-calls` to run the same metrics on production calls.
