# Property sweeps (accent, noise, pace, emotion, interruption, age, gender)

A sweep runs one scenario many times and changes **one caller property** across
arms. The question it answers is "does this property make the agent worse?",
not "how good is the agent?".

## Design

- **Change one variable only.** Use one shared scenario and one base persona,
  with no persona overrides on the scenario. Edge cases that carry their own
  personas (an angry customer, a noisy caller) clash with the sweep.
- **Pick the scenario most sensitive to the property, not the simplest one.**
  - Every arm shares the scenario, so its difficulty cancels out.
  - Prefer scenarios where the caller must say concrete facts that the agent
    must echo back: amounts, dates, references. Those give ground truth for
    comprehension.
  - For interruption tests, prefer long agent turns.
- **The scenario must end cleanly on its own.** If it always ends in a
  transfer, a collision or a fixed bug, that failure swamps every arm and
  nothing can be attributed. Swap in a variant that completes end to end.
- **Choose values for the real caller population.** Use the accents and ages
  this agent actually hears, not the template default or a list skewed to one
  market. Do not imply coverage the voice catalogue does not have.
- **Size it.**
  - **5 calls per value at minimum.** Below 5, a value can never be flagged. A
    value with 5 or 6 calls only shows very large gaps, around 45 to 50 points.
  - **About 10 per value** for a property the agent's owner cares about. That is
    better than adding more values.
  - **Plan extra calls** when part of each arm is expected to be excluded.
  - **Decide iterations up front,** so you are not re-running to top up arms.
- **Never trim values quietly** to save cost. State the trade-off and let the
  user choose.

## Before reading any result: did the stimulus land?

Check per call, and listen to a few calls per arm:

- **Voice and accent:** did the voice actually change, and did the swept
  persona speak? In one suite every arm sounded identical, because the swept
  persona never took over from the opening, and the report still produced an
  accent ranking.
- **Gender:** some values are voiced identically (for example a "neutral"
  value voiced as female). Drop values that are not castable.
- **Pace:** measure words per second of caller speech, per arm. Per-turn rates
  are distorted by keypad and silence markers and by text-based timing. If an
  arm's pace does not change, check that the voice supports the speed setting.
- **Noise:** confirm the level on the first call, and confirm the bed has no
  intelligible speech.
- **Emotion:** check that the arms actually sound different. Emotion also
  changes the caller's wording, so emotion arms are not pure delivery tests.
- **Interruption:** check that the caller actually barged in, and that barge-ins
  did not fire during the IVR opening.

If the stimulus did not land, the run measures nothing. Fix it and re-run.

## Reading results

- **Compare each value against all the other values pooled.** Do not rank arms
  by raw score.
  - Use a significance test with correction for multiple comparisons.
  - Report a value as worse only when it clears that test.
  - Otherwise write "no value did measurably worse in this run", not "the
    property has no effect".
- **The agent makes random errors on every arm.** Failures that appear across
  all values go in their own bucket, "fails regardless of {property}". They
  are not attributed to the property.
- **Measure your noise floor.** Two identical arms scored 90% and 70% at 5 calls
  each. Treat any gap smaller than that as noise.
- **Use rates, not counts.** A struggling agent makes longer calls and
  accumulates more events.
- **Scope metrics to the axis.** Use comprehension for noise and pace, and
  appropriateness for emotion. Grade interruptions on whether yielding was
  appropriate, not on a mechanical "did not stop" rate. Not stopping for "mm-hm"
  is correct.
- **Some metrics audit the test side, not the agent.** Transcription discrepancy
  measures Roark's transcription. Signal quality drops by design under injected
  noise. Neither is an agent finding.
- **Do not compare absolute numbers across runs that used different voices or
  different code.**
- **Do not highlight differences the listener cannot hear.** If the user cannot
  hear the accents as different, do not frame the result around them.
