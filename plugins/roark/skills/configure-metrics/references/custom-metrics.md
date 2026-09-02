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
- **NUMERIC / TEXT** - just `llmPrompt`.
- **PER_PARTICIPANT** any type - required `participantRole`.

`llmPrompt` is required for BOOLEAN, NUMERIC, TEXT, and SCALE.

## FORMULA (including custom pass/fail gates)

A number or boolean computed from at least two other metrics. Reference sources
by `{{id:<uuid>}}` in the expression and list each in `sources`.

```ts
// Numeric: ratio of two metrics
await client.metric.createDefinition({
  calculationType: 'FORMULA',
  name: 'Answer efficiency',
  outputType: 'NUMERIC', // + - * /
  formula: '{{id:AAAA...}} / {{id:BBBB...}}',
  sources: [
    { sourceMetricDefinitionId: 'AAAA...' },
    { sourceMetricDefinitionId: 'BBBB...' },
  ],
})

// Boolean: a custom gate (this is how you make a threshold the SDK cannot create directly)
await client.metric.createDefinition({
  calculationType: 'FORMULA',
  name: 'Fast enough',
  outputType: 'BOOLEAN', // == != >= <= > <
  formula: '{{id:RESPONSE_TIME_ID}} <= 2000',
  sources: [{ sourceMetricDefinitionId: 'RESPONSE_TIME_ID' }],
})
```

Every id referenced in `formula` must appear in `sources`, and every source must
be referenced. `outputType` is `NUMERIC` (arithmetic) or `BOOLEAN` (comparison).

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

## Updating

`client.metric.update(idOrSlug, {...})` creates a new immutable version for
editable fields (`name`, `llmPrompt`, scale/classification labels, `formula` +
`sources`, `supportedContexts`, `toolDefinitionIds`). Immutable fields (`slug`,
`outputType`, `scope`, `participantRole`, `calcType`, `analysisPackageId`) are
rejected with a 400. Pass an optional `changeReason` to annotate the version.
