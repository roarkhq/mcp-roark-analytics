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
most tests. The flow carries a _brief_ - a few sentences telling the simulated
customer what they want and what context they bring - and the simulator
improvises around it. Because the caller reacts rather than recites, it tests
what an agent does with a conversation rather than whether it survives a fixed
script.

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

### Environment

A variant's **environment** is where the caller is calling from: the sound around
them (`backgroundNoise` at `backgroundNoiseVolume`) and the phone line they are on
(`lineQuality`). Roark drops audio from the caller's 20 ms packets, per direction:
_toward the agent_ is what the agent hears, _toward the caller_ is what the caller
hears. Bursty loss clusters dropped packets into gaps, which is how real lines fail.

| `lineQuality`      | Applied                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `CLEAR`            | No loss. The default.                                                                           |
| `MINOR_LOSS`       | 1% lost at random, both ways.                                                                   |
| `CELL_EDGE`        | 5% lost in 80 ms gaps, both ways.                                                               |
| `POOR_CONNECTION`  | 10% lost in 120 ms gaps, both ways.                                                             |
| `ONE_WAY_DEGRADED` | 8% lost in 80 ms gaps toward the agent only; the caller hears the agent clearly.                |
| `CUSTOM`           | The numbers in `lineCustom`: per direction, up to 20% loss in gaps of 20 ms (random) to 200 ms. |

The loss pattern is seeded per call, so a redial loses the same packets. Line quality
only means something for an agent on the phone network: a web or WebSocket agent has
no phone line, and the setting is ignored there. Roark ships bad-line environments
(Cell edge, Car on Bluetooth, Spotty Wi-Fi call, Breaking up one way) beside the sound
ones; the silent default is called Quiet room.

Variants are where cost lives. Every variant a run plan selects is a real phone
call, so "add a few more variants" and "spend more on every future run" are the
same sentence.

## Caller cues

A brief can steer the caller mid-call with inline cue tokens. Each one takes
effect at the point in the brief where it sits, so the sentence around it says
when. In the app, type `#` in the brief to insert one; it shows as a chip.

| Token                      | What the caller does                                                                                                                                                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#{emotion:<emotion>}`     | Feels that from here on, and still moves around it reply by reply. One of the persona base emotions, lower case: `neutral`, `cheerful`, `confused`, `frustrated`, `skeptical`, `rushed`, `distracted`, `angry`, `anxious`, `sad`. |
| `#{language:<code>}`       | Speaks that language from here on. An ISO 639-1 code with an optional region: `es`, `pt-BR`.                                                                                                                                      |
| `#{noise:<environmentId>}` | Moves somewhere that sounds different: the background switches to that environment's noise mid-call, or to silence for a quiet one. Only the sound changes; the phone line stays the one the call started on.                     |
| `#{interrupt}`             | The sentence it is in becomes an instruction for when to cut in on the agent. The caller watches for that moment and cuts in when it comes, at any interruption level, including a persona whose interruption is off.             |

```text
You are calling to dispute a charge on your card. #{emotion:frustrated} You
have already called twice about it. When the agent reads back the card number,
#{interrupt} and say it's wrong. If they transfer you, #{noise:<environmentId>}
you have just stepped outside onto the street.
```

Caveats:

- An emotion is audible only on ElevenLabs v3 and v4 voices. On any other voice
  it changes the caller's wording, not how it sounds.
- Cues are voice only.
- The agent under test has to understand the language a cue switches into, or
  the call tests nothing past that point.
- A noise cue needs an environment to name: one of the project's own or a Roark
  environment. A cue naming an environment that has since been deleted is
  dropped. In config as code, a noise cue names the environment by its display
  name instead, `#{noise:Train}`, and apply stores the id.
- The opening line is said word for word, so cues in it are removed.

The call transcript and the live view mark each cue as it fires: "Emotion
changed to cheerful", "Language switched to Spanish", "Environment changed to
Train", "Interrupted the agent". Scripted flows take the same tokens in their
steps; see the scripted-flows concept.

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
