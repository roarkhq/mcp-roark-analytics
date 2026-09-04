# Persona fields

`client.simulationPersona.create(input)` / `.update(id, input)`. Every enum below
is a **closed set** - the exact accepted values are listed, so use them rather
than guessing or inferring from existing personas (a list only shows values in
use, not the accepted set).

Required (no default): `name`, `language`, `accent`, `gender`. Everything else has
a default. `update` is fully partial: omitted fields are left unchanged, and
defaults are **not** re-applied.

## Identity

- **`name`** - the name the caller identifies as in conversation.
- **`description`** - human-readable label (optional, nullable).
- **`backstoryPrompt`** - background and behavior the simulator plays. The single
  most useful field for realistic calls; write a sentence or two.
- **`properties`** - free-form key/value bag (e.g. `{ zipCode: '94105' }`).
  **Values are coerced to strings** server-side, so numbers and booleans come back
  as strings.

There is no `displayName` on the public API.

## Language

- **`language`** (required) - the primary spoken language. One of:
  `EN`, `ES`, `DE`, `HI`, `FR`, `NL`, `AR`, `EL`, `IT`, `ID`, `TH`, `JA`, `TL`,
  `MS`, `ZH`, `TR`, `PT`, `HE`.
- **`secondaryLanguage`** - for code-switching (Hinglish, Spanglish). The enum
  accepts **`EN` only**, so code-switching is always "the primary language plus
  English" - which also means it is invalid when `language` is already `EN`. Must
  differ from `language`.
- **`understoodLanguages`** - array (min 1) of the same language values: what the
  persona comprehends. Defaults to the language(s) it speaks. Some combinations
  are rejected by speech-recognition support (400).

## Voice casting

Voice is cast implicitly from `accent` + `age` + `gender`; there is no voice-id
field.

- **`accent`** (required) - one of: `US`, `US_X_SOUTH`, `GB`, `ES`, `DE`, `IN`,
  `FR`, `NL`, `SA`, `GR`, `AU`, `IT`, `ID`, `TH`, `JP`, `NZ`, `PH`, `SG`, `MY`,
  `HK`, `TR`, `PT`, `IL`.
- **`age`** - `CHILD` | `TEENAGER` | `ADULT` (default) | `ELDERLY`. Only ages the
  chosen accent has a voice for are accepted; `ADULT` is always available. A bad
  pairing returns 400 "Age is not available for the selected accent".
- **`gender`** (required) - `MALE` | `FEMALE`.
- **`backgroundNoise`** - `NONE` (default) | `AIRPORT` | `CHILDREN_PLAYING` |
  `CITY` | `COFFEE_SHOP` | `DRIVING` | `OFFICE` | `THUNDERSTORM`. A fixed set of
  ambient conditions, not a severity scale.

## Speech profile

- **`speechPace`** - `SUPER_SLOW` | `SLOW` | `NORMAL` (default) | `FAST` |
  `SUPER_FAST`.
- **`speechClarity`** - `CLEAR` (default) | `VAGUE` | `RAMBLING`.
- **`responseTiming`** - `RELAXED` | `NORMAL` (default) | `QUICK`; how fast the
  persona replies into pauses.
- **`hasDisfluencies`** - boolean, default `false`; filler words like "um", "uh".

## Behavioral profile

- **`baseEmotion`** - `NEUTRAL` (default) | `CHEERFUL` | `CONFUSED` |
  `FRUSTRATED` | `SKEPTICAL` | `RUSHED` | `DISTRACTED`.
- **`intentClarity`** - `CLEAR` (default) | `INDIRECT` | `VAGUE`; how plainly they
  state what they want.
- **`confirmationStyle`** - `EXPLICIT` (default) | `VAGUE`; how they confirm
  details.
- **`memoryReliability`** - `HIGH` (default) | `LOW`; how consistently they
  remember prior details in the call.

## Idle handling (what the persona does when the agent goes silent)

- **`idleMessages`** - array of strings, or `null`/omitted for "Automatic"
  (language-appropriate defaults at call time).
- **`idleTimeoutSeconds`** - 5-60, default 10.
- **`idleMessageMaxSpokenCount`** - 1-10, default 3.
- **`idleMessageResetCountOnUserSpeechEnabled`** - default `true`.

## Listing personas

```ts
const { data, pagination } = await client.simulationPersona.list({
  limit: 50,        // 1-50, default 20
  after,            // cursor: the last persona's id
  searchText,       // filters by name
})
```

Those three are the **only** query params: there is no folder, language, or
system filter, and sort is fixed to `createdAt` descending.

## System personas (a real trap)

- Roark's system persona library is returned in **every** project's `list`.
- **You cannot tell a system persona from a project one in the response** - there
  is no `source` / `isSystem` / `systemKey` field on the public payload.
- System personas **cannot be edited**. A `update` against one fails (and
  currently surfaces as a **500**, not a clean 400). If an update fails
  unexpectedly, suspect a system persona and create your own instead.
- Treat the library as read-only: to vary a system persona, create a new persona
  with the traits you want.

**Folders** (the product groups personas into `customer-service`, `healthcare`,
`sales`, `edge-cases`, `multilingual`) are **not addressable through the API** -
there is no `folderId` field and no folder endpoint. Do not promise folder
filtering; filter with `searchText` instead.

**There is no `simulationPersona.delete` in the SDK.** Do not offer to delete a
persona through it.

## Tip: fan one flow across many personas

To test a flow across accents or languages, create or pick one persona per
variation, then attach the flow once per persona with `personaOverrideId` in the
run plan (see `build-run-plan/references/flow-selection.md`). You do not need to
duplicate the flow.
