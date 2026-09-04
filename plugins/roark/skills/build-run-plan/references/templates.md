# Testing-goal recipes

Roark's app ships run templates that pre-select metrics and flows for a common
goal. The public API has no template parameter, so these are **recipes you
assemble by hand**: attach the listed metric slugs (see `configure-metrics`) and
source the listed flows.

The metric slugs below are Roark's stable system slugs. Confirm they exist in the
project with `client.metric.listDefinitions()` before attaching; a project may
have a subset, and slugs can be added over time. The `*_check` slugs are the
pass/fail gates that pair with a base metric; attach both the base and its check
when you want a threshold.

**Sourcing the flows.** In the app these templates auto-source flows by a system
**label** (`live-bench`, `adversarial`, `health-check`, `voicemail`,
`happy-path`). **Labels are not exposed on the public API** - `customerFlow.list`
filters by `limit`, `after`, `searchText`, `type`, and `includeSystem` only, with
no label filter. So where a recipe says "flows labelled X", do this instead:

```ts
// System flows (Roark-curated, e.g. the voicemail greetings) need includeSystem.
const { data } = await client.customerFlow.list({ includeSystem: true, searchText: 'voicemail' })
```

then confirm the selection with the user by title before running. Do not invent a
`label` parameter.

## live-bench (standard benchmark)

Task completion, duplex/turn-taking dynamics, latency, conversational effort,
plus two safety spot-checks. Roark's default "how good is my agent" suite.

- Metrics: `call_outcome`, `instruction_follow`, `scenario_adherence`,
  `interruption_appropriateness`, `incorrect_interruption_rate`,
  `failed_barge_in_rate`, `customer_barge_in_count`, `overtalk_ratio`,
  `agent_cutoff_count`, `response_time`, `time_to_first_word`,
  `latency_spike_count`, `user_effort_score`, `comprehension_failure`,
  `repetition_density`, `loop_count`, `compliance_prompt_injection_resistance`,
  `compliance_pii_handling`
- Checks: `instruction_follow_check`, `scenario_adherence_check`,
  `user_effort_score_check`, `loop_count_check`, `agent_cutoff_count_check`,
  `compliance_prompt_injection_resistance_check`, `compliance_pii_handling_check`
- Flows: the Live Bench suite (labelled `live-bench` in the app; see the sourcing
  note above). The suite is **versioned** so published baselines stay comparable:
  do not substitute your own flows if the user wants a comparable benchmark score.

## flow-adherence

Does the agent stay on the authored conversation and follow instructions.

- Metrics: `scenario_adherence`, `instruction_follow`, `call_outcome`,
  `agent_expectations`
- Checks: `scenario_adherence_check`, `instruction_follow_check`,
  `agent_expectations_check`
- Flows: the user's own flows.

## red-teaming

Adversarial: jailbreaks, PII handling, prohibited language, scope, hallucination,
identity consistency.

- Metrics: `compliance_prompt_injection_resistance`, `compliance_pii_handling`,
  `compliance_prohibited_language`, `compliance_scope_adherence`,
  `compliance_hallucination_boundary`, `compliance_identity_consistency`
- Checks: each of the above with a `_check` suffix.
- Flows: those labelled `adversarial`.

## conversation-quality

Natural, empathetic, low-effort conversations.

- Metrics: `sentiment_score`, `frustration_score`, `user_effort_score`,
  `call_outcome`, `instruction_follow`, `comprehension_failure`,
  `redundant_question_count`, `missed_response_count`,
  `interruption_appropriateness`, `talk_to_listen_ratio`, `overtalk_ratio`,
  `response_time`
- Checks: `user_effort_score_check`, `instruction_follow_check`,
  `redundant_question_count_check`
- Flows: the user's own flows.

## knowledge-base-grounding

Faithful to the knowledge base: invents nothing, misses nothing.

- Metrics: `knowledge_grounding_score`, `knowledge_grounding_violation`,
  `knowledge_missed_answer`
- Checks: `knowledge_grounding_score_check`
- Flows: the user's own flows.

## multilingual

Run flows across languages by overriding the persona per language (see
flow-selection.md, `personaOverrideId`).

- Metrics: `comprehension_failure`, `instruction_follow`, `scenario_adherence`,
  `call_outcome`, `sentiment_score`
- Checks: `instruction_follow_check`, `scenario_adherence_check`
- Flows: the user's own flows, fanned across languages.

## tool-call-accuracy

Right tools, right arguments, right order.

- Metrics: `tool_invocation_correct`, `tool_invocation_parameters_correct`,
  `tool_invocation_order_correct`
- Checks: each of the above with a `_check` suffix.

## load-testing

Volume and concurrency. Hammer one flow's happy path; raise `iterationCount` and
`maxConcurrentJobs` (within the account quota).

- Metrics: `agent_responsive`, `response_time`, `time_to_first_word`
- Checks: `agent_responsive_check`

## health-check

Cheap liveness probe, good for scheduling.

- Metrics: `agent_spoke`, `time_to_first_word`, `response_time`
- Checks: `agent_spoke_check`
- Flows: those labelled `health-check`.

## voicemail-testing

Detect voicemail, leave the right message, hang up.

- Metrics: `voicemail_detected`, `voicemail_agent_left_message`,
  `voicemail_handling_score`
- Flows: the voicemail system flow (labelled `voicemail`).

## blank

No presets. Start from the user's stated goal and pick metrics directly.
