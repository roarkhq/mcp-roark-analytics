# Latency and voice: the two standing sections

Reviewers ask for both in every report. Latency can be measured automatically.
Voice quality, so far, cannot be judged without a person listening.

## Latency

**What to measure.** Measure the agent's response time per turn: from the end of
the caller's speech to the start of the agent's audible reply, as a caller hears
it over the phone. Use the platform's per-turn response time values, so that
every number a reader can click on matches the call page. Do not switch to your
own measurement halfway through. If you ever compare two methods, compare
like with like (platform to platform): a change of method once looked like a
regression.

**Exclude from the percentiles, and say so in one neutral line:**
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

**Report:**
- p50, p90, p95 and p99 over N replies in M calls.
- Bracket counts at round numbers: 2, 3, 4, 5, 6, 8 and 10 s.
- The slowest moments, each linked.
- A trend against earlier runs of the same agent, using the same method.
- A one-line method statement.

When almost every turn exceeds the reader's bar (for example 2 s), lead with
the typical value and the tail, not a list of every turn. A believable external
reference is useful, such as a published median for comparable agents, but
describe what is measured, not how the call was placed. Every reply over the
bar goes into a sheet with these columns: line, call, start and end times, the
text before and after, and a link opening a few seconds before the wait.

Run measurement batches only when no known metric artifact is live. At a
fixed concurrency, compare like with like.

## Voice quality

Automated detectors are not reliable enough to report from:
- speaker embeddings, pitch and loudness rules, voice-quality measures, audio
  language models;
- AI-voice detectors;
- classifiers trained on a few dozen labels.

All of these failed blind listening on short phone-audio lines. Treat them as a
way to build a review queue, never as a label or a rate.

### Process

1. **Build a review queue.**
   - Take the top candidates from the best available detectors, one or two per
     call, so a single call cannot dominate.
   - Add about 15% **random control** turns.
   - Shuffle the list, hide which detector picked each item, and keep the
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
5. **Report only what the listener marked real.** Take the rate from the random
   controls only, never from detector picks. Detector and labelling notes stay
   internal.
6. **Leave out sounds that are not the agent's voice.** Recorded prompts,
   test-line announcers, transfer messages and compliance notices are not the
   agent. Leave them out of voice findings, or confirm with the customer that
   they are intentional. Do not exempt them automatically: a line that is wrong
   the same way every time is still a defect.

Comparisons between agents need the same treatment for both: blind, random,
equal care. Detector-picked or non-blind listening once produced a large gap
between two agents that vanished when both were checked blind.
