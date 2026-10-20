# Latency and voice: the two standing sections

Reviewers ask for both in every report. Both are measured by metrics attached
to every run in the suite, and the run group report reads them from there.
Latency figures come straight from the metric values. Voice metric flags need a
person listening to confirm them.

## Latency

**Metrics to attach:**
- `response_time`: per turn, from the end of one speaker's turn to the start of
  the next, as heard on the call. Read the agent's values only.
- `latency_spike_count`: replies slower than 3 s, per call.
- `longest_pause`: the longest gap in the call.
- A threshold on `response_time` at the reader's bar (for example, agent
  median at most 5 s). Projects rarely have one at the customer's number, so
  create it.

Every figure in the section is computed from these values, so a number a reader
clicks on matches the call page. Never switch to your own measurement, and
never mix methods: a change of method once looked like a regression.

**Exclude from the percentiles, and say so in one neutral line.** Filter the
metric's turn values; do not re-measure the gaps:
- **Zero-length overlaps.** The caller backchannels just as the agent starts.
- **Routing waits.** On gated or test lines, the first wait is the line routing
  the call, not the agent.
- **Caller interjections inside an agent turn.** These are timed from the
  interjection, not from the end of the caller's turn.
- **Waits after our own scripted pauses, and keypad entry timeouts.** Measure
  keypad waits separately if the brief asks about them.
- **Ambiguous gaps.** If either channel is active during the gap, leave it out.

**Never quote a run-level or pooled median without checking whose turns it
includes.** One run summary quoted a 1.8 s "agent" median that pooled the
simulated caller (1.4 s) with the agent (4.5 s).

**What a good latency section says** (check the group report against it):
- the typical value and the tail (p50, p90, p95) over N replies in M calls;
- how many replies went over the reader's bar, from the threshold check;
- the slowest moments, each linked to the call at the wait;
- a trend against earlier runs of the same agent, on the same metrics.

When almost every turn exceeds the reader's bar (for example 2 s), lead with
the typical value and the tail, not a list of every turn. Every reply over the
bar is already on its call page through the threshold, so link there rather
than listing them in a file.

Compare runs only at the same concurrency and on the same metric version.

## Voice quality

**Metrics to attach:**
- `voice_consistency` and `voice_consistency_check`: per line, whether the
  agent stayed in its usual voice (a line 6 dB or more quieter than usual, or a
  different speaker, breaks it).
- `same_speaker`, `vocal_loudness_variation` and `vocal_pitch_variation`: the
  components, per line, to see what kind of break it was and to set your own
  cutoffs if the customer describes the problem differently.
- `voice_naturalness`, `voice_human_likeness` and `speech_quality_overall` when
  the brief asks about voice quality in general.

If the customer describes a defect none of these captures (for example, lines
dropping into a lower register), build a metric for it, such as a `PATTERN`
over `vocal_pitch_variation` turn values, rather than measuring it offline.

Voice metric flags are candidates, not findings. On short phone-audio lines,
every automated voice measure tried so far, including these, flagged lines a
listener judged normal, and missed some real ones. A person listens to every
flagged line before it is reported.

### Process

1. **Build a review queue from the metric values.**
   - Take the flagged lines (failed `voice_consistency` lines, then the
     largest `vocal_loudness_variation` and `vocal_pitch_variation` values and
     the lowest `same_speaker` values), one or two per call, so a single call
     cannot dominate.
   - Add about 15% **random control** turns.
   - Shuffle the list, hide which metric picked each item, and keep the
     answer key off the page.
   - Check that the controls really are random. A sampling bug once made every
     control a greeting.
2. **Play each item with a baseline.** Play a normal turn from the same call
   first: one at the agent's usual pitch and loudness, which is not itself
   flagged. Then play the candidate turn. Without a baseline, a listener cannot
   judge level or register. Start clips about 0.6 s before the line so the first
   word is not cut.
3. **Judge in the context of the whole call.** Some voices are deliberately
   dynamic, and a sentence that sounds odd on its own can be natural within the
   call. Holding lines that drop in pitch, extra energy at the start of a turn,
   and same-phrase variation across calls are normal speech, not defects.
4. **Ask the listener for:**
   - a verdict: real, not real or unsure;
   - a category: quieter or whispery, higher pitch, lower pitch, slower,
     different voice or register, robotic, pitch moving through the turn,
     glitch, other;
   - a severity: Severe, Moderate or Minor;
   - a note.

   Repeat about 20 items unmarked, to measure how consistent the listener is.
5. **Only listener-confirmed lines count.** Compare the verdicts with what
   the group report says about voice. Flags the listener rejected, or a rate
   built on them, go to the user as report gaps (report.md), each with its call
   and line. Confirmed lines are linked at the flagged line on the call page.
   The random controls tell you how much the metrics miss: if the listener
   confirms control lines the metrics passed, tighten the cutoffs or add a
   metric and re-score, so the count comes from the platform. Labelling notes
   stay internal.
6. **Leave out sounds that are not the agent's voice.** Recorded prompts,
   test-line announcers, transfer messages and compliance notices are not the
   agent. Leave them out of voice findings, or confirm with the customer that
   they are intentional. Do not exempt them automatically: a line that is wrong
   the same way every time is still a defect.

Comparisons between agents need the same treatment for both: blind, random,
equal care. Metric-picked or non-blind listening once produced a large gap
between two agents that vanished when both were checked blind.
