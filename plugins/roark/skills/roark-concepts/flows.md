---
name: "flows"
description: "Customer flows - the conversation a simulated caller has with the agent under test, in improv or scripted form, and the variants and expectations hanging off it."
---

<!-- Synced from https://github.com/roarkhq/app-roark-analytics/tree/main/src/packages/roark-concepts. Do not edit here: edits are overwritten by the next sync. -->

# Customer flows

A customer flow models **what happens on the call**. Paired with a persona (who
is calling), it is the unit a run plan selects to produce real calls.

## Two modes, and how to choose

`mode` is `UNSCRIPTED`, `SCRIPTED`, or `VOICEMAIL`. The public customer API
renames both halves of this: the field is `type` and the improv value is
`IMPROV`, so an SDK payload reads `type: 'IMPROV'` where the internal model reads
`mode: 'UNSCRIPTED'`. `SCRIPTED` and `VOICEMAIL` are spelled the same on both.

**Improv (`UNSCRIPTED`, `IMPROV` over the API)** is the default and right for
most tests. The flow
carries a _brief_ - a few sentences telling the simulated customer what they want
and what context they bring - and the simulator improvises around it. Because the
caller reacts rather than recites, it tests what an agent does with a
conversation rather than whether it survives a fixed script.

**Scripted** replaces the brief with an exact step graph. Reach for it only when
the precise turns are under test: IVR and DTMF menus, verbatim compliance
scripts, fixed-order exchanges. See the scripted-flows concept for the rules.

**Voicemail** flows run but the ordinary create path refuses the mode; they
arrive through the voicemail system data.

Choosing badly is not neutral: scripting a behavioural conversation tests the
script instead of the agent, and goes stale the moment the agent's wording
changes.

## Variants

A flow is a family of conversations, not one. Each **variant** binds a persona
and an environment to a situation, and one variant is the default happy path.

Add variants for genuinely divergent situations: the frustrated repeat caller,
the wrong account, an edge case seen in real calls. A variant may change only its
persona and inherit the default's brief, which is how one flow gets tested across
languages or temperaments without restating the situation.

For scripted flows, variants are derived from the graph's paths rather than
authored.

Variants are where cost lives. Every variant a run plan selects is a real phone
call, so "add a few more variants" and "spend more on every future run" are the
same sentence.

## Expectations

**Agent expectations** are short, observable contracts the agent is graded
against: "Offers the standard retention path before processing the
cancellation." Each has to be independently gradeable from the transcript;
"handles the call well" is not an expectation.

They sit at the flow level for improv flows and are derived per path for scripted
ones. Replacing a flow's expectation set replaces the whole set: it is not a
merge.

## System and custom flows

`source` is `SYSTEM` (Roark-curated, global, no owning project) or `CUSTOM`
(project-authored). System flows back the run templates, which source them by
label rather than id. Some are hidden from the customer-flows listing while
remaining usable by templates and by direct reference.

## Editing rather than recreating

Flows are referenced by id from run plans and prior runs. Recreating one to
change a title or add a variant breaks that continuity and leaves the old one
behind; edit in place. Changing a flow does not alter runs that already happened,
because a run snapshots the flows it used when it starts.
