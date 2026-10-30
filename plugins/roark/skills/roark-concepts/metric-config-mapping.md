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

A config metric is an LLM judge unless it sets `calculationType: HTTP_REQUEST`,
which makes it an API check, or `calculationType: THRESHOLD`, which makes it a
threshold. Each engine has its own translation.

## LLM judge

| config bundle     | imperative API          | note                                                                   |
| ----------------- | ----------------------- | ---------------------------------------------------------------------- |
| (none)            | `calculationType`       | always `LLM_JUDGE`; in config the field is optional and defaults to it |
| `displayName`     | `name`                  | falls back to the config `name` when omitted                           |
| `name`            | `slug`                  | same value                                                             |
| `type`            | `outputType`            | same value                                                             |
| `scope`           | `scope`                 | same value                                                             |
| `participantRole` | `participantRole`       | same value                                                             |
| `contexts`        | `supportedContexts`     | same value                                                             |
| `prompt`          | `llmPrompt`             | same value                                                             |
| `trueLabel`       | `booleanTrueLabel`      | same value                                                             |
| `falseLabel`      | `booleanFalseLabel`     | same value                                                             |
| `scaleMin`        | `scaleMin`              | same value                                                             |
| `scaleMax`        | `scaleMax`              | same value                                                             |
| `scaleLabels`     | `scaleLabels`           | same value                                                             |
| `options`         | `classificationOptions` | entry fields: label, description (defaults to label), displayOrder     |
| `maxSelections`   | `maxClassifications`    | same value                                                             |

## API check

| config bundle | imperative API      | note                                           |
| ------------- | ------------------- | ---------------------------------------------- |
| (none)        | `calculationType`   | always `HTTP_REQUEST`, which config also sets  |
| `displayName` | `name`              | falls back to the config `name` when omitted   |
| `name`        | `slug`              | same value                                     |
| `httpRequest` | `httpRequest`       | same shape: `url`, `method`, `headers`, `body` |
| `trueLabel`   | `booleanTrueLabel`  | same value                                     |
| `falseLabel`  | `booleanFalseLabel` | same value                                     |

## Threshold

A threshold maps onto `POST /v1/metric/definitions/{idOrSlug}/thresholds`. Its
`sourceMetric` is not in the body: it is the source metric's slug, which the
endpoint takes as `idOrSlug` in the path. `sourceVariant` names the source's
variant and is resolved to the body's `sourceVariantId`; omitted, config sends
the source's default variant. The API derives the threshold's name from the
comparison, so config has no `displayName` for it.

| config bundle           | imperative API          | note                                                      |
| ----------------------- | ----------------------- | --------------------------------------------------------- |
| `name`                  | `slug`                  | same value                                                |
| `operator`              | `operator`              | same value                                                |
| `value`                 | `value`                 | sent as a string; config also takes a number or a boolean |
| `aggregationMode`       | `aggregationMode`       | same value                                                |
| `countThreshold`        | `countThreshold`        | same value                                                |
| `sourceParticipantRole` | `sourceParticipantRole` | same value                                                |
| `trueLabel`             | `booleanTrueLabel`      | config only: the API route sets `Pass`                    |
| `falseLabel`            | `booleanFalseLabel`     | config only: the API route sets `Fail`                    |
