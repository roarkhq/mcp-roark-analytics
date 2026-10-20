---
name: assess-agent
description: >-
  Use to run a full assessment of a voice agent and deliver a findings report:
  onboard a new or existing agent, read the customer's testing document (or
  run discovery without one), turn it into flows, pilot and fix those flows,
  run the suite at sample sizes that survive scrutiny, verify every finding
  against the transcript and recording, re-run thin scenarios, and write a
  report of what the agent did well and what it did not, with latency and
  voice sections. Use whenever someone asks to "test this agent end to end",
  "onboard an agent", "run the full suite", "produce a test report", "assess
  this agent", or hands over a testing document or failure-mode list to run.
---

# Assess a voice agent end to end

The deliverable is a **report someone can act on**: each issue stated plainly
with how often it happened, where, and the calls that prove it; what the agent
did well; latency and voice; and what could not be tested and why. Simulations
are only the means.

Most of the work is making the test trustworthy before anything is counted,
then making every claim in the report hold up for a sceptical reader who
will click every link. One false finding costs more trust than ten missed
ones. If you have even a small doubt that a finding is real, leave it out.

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
| [report.md](references/report.md) | Writing, verifying, delivering and revising the report |

## 0. Collect the inputs (once, up front)

Ask for everything in one message. Do not place calls until you have the
budget, a way past any gate, and a concurrency limit.

| input | why it matters |
| --- | --- |
| How to reach the agent: each line or endpoint and what it is for, plus any gate (access code, IVR path, test menu) | Every flow has to pass the gate the same way. A gate nobody mentioned wastes the first discovery call |
| Testing document, failure-mode list, or meeting notes | Becomes the test matrix. Without one, discovery replaces it |
| Test data: accounts, order or tracking numbers, and the state each one is in. Is it shared, and does it change over time? | Most early "agent bugs" are test data surprises or collisions between concurrent calls |
| What counts as a failure for this agent (for example, escalation, transfers, data-specific mistakes) | Customers differ: one treats any escalation as a failure, another does not care about data-specific failures |
| Who calls this agent: languages, accents, ages | Sweep values should match the real caller mix, not the template default |
| Concurrency limit, business hours, whether calls can reach real people | Avoids flooding their line, calls hitting "we're closed", and a simulated caller talking to real staff |
| Budget: calls or minutes, and acceptable re-runs | Sets sample sizes. Every simulated call bills |
| Report audience, format, delivery location, and what they have already seen | Decides the report's shape before you write it. Someone else's results template is a requirement, not a suggestion |
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
4. **Sanity-check against public domain rules** (for example, a carrier's
   published pickup windows). What the agent actually does takes priority. The
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

**Metrics:**
- Before attaching a judge, check that it is producing values.
- Validate a new judge on a few contrasting calls first.
- Leave off checks that structurally misfire for this agent. For example, a
  premature-ending check on scenarios that end at a transfer. Keep them as
  information instead.
- Decide every check before launch. Checks are snapshotted when a run starts,
  and adding one later does not change that run's verdict.

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
- **Group the runs** into one run group (`simulationRunGroup.create`) so the
  assessment is one object. Note each run's id and what it covers.

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

**Re-score instead** (a metric collection job over existing calls) when only a
judge was wrong. It is cheaper and places no calls. It cannot fix our caller's
behaviour, and it cannot add a new check to a finished run's verdict.

## 8. Write the report

Follow [references/report.md](references/report.md) and
[references/latency-and-voice.md](references/latency-and-voice.md):
- What went well.
- Issues, ordered by how often they happened, each with prevalence, line,
  brief, a plain description, and examples ordered most severe first.
- Smaller items.
- Latency.
- Voice (listener-confirmed only).
- Unable to test fully, written as questions.

Before anything is shared, verify every link, quote, timestamp and number
against the platform.

## 9. Review, deliver, revise

1. **The user reviews first.** Their judgement on what is fair to the agent
   wins. Keep their wording edits verbatim. Diff the live document against
   your source before regenerating anything.
2. **Keep the report private** until the user says it is ready. Then deliver
   it where the customer works, with a short cover note.
3. **After sharing:** read the customer's comments first. Edit in place. Never
   re-paste or regenerate a document they can see.
4. **When the customer pushes back**, answer with the per-call evidence
   (timings, quotes), concede what their explanation does fit, and propose a
   clean re-test for the rest.

## Rules that apply throughout

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
  Long assessments outlive scratch directories.
