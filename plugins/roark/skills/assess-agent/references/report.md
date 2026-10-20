# The assessment report

Agree the format with the user first. If the customer has a results template,
follow it exactly. The shape below has worked with a demanding reviewer: it
leads with what went well and what didn't, and every claim links to the moment
that proves it.

## Structure

1. **Intro.** What was tested: the agent and its lines, the dates, the number
   of calls, and the runs. Add one line saying that each issue links to the
   calls that show it.
2. **What worked well.** Bold claims with brief evidence. Links are optional.
3. **Issues found.** Open with one lead-in line: "Ordered by how often each
   issue happened, most frequent first." Sort by rate, then by count.
4. **Smaller items.** Real but minor or one-off observations, a short paragraph
   each.
5. **Latency.** Follow latency-and-voice.md. It can also be one of the issues if
   it is a problem.
6. **Voice.** Listener-confirmed examples only.
7. **Unable to test fully.** Questions for the customer, including test data
   notes.
8. **Runs.** Each run and what it covered. Do not explain why a run was
   repeated.

Next to the document, add a sheet with every affected call, one row each:
- line;
- issue;
- severity;
- call;
- time;
- quote;
- Roark link;
- audio link.

The document highlights examples, and the sheet holds the full set. Put audio
somewhere the customer can open without a Roark login, and keep the Roark link
beside it.

## One issue

```
3. The agent asks the proof of delivery question again after the caller answers

Prevalence: Medium, 3 of 24 calls where the agent asked "Did you receive this
package, or do you need proof of delivery?" (12%).
Line: Primary.
Brief: Part 2, delivered shipment.

<What the instructions expect, citing the part. What the agent did, in its exact
words. Why it matters to the caller. How often it got this right.>

- The caller said they had everything they needed. The agent said "Sorry. I
  didn't catch that" and asked again.
  - Roark link: 1:42 (call 1a2b3c4d, Primary line)
  - Full audio: full call (turn at 1:42)
  - Flagged audio: clip
```

- **Title:** a plain statement of the behaviour, in the order it happens in the
  call, with no judgement words.
- **Prevalence:** the label, numerator of denominator with the denominator
  defined, then the percentage. If the format allows colour, make High red.
- **Line:** which number or entry point. Include it when the agent has more than
  one.
- **Brief:** the part, mission or step this falls under. If the customer never
  asked about it, write "Not a stated check. Found while testing Part 4."
- **Examples:**
  - Each one is a short story: what the caller wanted, what the agent did, and
    quotes only where the exact words matter.
  - One call per bullet, ordered most severe first.
  - Each example has a link that opens the call inside its run at the failing
    moment.
  - Every linked example must show the failure. Passes are not linked under an
    issue.
- **Pagination:** keep each issue on one page when the format paginates. Use
  keep-with-next settings, not manual breaks.

## Unable to test fully

- Prefix each item with where it sits in the instructions ("Mission 2: ", "Part
  4: ").
- Phrase every item the same way: "Could you confirm whether case creation is
  expected to go through at this stage?"
- Test data notes go here too. Lead each with the step it affects, and say what
  the record did.
- Before listing anything here as untestable, try to test it. Several items
  moved into Issues once a targeted test was run.

## Verify before anything is shared

Readers click links during live reviews. One wrong link or quote undermines the
whole report. For every link:
- the run exists and the call belongs to that run;
- the timestamp opens a few seconds before the moment;
- the quoted words match the transcript at that time, within about a second;
- any number in the text matches what the call page shows. For example, a
  latency figure must equal the silence the page displays.

Then:
- **Re-download the delivered document** and re-check the links, quotes and
  times. Normalise the non-breaking spaces that document tools insert before you
  compare.
- **Keep one current file per artifact.** Delete superseded copies.
- **Re-check after any human edit.** Spreadsheet apps silently reformat cells:
  "01:31" becomes a number, "9800." becomes 9800.
- **Watch for internal notes and stale names.** Clip names, tag wording and
  numbering gaps can expose dropped items.

Roark links do not switch project, so a reader with another project selected
sees "not found". Say which project to select.

## Wording rules

- **Write plainly.** Use short sentences and no em dashes. Avoid robotic
  example lines.
- **Quote exactly** what the agent said. Never paraphrase it into a stronger
  claim.
- **Measure what you report.** Say what was measured, not a diagnosis ("a few
  short lines drop about an octave and snap back", not "the voice sounds
  tired"). Reconcile with the customer's own description rather than
  contradicting it.
- **Be fair.** Say when the agent got it right, and how often.
- **Use no internal vocabulary.** Leave out vendor or engine names, and the
  words "judge", "false positive", "metric", "variant", "harness" and "pinned".
  Do not speculate about the agent's implementation.
- **Don't expose our process.** Never mention our own bugs, fixes, re-runs,
  excluded calls or detector notes. Describe exclusions neutrally in a method
  line, and treat updated runs simply as the runs.
- **Use round, explainable numbers**, and match the count to the wording: "over
  6 s" and "6 s or more" are different counts.
- **Refer to the agent by its owner,** for example "Acme's agent". This matters
  when the reader evaluates it but does not own it.

## Delivery and revisions

- **Keep drafts private.** Don't put a draft in a folder the customer can see
  until the user says it is ready.
- **Make the cover note short:** the link, a one-line status, and anything still
  in progress or not covered, so they do not assume it is coming. If you used
  different identifiers or numbers than were agreed, name them and say why.
- **Name clips by topic,** not by issue number, so reordering never mislabels
  them. Moving or renaming files in most drives keeps their links.
- **Preserve the user's edits.** Before regenerating anything, diff the live
  document against your source and carry their edits over word for word.
- **Once the customer has access, edit in place only.** Do not regenerate or
  re-paste: they would see it happen and lose their comments. Read their
  comments first.
- **Keep the ledger in sync.** When a finding is dropped or reworded, update the
  ledger so the next revision does not bring it back.
- **Keep an internal companion.** Quote the customer's request item by item,
  then record the run covering each item, the result, what was excluded and
  why, what is untested, and anything left on their test accounts.
