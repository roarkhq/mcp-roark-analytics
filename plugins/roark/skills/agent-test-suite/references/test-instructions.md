# Reading the customer's testing instructions

The brief arrives in one of three shapes:
- a testing document written for **human testers**: lines to call, parts or
  missions, step-by-step actions, test data, and the behaviour to verify;
- a **failure-mode list**: categories of things the agent gets wrong, with
  examples;
- an email or **meeting transcript** with a list of asks.

Read all of it before placing any call. It is your best source on how the agent
is meant to behave, and most later report wording ("Part 3 expects...") cites
it.

## Every sub-item is its own case

- Split each bullet and sub-bullet into a separate row of the matrix.
- An "or" in an action ("pause halfway through
  a card number or an order number") means test both, not pick one. Missing a sub-item
  the customer asked for is the first thing they notice.
- Keep a coverage table per part, and check it before every report.
- Name runs and sections in the customer's own words. Group results under their
  headings, not ours.

## Can we simulate it, and can we evaluate it?

For each case, answer two separate questions:
- **Can the simulated caller produce the situation?** For example: a specific
  emotion that is actually audible, a mid-call change of speaker, a barge-in, a
  given caller ID, a text message received on our side.
- **Can we judge the outcome from what we observe?** For example: comprehension
  needs facts we told the caller to say, because we never see the agent's own
  transcript. Timing needs the recording, not text.

If either answer is no, raise it with the customer before the run. Setting that
expectation is cheaper than a run that shows a flat result.

## Failure-mode lists

A list of failure modes is not a list of flows:
- Flows are caller intents.
- Each failure mode becomes a named variant: the caller situation that gives
  the agent a chance to fail. Never script the failure itself; the checks
  decide whether it happened.
- Map results back one to one under the customer's own headings. Only true
  mappings go under each heading; label supplementary runs separately.

Ground new edge cases in real complaints about this kind of service. Keep only
premises the test account can support, or pure behaviour tests, and give every
brief a fallback for when the account does not have what the premise needs.

## Extract, section by section

| what to pull out | where it usually is | what you do with it |
| --- | --- | --- |
| Lines and what each is for | a "testing lines" table | One agent endpoint per line; record which parts use which line, and any backup line |
| Gates | notes on routing or an access code to enter first | A scripted opening shared by every flow on that line, or none |
| Parts, missions, steps, with their numbering | headings and tables | One row per step in the test matrix; keep the customer's numbering for citations |
| Expected behaviour | "Verify the agent...", "Agent should...", "must NOT" | Agent expectations, quoted as closely as possible |
| Caller actions | step lists and lines for the tester to say | The flow's steps or the improv brief |
| Test data and its state | data columns (account or order number, ZIP, address) | The flow's variables; note which record backs which step |
| Branches to test | "test both Yes and No", "A / B / C" | Separate scenarios, each with its own count |
| Priority | "High priority", "Quick-start" | Larger sample sizes for high-priority parts |
| Cross-cutting qualities | voice, pacing, latency, noise, interruptions | Report pillars and sweep scenarios, not single flows |

## Translate human-tester guidance

Instructions written for people need translating before they become simulations:

- **"Pick 2 to 3 missions per tester"** limits what one human can do. Run every
  mission, at a sample size that supports a rate.
- **"Feel free to introduce natural variations"** means variants: personas,
  phrasing, noise, pace, interruptions. Keep the core path identical so counts
  stay comparable.
- **Timing actions** ("pause 5 to 8 seconds", "read in groups with a pause")
  need scripted steps or explicit persona instructions, and a check in the
  recording that the pause actually happened.
- **Keypad entry and mixed voice-then-keypad input** need scripted keypad steps
  (see pitfalls).
- **Background noise and side conversations** map to environment and persona
  settings. Check our caller's audio really carried them.
- **"Set your outbound caller ID to X"**: we can only present numbers we own or
  have verified, never arbitrary ones. Ask the customer to map our numbers to
  their test profiles, or to confirm the feature builds history from live calls.
- **Negative tests** ("must NOT transfer") need a positive control in
  the same setup, or a pass proves nothing.
- **Deliberately wrong premises** (the caller insists on a figure the account
  does not show) may be intended as a test of how the agent handles a wrong
  claim. Ask before you "fix" the premise, then tell the judge what correct
  handling looks like.
- **A second person on the line** (a caller hands the phone to someone else)
  needs an unconditional trigger in the brief. It also needs a scenario that
  does not already involve another person.

## Flag problems before the first run

As you read, collect what you cannot do or cannot interpret. Raise these in one
message to the customer contact before the full run, not in the report:

- Steps that need capabilities the platform lacks (arbitrary caller IDs,
  SMS receipt, a human transfer target, calls spaced over days).
- Test data that looks inconsistent (one address given for two records, a
  number format that does not match the rest, data that only works on one of
  the lines).
- Ambiguous expectations ("verify routing": routed where?).
- Anything that depends on state the customer controls (pre-loaded history,
  existing cases or holds, time windows like "within two days").

Items still open after the answers go to the report's "Unable to test fully"
section, phrased as questions.

## Without a document

Discovery replaces it: map the agent's greeting, menus, intents, verification
steps and failure paths, then write your own matrix in the same shape and show
it to the user before running. Ask the user what "good" looks like for the
agent; never invent expectations the customer has not stated and then report
the agent for missing them.

## Keep the document in view

- Re-read the relevant part before writing each finding, so its "Brief" line
  cites the right step and the expected behaviour is not overstated.
- Behaviour the document never mentions can still be a finding, but say so
  ("Not a stated check. Found while testing Part 4.").
- When the document and the agent disagree and either could be right, it is a
  question for the customer, not a defect.
