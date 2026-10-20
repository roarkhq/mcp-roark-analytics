---
name: agent-test-suite
description: >-
  Use to set up and run a full test suite for a voice agent and deliver the
  results in Roark: onboard a new or existing agent, read the customer's
  testing document (or run discovery without one), turn it into flows, attach
  a metric for everything the brief asks about (latency, voice consistency,
  behaviour), pilot and fix those flows, run the suite at sample sizes that
  survive scrutiny, verify every finding against the transcript and recording,
  re-run thin scenarios, and build the run group report that shows what the
  agent did well and what it did not. Use whenever someone asks to "test this
  agent end to end", "onboard an agent", "set up a test suite", "run the full
  suite", "produce a test report", or hands over a testing document or
  failure-mode list to run. For a single run with no report, use
  build-run-plan instead.
---

# Set up and run a test suite for a voice agent

The deliverable is a **report someone can act on**, and it lives in the
product: the run group that holds the suite's runs, and the report Roark writes
for it. It states each issue plainly with how often it happened, where, and the
calls that prove it; what the agent did well; and latency and voice. Link the
reader to it. Never write a separate document, spreadsheet or deck, never
upload recordings elsewhere, and never offer an export: the group page has
**Download PDF** for anyone who needs a file. Simulations are only the means.

Most of the work is making the test trustworthy before anything is counted,
then making every claim in the report hold up for a sceptical reader who
will click every link. One false finding costs more trust than ten missed
ones. If you have even a small doubt that a finding is real, leave it out.

**Everything is measured by metrics on the platform.** Each case in the test
matrix and each report section (latency, voice, comprehension, transfers) has
a metric attached to the run that measures it. If you want to measure latency,
attach the response time metric; if you want to measure voice consistency,
attach the voice consistency metric. When nothing fits, create one before the
run. Never produce a reported number from your own script, spreadsheet or
offline analysis: the reader must be able to open the call and see the same
value. Reading transcripts and listening verify what a metric flagged. They do
not replace the metric.

Act as the test lead, not a run button. Expect loops:
- flows get fixed after the pilot;
- findings get dropped in triage;
- thin scenarios get re-run;
- the report gets revised after review.

Plan for the time this takes. A product fix that has to land before a re-run
can cost hours of deploy time, so prefer workarounds in flows and config.

**Read first:**
- `../roark-overview/SKILL.md`, for how the MCP works and the cost rule.
- `../roark-concepts/flows.md` and `../roark-concepts/scripted-flows.md`.

This skill orchestrates `register-agent`, `author-personas-flows`,
`author-scripted-flows`, `build-run-plan`, `configure-metrics` and
`read-results`.

**References**, load each when you reach its phase:

| file | load when |
| --- | --- |
| [test-instructions.md](references/test-instructions.md) | Reading the customer's testing document or failure-mode list |
| [pitfalls.md](references/pitfalls.md) | Before building flows and personas, and whenever a result looks odd |
| [sweeps.md](references/sweeps.md) | The ask includes accents, noise, pace, emotion, interruptions or other caller properties |
| [triage.md](references/triage.md) | Turning failures and transcript reads into verified findings |
| [latency-and-voice.md](references/latency-and-voice.md) | Measuring response time, and any voice quality section |
| [report.md](references/report.md) | Building, checking, delivering and revising the run group report |

## 0. Collect the inputs (once, up front)

Ask for everything in one message. Do not place calls until you have the
budget, a way past any gate, and a concurrency limit.

| input | why it matters |
| --- | --- |
| How to reach the agent: each line or endpoint and what it is for, plus any gate (access code, IVR path, test menu) | Every flow has to pass the gate the same way. A gate nobody mentioned wastes the first discovery call |
| Testing document, failure-mode list, or meeting notes | Becomes the test matrix. Without one, discovery replaces it |
| Test data: accounts, order or reference numbers, and the state each one is in. Is it shared, and does it change over time? | Most early "agent bugs" are test data surprises or collisions between concurrent calls |
| What counts as a failure for this agent (for example, escalation, transfers, data-specific mistakes) | Customers differ: one treats any escalation as a failure, another does not care about data-specific failures |
| Who calls this agent: languages, accents, ages | Sweep values should match the real caller mix, not the template default |
| Concurrency limit, business hours, whether calls can reach real people | Avoids flooding their line, calls hitting "we're closed", and a simulated caller talking to real staff |
| Budget: calls or minutes, and acceptable re-runs | Sets sample sizes. Every simulated call bills |
| Report audience, who needs access to the Roark project, and what they have already seen | They read the run group report in the product, so they need project access before you share the link |
| Data handling: which external models or vendors may process their transcripts or audio | Some customers clear only specific providers. Never send their audio or transcripts anywhere else without explicit approval |
| Who answers "is this intended?" questions, and how quickly | Ambiguous behaviour becomes a question to them, not a finding |

## 1. Read the instructions and build the test matrix

With a document, follow
[references/test-instructions.md](references/test-instructions.md):
1. Read all of it.
2. Split every sub-bullet into its own case. An "or" in the document does not
   mean "pick one".
3. Mark each case as simulatable, evaluatable, both, or neither.
4. Send the customer your open questions before the full run.

The matrix has one row per case. Each row records:
- the customer's own numbering (Part 3, Mission 2);
- the expected behaviour, quoted;
- the metric that measures it (see "Metric plan" in step 3);
- the test data it needs;
- the flow type: improv, scripted, or a scripted opening followed by improv;
- the target number of calls;
- whether the case changes shared state.

Keep the matrix as an internal coverage table. Later it records which run
covered each row and the result for that row.

Without a document, run discovery (step 2) first. Then write the matrix from
what the agent actually offers: each menu branch, each intent, each failure
path (invalid input, silence, repeated failure, transfer). Show it to the user
before running anything. Never invent expectations the customer has not stated
and then report the agent for missing them.

**Sizing:**
- At least 9 counted calls per scenario you intend to quote a rate for.
  "1 of 2" will be challenged, and you will re-run it anyway.
- At least 5 counted calls per value in a property sweep (see sweeps.md).
- Expect to lose some calls to the gate, telephony and invalidation. Plan for
  more than the minimum.
- Preview the total with `build-run-plan` before spending.

## 2. Discover (always, even with instructions)

1. **Prove you can get past the gate.** Place one call.
2. **Explore each branch.** Place 3 to 5 calls per branch, one at a time, and
   read every transcript in full.
3. **Write down:**
   - The agent's real question order, prompts and menu wording, and which
     inputs work (voice, keypad, both).
   - How each piece of test data behaves: the status read out, the actions
     offered, and whether state changes after a call (a booking made by one
     call blocks the next).
   - Timeouts, how the agent ends calls, where it transfers, and when transfers
     reach real people.
   - Anything in the instructions you cannot reach.
4. **Sanity-check against public domain rules** (for example, published
   opening hours or service cut-offs). What the agent actually does takes priority. The
   check only stops you writing an expectation that encodes a wrong fact: a
   wrongly expected refusal is itself a false positive.
5. **Check before you build.** If the project has call history, check how the
   agent really behaves there before building a variant around a premise. A
   variant can test something the agent never does (for example, "verifies the
   caller by voice" when it only verifies by account).

Discovery produces a behaviour map for the flows, **test data notes** for the
report, and the first **unable to test** items.

## 3. Build flows, personas and expectations

Use `author-personas-flows` for improv, `author-scripted-flows` for exact
routing and keypad entry, and `configure-metrics` for checks. Read
[references/pitfalls.md](references/pitfalls.md) first. Its flow and persona
sections are where most wasted runs came from.

**Flows:**
- One goal per flow.
- When variants differ only by test data, give each its own single-scenario
  flow. A caller can drift onto the main scenario's data.
- Before writing a new flow, check that no existing one covers it.

**Expectations:**
- Quote the instruction they test.
- Assert the agent's behaviour, conditional on what the data shows, never a
  fact about the data ("finds the $12 perk" fails whenever the account changes).
- Include "not applicable when ..." and "either X or explains why not" branches
  where the outcome depends on rules or data.
- Never put timing in an expectation. Response time measures it.

**Personas:**
- Use generic callers, with no errands of their own.
- Give each persona a distinct voice (accent, age or gender differs).
- Use the account holder's details where the agent looks them up.
- Never let a persona make up identifiers. Give it explicit values.

**End-call reasons:** always set them. Without them the caller cannot hang up,
and stuck calls run to the time cap. Cover:
- the goal is done;
- the agent transfers, disconnects, or a person picks up;
- the agent is stuck (it repeats "I didn't catch that" after two clear tries,
  or reports a system error);
- the line repeats the same automated prompt three times.

**Metric plan.** Use `configure-metrics`. Map every matrix row and every
report section to a metric before the pilot, and attach all of them to every
plan in the suite so that runs are comparable:

| what the brief asks about | metrics to attach |
| --- | --- |
| A stated behaviour ("Verify the agent...", "must NOT...") | The flow's expectations, graded by `agent_expectations` (with `agent_expectations_check` to gate) |
| A behaviour that applies across flows (confirms before acting, never reads an internal ID) | A custom `LLM_JUDGE` metric, one question each |
| Response time | `response_time` (per turn, agent), `latency_spike_count`, `longest_pause`; a threshold on `response_time` at the reader's bar (for example, agent median at most 5 s) |
| Voice consistency | `voice_consistency` and `voice_consistency_check`, plus `same_speaker`, `vocal_loudness_variation` and `vocal_pitch_variation` to see which kind of break it was |
| Voice and audio quality in general | `voice_naturalness`, `voice_human_likeness`, `speech_quality_overall` |
| Understanding the caller | `comprehension_failure` (per caller turn), `comprehension_failure_count`, `redundant_question_count` |
| Interruptions and talking over the caller | `agent_cutoff_count`, `incorrect_agent_interruption_count`, `interruption_appropriateness` |
| Transfers and escalation | `transfer_requested`, `transfer_outcome`, `transfer_failure_count`, `human_transfer_reason` |
| Loops and getting stuck | `loop_count` |
| The agent answered at all | `agent_spoke`, `agent_responsive` (simulation-only) |
| A timing sequence (no reply within N seconds of a prompt, a repeated prompt) | A custom `PATTERN` metric |
| A cutoff on an existing metric that no shipped check covers | A threshold on that metric (see `configure-metrics`: the route is not in the SDK client) |

Confirm each slug with `client.metric.listDefinitions()`; projects differ.

- **No metric fits:** create one with `configure-metrics` and validate it on a
  few contrasting calls before the full run.
- **The platform cannot measure it at all:** tell the user before the run,
  with what the metric would need. Do not fill the gap with an offline
  measurement in the report.
- **Check every metric produces values** on the pilot calls (step 4).
- **Leave off checks that structurally misfire** for this agent, for example a
  premature-ending check on scenarios that end at a transfer. Keep the metric
  attached as information instead.
- **Decide every check before launch.** Checks are snapshotted when a run
  starts, and adding one later does not change that run's verdict. Metric
  values can still be added to finished calls with a collection job (step 7).

## 4. Smoke, pilot and fix (do not skip)

1. **Smoke.** Run each new flow 1 to 3 times, at low concurrency, and read
   every transcript. Apply this per-call checklist:
   1. Did the call get past the gate and reach the agent? Did the agent speak?
   2. Did **our caller** do what the flow says, in order? Check that it used its
      own test data, did not ask for a person unless the flow requires it,
      spoke no stage directions or tool output, and never answered like the
      agent ("How can I help you today?").
   3. Did the call reach the step under test, or end or divert before it?
   4. For sweeps: did the swept property actually reach the caller (voice
      changed, noise audible, pace different)? Listen to a few.
   5. Was the job invalidated (`SCRIPT_DIVERGED`, `REQUIRED_STEP_NOT_REACHED`,
      `REQUIRED_STAGE_INCOMPLETE`, `CALLER_NEVER_TOOK_OVER`,
      `AGENT_NEVER_SPOKE`)? Invalidated calls are not results.
   6. Does every attached check have a value?
2. **Fix and repeat.** Fix the flow and pilot again until our side is clean.
   Re-read any flow, plan or variant after writing it. Create and update calls
   have silently dropped fields while echoing them back.
3. **Validate fixes narrowly.** Use one small run on the flow that showed the
   worst instance of the problem. Put it in a separate plan, so you never
   have to trim and then restore the main one.

A flow problem found after the full run costs the whole run.

## 5. Full run

- **Before starting:**
  - Check that no other large runs share capacity right now.
  - Check that the calls fall inside the customer's business hours if
    transfers matter.
  - Check that every fix you depend on is deployed, not just merged.
  - Start the whole suite on the same code. A run that straddles a fix is a
    mixed test and must be re-run.
- **Concurrency:**
  - Start low, then raise it only while silent and failed calls stay at zero.
  - Run scenarios that change shared state (bookings, cases, holds) one at a
    time, on distinct dates, and in dependency order.
- **Monitor the first calls of every run.** Did they connect, and is the agent
  speaking? Then let it finish.
- **Group the runs.** Note each run's id and what it covers. When the
  suite has 2 to 20 runs, put them in one run group:
  - Call `simulationRunGroup.create` with `simulationRunPlanJobIds`, the runs
    that already exist. Never pass `simulationRunPlanIds`: that starts a new
    run of every plan and places real calls.
  - One run needs no group.
  - Above 20 runs, group the runs that count in the report (the latest valid
    run per scenario). Leave superseded runs out.

## 6. Triage

Follow [references/triage.md](references/triage.md). In short:
- Automated check failures, expectation verdicts and generated summaries are
  **candidates**.
- A candidate becomes a finding only after you have opened the transcript, and
  the recording for anything about timing, silence, overlap, audio or voice.
- Our caller, our transcription and the test data must be ruled out as causes.
- It must be counted against the calls where the situation actually arose.

Also read passed calls: real issues often fail no check.

## 7. Re-run what is thin, or re-score

**Re-run before writing:**
- every scenario where a finding's denominator is under 9;
- every scenario where our caller misbehaved in enough calls that excluding
  them leaves too few;
- anything that surprised you or that a reviewer will question.

Ask before changing caller prompts on a re-run, and keep the scenario the same
so the counts combine.

**Re-score instead** (a metric collection job over existing calls, see
`monitor-live-calls`) when only a judge was wrong, or when reading found an
issue that no attached metric measures: create the metric, collect it over the
suite's calls, and count from its values. It is cheaper and places no calls. It cannot fix our caller's
behaviour, and it cannot add a new check to a finished run's verdict.

## 8. Build the report in the product

Follow [references/report.md](references/report.md) and
[references/latency-and-voice.md](references/latency-and-voice.md):
1. Group the runs that count and generate the group report
   (`simulationRunGroup.regenerateReport`).
2. Check every issue, example, quote and number in it against the calls and
   your triage ledger.
3. Fix what is wrong at its source (the group's runs, a metric, a re-score),
   then regenerate. List what you cannot fix that way for the user as report
   gaps, with the call and the reason.
4. Write the "unable to test fully" questions for the user.

Every number in the report comes from metric values on the calls.

## 9. Review, deliver, revise

1. **The user reviews first.** Their judgement on what is fair to the agent
   wins.
2. **Keep the report private** until the user says it is ready. Then share the
   group link with a short cover note: which project to select, the status, the
   open questions, and anything not covered.
3. **After sharing:** revise through the product (the group's runs, metrics,
   re-scores) and regenerate. Tell the user before regenerating a report the
   customer has already read.
4. **When the customer pushes back**, answer with the per-call evidence
   (timings, quotes), concede what their explanation does fit, and propose a
   clean re-test for the rest.

## Rules that apply throughout

- **Metrics measure, people verify.** Every reported figure traces to a metric
  value a reader can open on the call page. Your reading and listening confirm
  or reject what the metrics flag, and feed new metrics when they find
  something no metric caught.
- **Every number has a denominator.** It is the calls where the situation arose
  ("3 of 24 calls where the agent asked X"), not all calls. Floors are written
  as floors ("at least 13").
- **Quote the agent exactly.** Never paraphrase into a stronger claim. Re-read
  the transcript when in doubt, and check the audio when the words matter.
- **Our side is never the agent's fault.** This covers our caller, our
  transcription, our scripted steps, and calls that never reached the agent.
  Fix, re-run or exclude. Never report them as agent behaviour.
- **Never hide the agent's real failures** to make a run look better. Exclude
  only calls whose problem is on our side.
- **Possibly intended behaviour is a question:** "Could you confirm whether X
  is expected to Y at this stage?"
- **Be fair to the agent.** Say how often it got it right. Correct behaviour
  (refusing to reveal data before verification, asking a clarifying question)
  is not a finding.
- **Check hypotheses before stating causes**, including the user's. State what
  was measured, not a diagnosis.
- **Customer copy uses no internal vocabulary.** No vendor or engine names, and
  none of "judge", "false positive", "variant", "harness" or metric slugs. No
  mention of our own bugs, re-runs or excluded calls.
- **Ask before anything costly, destructive or visible to the customer:**
  large runs, re-runs, deleting or hiding data, editing shared flows, writes in
  the customer's project, and buying numbers. Never trim coverage quietly. State
  the trade.
- **Treat "this looks weird" from the user as a priority lead.** Verify it with
  data before defending a result.
- **Persist state outside temporary folders:** run ids, the ledger, labels.
  Long test suites outlive scratch directories.
