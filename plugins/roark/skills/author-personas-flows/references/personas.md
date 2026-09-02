# Persona fields

`client.simulationPersona.create(input)` / `.update(id, input)`. Enum values are
fixed sets; if a value is rejected, list an existing persona to see accepted
values or use docs search. Required (no default): `name`, `language`, `accent`,
`gender`.

## Identity

- **`name`** - the name the caller identifies as in conversation.
- **`description`** - human-readable label (optional).
- **`backstoryPrompt`** - background and behavior the simulator plays. The single
  most useful field for realistic calls; write a sentence or two.
- **`properties`** - free-form key/value bag (e.g. `{ zipCode: '94105' }`).

## Language

- **`language`** - primary, ISO 639-1 (e.g. `EN`, `ES`, `DE`, `HI`, `FR`, `JA`).
- **`secondaryLanguage`** - for code-switching (Hinglish, Spanglish). Must differ
  from `language`.
- **`understoodLanguages`** - languages the persona comprehends. Defaults to the
  spoken language(s). Multilingual combinations are limited by speech-recognition
  support.

## Voice casting

- **`accent`** - ISO 3166-1 alpha-2 accent code, optionally with a variant.
- **`age`** - default `ADULT`. Only ages the chosen accent has a voice for are
  accepted; `ADULT` is always available.
- **`gender`** - `MALE` or `FEMALE`.
- **`backgroundNoise`** - default `NONE`. Adds ambient conditions (up to noisy
  environments) to test robustness.

## Speech profile

- **`speechPace`** - default `NORMAL`.
- **`speechClarity`** - default `CLEAR`.
- **`responseTiming`** - `QUICK` | `NORMAL` (default) | `RELAXED`; how fast the
  persona replies into pauses.
- **`hasDisfluencies`** - default `false`; filler words like "um", "uh".

## Behavioral profile

- **`baseEmotion`** - default `NEUTRAL`.
- **`intentClarity`** - default `CLEAR`; how plainly they state what they want.
- **`confirmationStyle`** - default `EXPLICIT`; how they confirm details.
- **`memoryReliability`** - default `HIGH`; how consistently they remember prior
  details in the call.

## Idle handling (what the persona does when the agent goes silent)

- **`idleMessages`** - array, or `null`/omitted for "Automatic"
  (language-appropriate defaults at call time).
- **`idleTimeoutSeconds`** - 5-60, default 10.
- **`idleMessageMaxSpokenCount`** - 1-10, default 3.
- **`idleMessageResetCountOnUserSpeechEnabled`** - default `true`.

## Tip: fan one flow across many personas

To test a flow across accents or languages, create or pick one persona per
variation, then attach the flow once per persona with `personaOverrideId` in the
run plan (see `build-run-plan/references/flow-selection.md`). You do not need to
duplicate the flow.
