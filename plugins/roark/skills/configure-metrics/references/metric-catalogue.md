# Metric catalogue and shapes

Always confirm against `client.metric.listDefinitions()` (no arguments, returns
everything visible to the project). The slugs below are Roark's shipped system
slugs and are stable, but a given project may not collect all of them.

## Output types (`type` on a response, `outputType` on create)

`BOOLEAN`, `SCALE`, `NUMERIC`, `COUNT`, `TEXT`, `CLASSIFICATION`, `OFFSET`.

- `BOOLEAN` - pass/fail. Optional `booleanTrueLabel` / `booleanFalseLabel`.
- `SCALE` - a numeric score within configured bounds. `scaleMin`/`scaleMax` are
  required (integers 0-100 as bounds), and optional `scaleLabels` name the bands.
  Collected values are not necessarily integers.
- `NUMERIC` / `COUNT` - measurements and tallies.
- `CLASSIFICATION` - one or more labels from `classificationOptions`.
- `TEXT` - free text.
- `OFFSET` - a millisecond offset into the conversation.

## Calculation types (`calculationType`)

- **`LLM_JUDGE`** - an LLM grades against `llmPrompt`. Creatable via the SDK.
- **`FORMULA`** - an expression over **two or more** other metrics. Creatable.
- **`PATTERN`** - a trigger followed by an outcome in a window. Creatable.
- **`THRESHOLD`** - compares one metric against a line, emits BOOLEAN. This is what
  a `*_check` is. Created via `POST /v1/metric/definitions/{idOrSlug}/thresholds`,
  which is **not in the SDK client**.
- **`PROVIDER`** - computed by Roark's own pipeline. Never authorable.

Internally `LLM_JUDGE` is stored as `LLM_PROMPT` and `PATTERN` as `TEMPORAL`; those
names never appear on the wire.

## Scope and context

- **`scope`**: `GLOBAL` (one value per conversation) or `PER_PARTICIPANT` (one per
  speaker; requires `participantRole`).
- **`participantRole`**: `AGENT`, `CUSTOMER`, `SIMULATED_CUSTOMER`,
  `BACKGROUND_SPEAKER`. Simulated calls write the caller as `SIMULATED_CUSTOMER`,
  live calls as `CUSTOMER`.
- **`supportedContexts`**: `CALL`, `SEGMENT`, `TURN` - the levels a metric produces
  values at. `CALL` means the whole conversation.
  **Gotcha:** on collected *values* the context enum is `CALL`, `SEGMENT`,
  `SEGMENT_RANGE` - a definition's `TURN` surfaces as `SEGMENT_RANGE`.

## Families (real system slugs)

**Timing / latency**: `call_duration`, `response_time`, `time_to_first_word`,
`silence_duration`, `turn_duration`, `longest_pause`, `latency_spike_count`,
`first_interruption_time`

**Turn-taking / duplex**: `interruption`, `interruption_count`,
`interruption_duration`, `interruption_appropriateness`, `agent_interruption_count`,
`incorrect_agent_interruption_count`, `incorrect_interruption_rate`,
`customer_barge_in_count`, `failed_barge_in`, `failed_barge_in_count`,
`failed_barge_in_rate`, `pre_interruption_speaker_duration`, `agent_cutoff`,
`agent_cutoff_count`, `overtalk_ratio`, `talk_to_listen_ratio`, `turn_count`,
`speaking_rate`

**Audio / voice quality**: `speech_quality_overall`, `speech_quality_signal`,
`speech_quality_background`, `speech_quality_mos`, `voice_naturalness`,
`voice_human_likeness`, `voice_consistency`, `accent`, `accent_stability`,
`in_car_detection`, `pronunciation_correctness`, `pronunciation_word_coverage`

**Transcription accuracy**: `transcription_score`, `transcription_wer`,
`transcription_discrepancy`

**Conversational quality**: `sentiment_score`, `emotion_label`, `dominant_emotion`,
`vocal_cue_label`, `frustration_score`, `user_effort_score`, `customer_reception`,
`conversation_flow_score`, `repetition_density`, `loop_count`,
`redundant_question_count`, `missed_response_count`, `comprehension_failure`,
`comprehension_failure_count`, `word_count`

**Outcome / adherence**: `call_outcome`, `task_completion`, `instruction_follow`,
`scenario_adherence`, `agent_expectations`, `agent_responsive`, `agent_spoke`,
`caller_intent`, `agent_containment`

**Transfer / escalation**: `transfer_requested`, `transfer_outcome`,
`transfer_request_count`, `transfer_success_count`, `transfer_failure_count`,
`human_transfer_reason`. `transfer_outcome` labels are exactly `Completed`,
`Failed`, `Requested (Unresolved)`, `Not Applicable`.

**Tools**: `tool_invocation_count`, `tool_invocation_correct`,
`tool_invocation_order_correct`, `tool_invocation_parameters_correct`,
`tool_invocation_result_correct`

**Compliance / safety**: `compliance_disclosure_completeness`,
`compliance_prohibited_language`, `compliance_pii_handling`,
`compliance_consent_collection`, `compliance_escalation_adherence`,
`compliance_scope_adherence`, `compliance_prompt_injection_resistance`,
`compliance_identity_consistency`, `compliance_hallucination_boundary`

**Knowledge base**: `knowledge_grounding_score`, `knowledge_grounding_violation`,
`knowledge_missed_answer`

**Voicemail / screening**: `voicemail_detected`, `voicemail_agent_left_message`,
`voicemail_handling_score`, `call_screening_encountered`,
`call_screening_handling_score`

**Property verification**: `property_transcript_mismatch`,
`property_transcript_mismatch_count`

## The 32 shipped checks (THRESHOLD, boolean)

Global and identical in every project, **not** project-dependent:

`compliance_prompt_injection_resistance_check`,
`compliance_prohibited_language_check`, `compliance_identity_consistency_check`,
`compliance_pii_handling_check`, `compliance_scope_adherence_check`,
`compliance_hallucination_boundary_check`, `knowledge_grounding_score_check`,
`transfer_failure_check`, `tool_invocation_correct_check`,
`tool_invocation_order_correct_check`, `tool_invocation_parameters_correct_check`,
`tool_invocation_result_correct_check`, `scenario_adherence_check`,
`instruction_follow_check`, `task_completion_check`, `user_effort_score_check`,
`customer_reception_check`, `conversation_flow_score_check`,
`redundant_question_count_check`, `loop_count_check`, `agent_cutoff_count_check`,
`incorrect_agent_interruption_count_check`, `speech_quality_overall_check`,
`voice_naturalness_check`, `voice_human_likeness_check`, `voice_consistency_check`,
`pronunciation_correctness_check`, `agent_responsive_check`, `agent_spoke_check`,
`agent_expectations_check`, `call_screening_handling_score_check`,
`transcription_meaning_changing_check`

Attaching a check auto-includes its source metric. Two are not named after their
source: `transcription_meaning_changing_check` (from `transcription_discrepancy`)
and `transfer_failure_check` (from `transfer_failure_count`).

## Where a metric does not apply

- **Simulation-only**: `agent_responsive`, `agent_spoke`, `scenario_adherence`,
  `agent_expectations`.
- **Live-only**: `tool_invocation_count`, `tool_invocation_correct`,
  `tool_invocation_order_correct`, `tool_invocation_parameters_correct`,
  `tool_invocation_result_correct`, `redundant_question_count`,
  `transcription_wer`, `transcription_discrepancy`.
- Metrics are also gated to `call` vs `chat`. A collection job whose metrics do not
  support the modality is rejected with 400.

A metric that does not apply to a conversation reports `captureStatus:
'NOT_APPLICABLE'` rather than failing.
