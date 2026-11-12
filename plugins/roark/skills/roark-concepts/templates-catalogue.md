---
name: "templates-catalogue"
description: "The run templates that ship with Roark - what each one tests, checked against the system data catalogue."
---

<!-- Synced from https://github.com/roarkhq/app-roark-analytics/tree/main/src/packages/roark-concepts. Do not edit here: edits are overwritten by the next sync. -->

# Run template catalogue

Every run template the product offers, in slug order. The `Robustness` ones are
property sweeps: one flow run once per value of one caller or line property. `table-parsers.test.ts`
checks this list against the system data catalogue, so a template added or
renamed there fails the test run until it is listed here. See the templates
concept for what a template carries and how to choose one.

| Template                         | Slug                          | Category          | Tests                                                                                                                                     |
| -------------------------------- | ----------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Accent handling                  | `accent-handling`             | Robustness        | Runs one flow with callers from every region, and reports where the agent stops understanding.                                            |
| Caller age handling              | `age-handling`                | Robustness        | Runs one flow with child, teenage, adult and elderly callers, and reports which the agent understands worst.                              |
| Background noise robustness      | `background-noise-robustness` | Robustness        | Runs one flow through every background the caller could be in, from silence to a construction site, and reports what each one costs.      |
| Blank                            | `blank`                       | Your templates    | Start from scratch. Pick metrics, flows, and test profiles yourself.                                                                      |
| Call screening                   | `call-screening`              | Voice & telephony | Does the agent notice a screener answered, answer it directly, and hold its pitch for a person?                                           |
| Conversation quality             | `conversation-quality`        | Quality           | How natural, empathetic, and helpful the agent sounds across realistic, unscripted conversations.                                         |
| Emotion handling                 | `emotion-handling`            | Robustness        | Runs one flow with callers who are angry, anxious, confused or rushed, and reports which moods the agent handles worst.                   |
| Flow adherence                   | `flow-adherence`              | Quality           | Does the agent follow the flows you authored, step by step, and reach the outcome each expects?                                           |
| Gender handling                  | `gender-handling`             | Robustness        | Runs one flow with callers of each voice gender, and reports whether the agent understands and treats them the same.                      |
| Health check                     | `health-check`                | Performance       | A minimal probe call on a schedule. Verifies the agent answers, speaks, and stays responsive.                                             |
| Interruption handling            | `interruption-handling`       | Robustness        | Runs one flow with callers who never interrupt, who only make listening noises, and who talk over the agent, and reports what each costs. |
| Knowledge base grounding         | `knowledge-base-grounding`    | Quality           | Ask questions your knowledge base answers, then measure whether the agent stays faithful to the source.                                   |
| How the agent handles a bad line | `line-quality-handling`       | Robustness        | Runs one flow on each line below, so the report says what each step down costs.                                                           |
| Live Bench                       | `live-bench`                  | Benchmark         | Roark’s standard voice-agent benchmark: task completion, turn-taking under interruption, latency, and robustness in realistic conditions. |
| Load testing                     | `load-testing`                | Performance       | Run many simulations in parallel to surface latency, dropped calls, and concurrency limits.                                               |
| Multilingual                     | `multilingual`                | Quality           | Run your scenarios across languages. Tests detection, comprehension, and response-language handling.                                      |
| Question & answer check          | `question-answer-check`       | Quality           | Give a list of questions and the answers you expect. Each runs as its own call, graded on whether the agent answered correctly.           |
| Red teaming                      | `red-teaming`                 | Safety            | Adversarial probing. Tests refusals, jailbreak resistance, and whether the agent’s policy holds.                                          |
| Speech pace handling             | `speech-pace-handling`        | Robustness        | Runs one flow with callers who rush and callers who drag, and reports what pace costs.                                                    |
| Tool call accuracy               | `tool-call-accuracy`          | Quality           | Did the agent call the right tools, with the right arguments, at the right point in the call?                                             |
| Voicemail testing                | `voicemail-testing`           | Voice & telephony | Does the agent detect voicemail, leave a clean message, and hang up at the right moment?                                                  |
