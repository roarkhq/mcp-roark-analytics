# Metric families and output types

Discover the exact metrics a project has with `client.metric.listDefinitions()`.
This file explains how to read that list and what the fields mean.

## Output types (`type` on a listed metric, `outputType` when creating)

- **`BOOLEAN`** - true/false. Pass/fail questions and checks. Optional
  `booleanTrueLabel` / `booleanFalseLabel`.
- **`SCALE`** - an integer within `scaleMin`..`scaleMax` (0-100 range allowed),
  optionally with labelled ranges. Graded quality scores.
- **`NUMERIC`** - an unbounded number. Durations, ratios, counts computed by a
  provider or formula.
- **`COUNT`** - a tally (e.g. interruptions).
- **`CLASSIFICATION`** - one or more labels from a set (`classificationOptions`,
  `maxClassifications`). Labels can be a fixed set or discovered from calls.
- **`TEXT`** - free text (e.g. an extracted reason).
- **`OFFSET`** - a time offset within the call.

## Calculation types (`calculationType`)

- **`PROVIDER`** - system-managed, produced by an analysis engine (audio-native
  metrics: pronunciation, emotion, latency, overtalk, etc.). You attach these;
  you do not author them.
- **`LLM_JUDGE`** - an LLM grades against a prompt. Authorable.
- **`THRESHOLD`** - boolean derived from a source metric by comparison. Roark's
  `_check` metrics are these. Attachable by slug; not directly authorable via the
  SDK (use a boolean `FORMULA` for a custom gate).
- **`FORMULA`** - an expression over other metrics. Authorable.
- **`PATTERN`** - a trigger-then-outcome temporal detector. Authorable.

## Scope

- **`GLOBAL`** - one value for the whole call.
- **`PER_PARTICIPANT`** - a value per speaker; pair with `participantRole`
  (`AGENT`, `CUSTOMER`, ...).

## Built-in families worth knowing (attach by slug)

- **Outcome / adherence:** `call_outcome`, `instruction_follow`,
  `scenario_adherence`, `agent_expectations`.
- **Latency / responsiveness:** `response_time`, `time_to_first_word`,
  `latency_spike_count`, `agent_responsive`, `agent_spoke`.
- **Turn-taking / duplex:** `interruption_appropriateness`,
  `incorrect_interruption_rate`, `failed_barge_in_rate`,
  `customer_barge_in_count`, `overtalk_ratio`, `agent_cutoff_count`,
  `talk_to_listen_ratio`.
- **Conversation quality:** `sentiment_score`, `frustration_score`,
  `user_effort_score`, `comprehension_failure`, `repetition_density`,
  `loop_count`, `redundant_question_count`, `missed_response_count`.
- **Compliance / safety:** `compliance_prompt_injection_resistance`,
  `compliance_pii_handling`, `compliance_prohibited_language`,
  `compliance_scope_adherence`, `compliance_hallucination_boundary`,
  `compliance_identity_consistency`.
- **Knowledge base:** `knowledge_grounding_score`,
  `knowledge_grounding_violation`, `knowledge_missed_answer`.
- **Tool calls:** `tool_invocation_correct`,
  `tool_invocation_parameters_correct`, `tool_invocation_order_correct`.
- **Voicemail:** `voicemail_detected`, `voicemail_agent_left_message`,
  `voicemail_handling_score`.

Most base metrics have a paired `<slug>_check`. The exact set depends on the
project; always confirm against `listDefinitions()`.
