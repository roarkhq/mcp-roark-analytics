---
name: "metric-config-mapping"
description: "How a config-as-code metric maps onto the imperative metric API, checked against the translation function that performs it."
---

<!-- Synced from https://github.com/roarkhq/app-roark-analytics/tree/main/src/packages/roark-concepts. Do not edit here: edits are overwritten by the next sync. -->

# Config metric to API metric

The config bundle and the imperative metric API name the same fields
differently, and sending one vocabulary to the other fails validation. The pairs
below are checked against the function that performs the translation, not read
off the two schemas side by side: that method pairs the fields which happen to
share a name and silently mis-pairs the rest, which is how a published reference
came to claim `trueLabel` was spelled identically in both. The notes are written
by hand.

| config bundle     | imperative API          | note                                                               |
| ----------------- | ----------------------- | ------------------------------------------------------------------ |
| (none)            | `calculationType`       | config has no such field: always `LLM_JUDGE`                       |
| `displayName`     | `name`                  | falls back to the config `name` when omitted                       |
| `name`            | `slug`                  | same value                                                         |
| `type`            | `outputType`            | same value                                                         |
| `scope`           | `scope`                 | same value                                                         |
| `participantRole` | `participantRole`       | same value                                                         |
| `contexts`        | `supportedContexts`     | same value                                                         |
| `prompt`          | `llmPrompt`             | same value                                                         |
| `trueLabel`       | `booleanTrueLabel`      | same value                                                         |
| `falseLabel`      | `booleanFalseLabel`     | same value                                                         |
| `scaleMin`        | `scaleMin`              | same value                                                         |
| `scaleMax`        | `scaleMax`              | same value                                                         |
| `scaleLabels`     | `scaleLabels`           | same value                                                         |
| `options`         | `classificationOptions` | entry fields: label, description (defaults to label), displayOrder |
| `maxSelections`   | `maxClassifications`    | same value                                                         |
