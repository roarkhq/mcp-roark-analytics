# From candidates to verified findings

Automated checks, expectation verdicts, run debriefs and group reports are
**candidates**. In real test suites they have both raised false failures and
missed real ones. A generated summary once headlined a high-severity "fabricated
billing details" theme that came entirely from a transcription error. The report
rests on what you verify.

## Where candidates come from

1. Failed checks, flagged metric values and agent-expectation verdicts, read
   through `read-results`.
2. The run debrief (`simulationRunPlanJob.createDebrief`) and the group report
   (`simulationRunGroup.regenerateReport`). Use them to cluster, never as
   evidence. Compare every theme against your own findings before trusting it.
   Both cover every call in their runs, so a run with problems on the test side
   has to be replaced by a clean run before the group report is regenerated.
3. **Your own reading.** Read at least 3 transcripts per scenario in full,
   including calls that passed. The biggest real findings often fail no check:
   - figures that do not add up within a call;
   - a confirmation given before the action was checked;
   - an internal ID read aloud;
   - a long silence after a prompt;
   - markup read aloud.

   When reading finds an issue no attached metric measures, create a metric
   for it and collect it over the suite's calls (a collection job), so its
   count comes from the platform, not from your notes.
4. Latency and voice metric values, as in latency-and-voice.md.
5. Anything the user or the agent's owner flags. A "this looks weird" from them
   is a priority lead.

For large runs, split the reading across parallel reviewers, one per run or per
part, each writing structured verdicts. Then re-check the biggest claims
yourself.

## Verify each candidate

1. **Transcript.** Open it at the moment. Confirm the agent said what the
   candidate claims, and copy its exact words.
2. **Recording.** Check it for anything about timing, silence, talking over,
   audio, voice, names or numbers. The call record gives the recording URL
   (`call.getByID`); it is stereo with one speaker per channel.
   - The live transcript of the agent mangles numbers ("74.02" became
     "$740.02") and names.
   - A failure cannot rest on text that the recording or a second
     transcription disagrees with.
3. **The test side.** Rule out each of these:
   - Did the simulated caller follow the flow and use its own data?
   - Did it interrupt, overload the turn, go off brief, or make something up?
   - Did the call even reach the step under test?
4. **Test data.** Would a fresh state or another record change the outcome? Does
   the same claim appear on every call with this input?
5. **The instructions.** Is the behaviour actually required, or only what you
   expected? Is it correct behaviour, such as refusing to share data before
   verification?
6. **Wording.** Does your description match the sequence in the call, and does
   it claim no more than the evidence? "Never booked" is too strong when you
   only saw the confirmation step fail.

## Recurring false-failure classes

- **Expectation judges:**
  - ignore their own "not applicable" and "or explains why" branches;
  - demand exact wording when the agent paraphrased correctly;
  - guess timing from text;
  - grade a transfer as "closing over the request";
  - give different verdicts on identical input across repeats.
- **Comprehension-style judges:**
  - "didn't catch that" after the simulated caller's silence or cut-off;
  - the simulated caller's own confusion;
  - name transcription variants;
  - pleasantry exchanges;
  - correct clarifying questions;
  - menu lines and recorded notices;
  - date arithmetic done without the call's local date.
- **Hallucination-style judges:**
  - real account data read out;
  - two items in one call treated as one;
  - a menu option or a fresh lookup result read as a contradiction;
  - the agent's own persona name;
  - both speakers graded instead of the agent only.
- **Duplicate or redundancy judges:** a standard menu line ("Would you like to
  repeat that?") counted as a repeated question.
- **Aggregation:**
  - One borderline flag in about six exchanges fails the whole call.
  - A single stuck state repeated 50 times becomes 50 flags.
  - Duplicate expectation snapshots can grade one expectation several times.
- **Polarity:** a boolean where true means "clean" read as "event happened".
  Check stored values against the judge's reasoning.
- **Display:** an evidence label that contradicts the reasoning ("Failed" above
  "no evidence of mishearing"). Trust the reasoning, and report the label to
  Roark support.
- **The recording pipeline** (report it to Roark support with the call id, and
  re-run the scenario if it changes the counts):
  - transcript lines that were never spoken (interrupted turns stored whole);
  - stale timestamps on held or interrupted turns;
  - keypad and silence markers counted as speech;
  - test-line or IVR recordings on the agent's channel.

When one judge misfires repeatedly on this agent, drop its check from the
verdict and keep the metric as information. Do not patch its prompt in the
middle of a suite.

## Classify

| class | goes to |
| --- | --- |
| Agent issue | Issues found, or Smaller items if minor or one-off |
| Possibly intended | Unable to test fully, as a "Could you confirm whether..." question |
| The test side (simulated caller, transcription, scripted steps, telephony) | Nowhere. Fix the flow, re-run, and group the clean run instead |
| Test data | A test data note inside Unable to test fully |
| Correct behaviour | Dropped. A strict-but-correct rule can be one awareness line if it surprises callers |
| Not an issue | Dropped. Keep the reason in the ledger |

A finding that depends on a test-environment problem still stands if the agent's
response would be wrong even if the situation were real. An example is
confirming a booking before checking whether it is allowed.

## Count honestly

Use these rules to check the figures in the group report. Where its figure
differs from yours, find out why; a difference you cannot fix through runs or
metrics goes to the user as a report gap.

- **Numerator:** calls where the issue happened. **Denominator:** calls where
  the situation arose (the agent asked the question, the caller gave an invalid
  number, the record was in that state). Write the denominator's definition into
  the prevalence line.
- **Count calls, not occurrences.** Mention repeats within a call in the
  description.
- **Labels:** **High** at 50% or more, **Medium** at 10% or more, **Low** below
  10%.
- **Small samples:** under 9 calls in the denominator, re-run before quoting a
  rate. A single occurrence is written as "in one call".
- **Late recoveries:** when the agent eventually gets it right late in a call,
  say so in the example ("said nothing for the first two attempts, then said the
  number was not valid"). The report should never look like the late recovery
  was missed.
- **Severity:** give each example a severity (how much it hurts the caller), so
  that examples can be ordered most severe first.
- **Rate samples:** a rate needs a random or complete sample. Calls picked by a
  metric or by a reviewer who knew which agent they were hearing overstate it.
- **Recompute every number from the final, verified set,** never from an
  earlier draft.

## Keep a ledger

Keep one row per candidate: calls, verdict, class, reason, the exact quote, and
the link. Revisions ("drop this", "is that exactly what it said?") then take
minutes instead of a re-investigation, and dropped findings stay dropped.
Store the ledger somewhere durable.

## Cost and data handling

- Run cheap automated checks across every call for recall. Spend careful
  reading (yours or a strong model's) only on the candidates: a few dozen per
  report, not every call.
- Re-score stored calls instead of placing new ones when only a judge was wrong.
- Send transcripts or audio only to providers the agent's owner has cleared.
  Keep listening pages local.
