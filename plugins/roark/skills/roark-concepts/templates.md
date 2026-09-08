---
name: "templates"
description: "Run templates - curated blueprints that map a testing goal onto a ready bundle of metrics, pass/fail checks and flows."
---

<!-- Synced from https://github.com/roarkhq/app-roark-analytics/tree/main/src/packages/roark-concepts. Do not edit here: edits are overwritten by the next sync. -->

# Run templates

A run template maps a _testing goal_ ("is the agent safe under adversarial
pressure", "does it detect voicemail") onto a ready bundle of metrics, pass/fail
checks and flows. A plan seeded from one records which template it came from.

Templates are the highest-leverage thing to know about, because the hard part of
building a run plan is not assembling it: it is knowing which metrics and flows
answer the question being asked. A template is that judgment, already made.

## What a template carries

- **Preset metrics**: the measurements attached to the plan up front.
- **Preset thresholds**: the pass/fail checks over those metrics, which turn a
  run into a green or red result rather than a table of numbers.
- **Flow labels**: templates source flows by label rather than id, so a template
  picks up matching flows without naming them.
- Whether flow-owned metrics come along, and whether the happy path is included.

The blank template is the deliberate absence of all of this: start empty and
choose everything.

## Choosing one

Templates are grouped into categories - Benchmark, Quality, Safety, Voice and
telephony, Performance - which is usually enough to narrow the choice, with the
project's own saved templates alongside them.

Match the template to the question being asked rather than the agent being
tested. The same agent belongs under the benchmark template when the question is
"how good is it", the safety template when it is "can it be pushed off policy",
and the performance template when it is "does it hold up under load".

**The catalogue itself is generated** from the system data, because a hand-copied
list goes stale: the published skills package still describes eleven templates,
and there have been twelve since call screening shipped. Read the generated
catalogue for the current set, their slugs, and what each measures.

## Cost

A template chooses flows and metrics, not volume. Variant selection and iteration
count decide how many calls a run places, and those are the plan's to set. A
benchmark template on a flow with a dozen variants is a dozen calls per persona
per iteration, exactly as it would be without the template.
