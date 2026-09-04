# Authoring custom metrics

`client.metric.createDefinition(input)` where `input.calculationType` is one of
`LLM_JUDGE`, `FORMULA`, or `PATTERN`. Confirm the exact shape with docs search if
a call is rejected; the validator's error names the offending field.

Shared optional fields: `slug` (auto-generated from `name` if omitted; immutable
after), `analysisPackageId` (defaults to the project's "Custom Metrics" package).

## LLM_JUDGE

An LLM grades each call against `llmPrompt` and returns a value of `outputType`.

```ts
await client.metric.createDefinition({
  calculationType: 'LLM_JUDGE',
  name: 'Confirmed appointment date',
  outputType: 'BOOLEAN', // BOOLEAN | NUMERIC | TEXT | SCALE | CLASSIFICATION
  llmPrompt: 'Did the agent read back and confirm the appointment date?', // <= 2000 chars
  scope: 'GLOBAL', // or PER_PARTICIPANT (+ participantRole)
  supportedContexts: ['CALL'], // default ['CALL']
})
```

Per-output-type required/allowed fields:

- **BOOLEAN** - optional `booleanTrueLabel`, `booleanFalseLabel`. No scale or
  classification fields.
- **SCALE** - required `scaleMin`, `scaleMax` (0-100, min < max); optional
  `scaleLabels: [{ rangeMin, rangeMax, label, displayOrder, description?, colorHex? }]`.
- **CLASSIFICATION** - required `classificationOptions` (at least one); optional
  `maxClassifications`.
- **NUMERIC / COUNT / TEXT / OFFSET** - just `llmPrompt`; no scale, classification,
  or boolean-label fields.
- **PER_PARTICIPANT** any type - required `participantRole` (`AGENT`, `CUSTOMER`,
  `SIMULATED_CUSTOMER`, `BACKGROUND_SPEAKER`).

`llmPrompt` is documented as required for BOOLEAN, NUMERIC, TEXT, and SCALE. It is
optional in the validator, so a metric created without one may fail later instead
of at create time: always supply it.

Omitting `calculationType` entirely defaults to `LLM_JUDGE` (legacy behaviour).
`scope` defaults to `GLOBAL` and `supportedContexts` to `['CALL']`.

## FORMULA

A number or boolean computed from **two or more** other metrics. Reference sources
by `{{id:<uuid>}}` in the expression and list each in `sources`.

```ts
await client.metric.createDefinition({
  calculationType: 'FORMULA',
  name: 'Answer efficiency',
  outputType: 'NUMERIC', // + - * /   (BOOLEAN uses == != >= <= > <)
  formula: '{{id:AAAA...}} / {{id:BBBB...}}',
  sources: [
    { sourceMetricDefinitionId: 'AAAA...' },
    { sourceMetricDefinitionId: 'BBBB...' },
  ],
})
```

Rules:

- **`sources` requires at least two entries.** A formula comparing one metric to a
  literal (`'{{id:X}} <= 2000'`) is **rejected** - that is a THRESHOLD, not a
  formula. See the custom-gates section of the parent skill.
- Every id referenced in `formula` must appear in `sources`, and every source must
  be referenced (both directions are validated, with a named 400).
- Each source may pin a variant with `sourceVariantId`.

## PATTERN

Detects a trigger condition followed by an outcome within a window. Use for
temporal claims ("after the caller asks to escalate, the agent transfers within
30 seconds").

```ts
await client.metric.createDefinition({
  calculationType: 'PATTERN',
  name: 'Escalation handled promptly',
  operation: 'PATTERN_EXISTS', // PATTERN_EXISTS (bool) | PATTERN_COUNT (num) | OUTCOME_AGGREGATE
  windowMode: 'seconds', // or 'segments'
  trigger: {
    sourceMetricDefinitionId: 'ESCALATION_REQUESTED_ID',
    operator: 'EQUALS',
    thresholdValue: 'true',
  },
  outcome: {
    sourceMetricDefinitionId: 'TRANSFER_OCCURRED_ID',
    operator: 'EQUALS',
    thresholdValue: 'true',
    windowAfter: 30, // look up to 30s after the trigger
  },
})
```

Use `triggers: [...]` + `triggerCombinator` (`AND`/`OR`) instead of `trigger` for
multiple trigger conditions. Provide one form or the other, not both.

Rules:

- `outcome.windowAfter` is **required** (>= 0); `windowBefore` is optional
  (default 0). `windowMode` is `'seconds'` or `'segments'` only.
- The trigger(s) and the outcome must each reference a **distinct** source metric;
  reusing the same one returns 400.
- There is no `outputType` on a PATTERN: the output is implied by `operation`
  (`PATTERN_EXISTS` -> boolean, `PATTERN_COUNT` -> numeric).
- Endpoint operators are `GREATER_THAN`, `GREATER_THAN_OR_EQUALS`, `LESS_THAN`,
  `LESS_THAN_OR_EQUALS`, `EQUALS`, `NOT_EQUALS`; `thresholdValue` is a string.

## Variants and versions

Each definition resolves to a `variantId` (the config in effect) and a `versionId`
(an immutable snapshot; editing produces a new one). When you derive a metric from
another, pass `sourceVariantId` to pin the exact config. If the source has more than
one visible variant and you omit it, the call fails with "specify sourceVariantId".

## Updating and deleting: not in the SDK

**There is no `client.metric.update` and no `client.metric.delete`.** The SDK has
only `createDefinition` and `listDefinitions`. The HTTP routes
(`PUT` / `DELETE /v1/metric/definitions/{idOrSlug}`) exist, so an update needs a
raw HTTP call - say so rather than calling a client method that does not exist.

For reference, over HTTP: editable fields are `name`, `llmPrompt`,
`scaleMin`/`scaleMax`/`scaleLabels`, boolean labels, `classificationOptions`,
`maxClassifications`, `toolDefinitionIds`, `supportedContexts`, `formula` +
`sources`, and `changeReason`. A new version is created only if a versionable field
actually changed. System metrics return **403**. Delete is an archive (values are
retained) and returns **409** if the metric is still a source for a derived metric.
