---
name: "personas"
description: "Who is calling - the reusable identity, voice and temperament of a simulated caller, and how it differs from the brief describing a single call."
---

<!-- Synced from https://github.com/roarkhq/app-roark-analytics/tree/main/src/packages/roark-concepts. Do not edit here: edits are overwritten by the next sync. -->

# Personas

A persona is **who is calling**: a reusable identity with a voice, a way of
speaking, and a temperament. It is its own object, bound to a flow variant or a
run plan rather than owned by either, so one persona is reused across many
conversations and edited in one place.

## Persona vs brief

Modelled wrong more often than anything else here, and it fails quietly: the run
succeeds, the transcript looks plausible, and the trait you asked for is absent.

- The **persona** is who the caller _is_: language, accent, voice, pace, baseline
  mood, how reliably they remember what they were told.
- The **brief** is what is happening on _this_ call: what the caller wants, the
  context they bring, how they react when refused.

Anything about the caller themselves has to be set on the persona. Writing
"speaks Italian", "is angry", "talks fast" or "is calling from a noisy cafe" into
a brief changes nothing: language, voice, pace, emotion and background noise are
read from the persona and from nowhere else. A brief is read as situation, never
as identity.

The persona's `backstoryPrompt` is a standing biography ("a customer for six
years, has called twice this month"), not this call's situation. If a detail
would still be true next month it belongs on the persona; if it is only true for
this conversation it belongs in the brief.

## What a persona carries

Grouped by what they control. Enum values live in the schema listed in
`sources`; read it rather than recalling values.

**Language.** `language` is what the caller speaks. `secondaryLanguage` models
code-switching mid-call and is restricted to English. `understoodLanguages` is
what they comprehend without speaking, which is what makes a caller who
understands an English prompt but answers in their own language possible.

**Voice.** `accent`, `age`, `gender`. Not independent: `age` is constrained by
`accent`, because only ages that accent has a real voice for can be offered.
Resolve in order - language, then a fitting accent, then an age it supports.

**Speech profile.** `speechPace`, `speechClarity`, `responseTiming`, and
`disfluencies` (`hasDisfluencies` over the public API; whether the caller says
"um" and "uh"). How the caller sounds, and the group that most directly stresses
transcription and turn-taking.

**Behavioural profile.** `baseEmotion`, `intentClarity`, `confirmationStyle`,
`memoryReliability`. How the caller _acts_: standing mood, how plainly they
state what they want, whether they read details back, whether they remember what
they were told earlier.

**Environment.** `backgroundNoise` places the caller somewhere real: a street, an
office, a car.

**Idle handling.** What the caller does when the agent goes quiet: `idleMessages`
(null means automatic, resolving to a per-language default),
`idleTimeoutSeconds`, `idleMessageMaxSpokenCount`, and
`idleMessageResetCountOnUserSpeechEnabled`. Leave the defaults alone unless
testing silence handling is the point.

**Free-form.** `properties` is key/value pairs for anything the schema does not
model.

## System and custom personas

`source` is `SYSTEM` or `CUSTOM`. A seeded roster ships with the product,
covering one native and one English code-switching speaker per supported
language plus a set of archetypes, so most tests need no new persona. Prefer
reuse, especially for language: a seeded language persona is already paired with
an accent that has voices.

Personas group into **folders**, not by a category field: Customer Service,
Healthcare, Sales, Edge Cases, Multilingual. The legacy `category` column still
exists in Postgres but is neither read nor written and a follow-up migration
drops it, so anything grouping by `category` is reading a dead field.

## What a persona is not

Not the scenario, not the expectations the agent is graded against, not the
metrics. It carries no per-call state.

Personas are bound by reference, so editing one changes every future run that
binds it. A trait tweak wanted for a single test is better made as a new persona
than as an edit to a seeded one.
