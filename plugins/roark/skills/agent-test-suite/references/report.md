# The suite report

The deliverable lives in the product: the **run group** that holds the suite's
runs, and the report Roark writes for it. Link the reader there. Never write a
separate document, spreadsheet or slide deck, never upload recordings or clips
to a drive, and never offer an export. If the reader needs a file, they can use
**Download PDF** on the group page, which emails them a download link.

Your job in this phase is to make that report right: the runs in the group are
the ones that count, the metrics behind it are the ones that measure the brief,
and every claim it makes holds up against the calls.

## Build it

1. **Group the runs that count** (SKILL.md step 5): the latest valid run per
   scenario, 2 to 20 runs, by `simulationRunPlanJobIds`.
2. **Generate the report** with `simulationRunGroup.regenerateReport`, and poll
   `simulationRunGroup.getByID` until it is written. Regenerate after any change
   to the group's runs or after a collection job adds metric values, so the
   report never cites a superseded run.
3. **Share the link**: `https://platform.roark.ai/simulations/groups/{groupId}`.
   Roark links do not switch project, so a reader with another project selected
   sees "not found". Say which project to select, and check the reader has
   access to it.

## What a good report contains

Read the generated report against this standard:

- **What went well**, with brief evidence.
- **Issues**, ordered by how often each happened, most frequent first. Each
  issue has:
  - a title that plainly states the behaviour, in the order it happens in the
    call, with no judgement words;
  - prevalence: the count over the calls where the situation arose, with that
    denominator defined, then the percentage;
  - which line or entry point, when the agent has more than one;
  - which part, mission or step of the owner's brief it falls under, or that
    it was not a stated check;
  - examples, one call each, most severe first, each linking to the failing
    moment in the call. Every linked example shows the failure.
- **Smaller items**: real but minor or one-off observations.
- **Latency and voice**, from their metrics (latency-and-voice.md).
- **Recommendations** tied to the issues.

## Check every claim against the calls

Readers click every link during live reviews. One wrong link or quote
undermines the whole report. For each issue and example:

- the call belongs to a run in the group, and the link opens a few seconds
  before the moment;
- the quoted words match the transcript at that time;
- every number matches what the call page shows;
- the issue survives triage (triage.md): not the simulated caller, not the
  transcription, not the test data, not correct behaviour.

Then compare the report with your triage ledger, in both directions:

- **An issue the report states that triage rejected.** Fix the cause where it
  lives: create a new group without the run that should not be in it (groups
  cannot be edited; delete the old one), re-score with a corrected metric, or
  drop a misfiring check from the plan. Then regenerate.
- **A verified finding the report misses.** Make sure a metric measures it
  (create one if needed), collect it over the suite's calls, and regenerate.
- **What you cannot fix that way** (wording, ordering, a claim the report gets
  wrong even with correct inputs) goes to the user as a list, with the call and
  the reason for each item. Do not route around it with a document of your own.
  These are gaps in the product report, and the user decides how to handle
  them.

## Questions for the agent's owner

Keep the "unable to test fully" items as a short list in your message to the
user, not in a file:
- Prefix each item with where it sits in the instructions ("Mission 2: ", "Part
  4: ").
- Phrase each the same way: "Could you confirm whether case creation is
  expected to go through at this stage?"
- Test data notes go here too. Lead each with the step it affects, and say what
  the record did.
- Before listing anything as untestable, try to test it. Several items moved
  into issues once a targeted test was run.

## Wording rules

These apply to everything you write for the agent's owner, including the cover
note and the questions:

- **Write plainly.** Use short sentences and no em dashes.
- **Quote exactly** what the agent said. Never paraphrase it into a stronger
  claim.
- **Measure what you report.** Say what was measured, not a diagnosis. Reconcile
  with the owner's own description rather than contradicting it.
- **Be fair.** Say when the agent got it right, and how often.
- **Use no internal vocabulary.** Leave out vendor or engine names, and the
  words "judge", "false positive", "variant", "harness" and metric slugs. Do not
  speculate about the agent's implementation.
- **Leave out the test process.** Problems on the test side, fixes to flows and
  re-runs stay out of everything you write. Updated runs are simply the runs.
- **Refer to the agent by its owner,** for example "Acme's agent".

## Delivery and revisions

- **Keep it private** until the user says it is ready. The user reviews the
  group report first, and their judgement on what is fair to the agent wins.
- **The cover note is short:** the group link, which project to select, a
  one-line status, the open questions, and anything still running or not
  covered, so the reader does not assume it is coming. If you used different
  identifiers or numbers than were agreed, name them and say why.
- **After sharing,** revise through the product: a new group with the right
  runs, corrected metrics or re-scores, then regenerate. Tell the user before
  regenerating a report the agent's owner has already read, since its wording
  will change.
- **Keep the ledger in sync.** When a finding is dropped, record why, so the
  next revision does not bring it back.
