---
name: author-personas-flows
description: >-
  Use when you need to create the simulated caller (a persona) or a natural,
  improvised test conversation (an IMPROV customer flow with a happy path and
  edge cases) in Roark: pick a system persona or create a custom one, pick an
  environment, create the flow, and add agent expectations. For what to write
  for an industry, read the matching flows-* playbook first. Not for IVR menus,
  keypad entry, or exact scripts; that is author-scripted-flows.
---

# Write an improvised test conversation

A simulated call is a **persona** (who is calling) running a **customer flow**
(what the call is about). In an IMPROV flow the caller gets a short brief and
improvises, so the test checks how the agent handles a real conversation rather
than a fixed script.

**Pick the content first.** If the agent matches a `flows-*` playbook (support,
healthcare, dealership, home services, finance, car insurance, debt collection),
read it first: it says which personas, flows, and edge cases to write. This skill
is how to create those objects in the API.

## Use this when

- A run needs a persona or a flow that does not exist yet.
- Someone asks you to design test conversations, add an edge case, or change
  what a flow's caller says.

## Use a different skill when

- The call must follow an exact path: IVR menu, keypad (DTMF) digits, silence,
  voicemail, verbatim script. Use `author-scripted-flows`.
- You do not know what to test yet: a `flows-*` playbook, or
  `simulate-quickstart` if no playbook fits.
- The persona and flow exist and you want to run them: `build-run-plan`.
- You want personas and flows declared in a repo: `manage-config-as-code`.

## You will have

A persona id (or a set of them), an environment id, and an IMPROV flow id with a
happy path, a few edge cases, and agent expectations, ready to attach in
`build-run-plan`.

**Read first:** `../roark-concepts/personas.md` and `../roark-concepts/flows.md`.
The rule that silently ruins a test: language, accent, voice, pace, mood, and
background noise are read from the **persona** and nowhere else. Writing "is
angry" or "speaks Spanish" into a brief in plain words changes nothing. The
brief is only the situation. The one way a brief moves the caller is a caller
cue token (`#{emotion:angry}`, `#{language:es}`), and that is a change from a
point in the call onward, not who the caller is; see step 4.

## 1. Pick or create personas

Roark ships a system persona library. Reuse it first. The list returns every
trait, so pick by fields, not by name:

```ts
let after, personas = []
do {
  const page = await client.simulationPersona.list({ limit: 50, after })
  personas.push(...page.data)
  after = page.pagination.nextCursor
} while (after)

const calm = personas.find((p) => p.language === 'EN' && p.baseEmotion === 'NEUTRAL')
const frustrated = personas.find((p) => p.language === 'EN' && p.baseEmotion === 'FRUSTRATED')
```

Create a custom persona only when nothing fits. Required: `name`, `language`,
`accent`, `gender`. Everything else defaults:

```ts
const { data: maria } = await client.simulationPersona.create({
  name: 'Maria',
  language: 'ES', // primary spoken language
  accent: 'ES', // must be a value from references/personas.md
  gender: 'FEMALE',
  baseEmotion: 'RUSHED',
  backstoryPrompt: 'A busy parent who has been a customer for six years', // standing biography
})
```

Every accepted value (languages, accents, ages, speech and behavioral profile,
background noise, idle handling) is in
[references/personas.md](references/personas.md). Things that bite:

- System personas cannot be edited (an update currently fails with a 500). To
  vary one, create a new persona.
- There is no `simulationPersona.delete`.
- Persona folders exist in the product but are not filterable over the API.

## 2. Pick an environment

The happy path needs an `environmentId`. Environments are listed, not created
here; their main setting is `backgroundNoise` (`NONE`, `AIRPORT`,
`CHILDREN_PLAYING`, `CITY`, `COFFEE_SHOP`, `DRIVING`, `OFFICE`, `THUNDERSTORM`):

```ts
const { data: envs } = await client.simulationEnvironment.list()
const quiet = envs.find((e) => e.backgroundNoise === 'NONE')
const street = envs.find((e) => e.backgroundNoise === 'CITY')
```

## 3. Create the IMPROV flow

Reuse before creating: `client.customerFlow.list({ searchText: 'Reschedule' })`.
Recreating a flow breaks its link to past runs; edit in place instead.

The happy path **requires** `personaOverrideId` and `environmentId`. Edge cases
inherit both unless they name their own. `agentIds` needs at least one agent.

```ts
const { data: flow } = await client.customerFlow.create({
  type: 'IMPROV',
  title: 'Reschedule an appointment',
  agentIds: [agentId],
  happyPath: {
    title: 'Standard reschedule',
    prompt:
      'You have a dental cleaning this Thursday at 3pm under the name Alex Rivera. ' +
      'You need to move it to any morning next week.',
    personaOverrideId: calm.id,
    environmentId: quiet.id,
  },
  edgeCases: [
    {
      title: 'Second call about the same booking',
      prompt: 'You moved this appointment yesterday and the confirmation text still shows Thursday.',
      personaOverrideId: frustrated.id, // the mood lives on the persona
    },
    {
      title: 'Calling from the street',
      prompt: 'Same reschedule request as the standard call.',
      environmentId: street.id, // the noise lives on the environment
    },
  ],
})
```

Keep edge cases few and different from each other. Every edge case a run selects
is a separate billable call.

## 4. Move the caller mid-call with caller cues

A brief (`happyPath.prompt` or an edge case `prompt`) can carry inline tokens
that change the simulated caller from a point in the call onward. In the app
they are typed with `#` in the brief editor; over the API they are plain text.

| token | the caller, from that point on |
| --- | --- |
| `#{emotion:<emotion>}` | feels it. A persona base emotion, lower case: `neutral`, `cheerful`, `confused`, `frustrated`, `skeptical`, `rushed`, `distracted`, `angry`, `anxious`, `sad` |
| `#{language:<code>}` | speaks that language: ISO 639-1 with an optional region (`es`, `pt-BR`). The agent has to understand it |
| `#{noise:<environment id>}` | moves somewhere that sounds different: an environment's id from `client.simulationEnvironment.list()` |
| `#{interrupt}` | cuts in on the agent. The sentence holding the token is the instruction for when, and what to say |

The persona's `baseEmotion` is where the call starts; an emotion cue moves it
from there. Write the condition around each token, and place the token where
its meaning reads as part of the sentence, because a brief is one prompt and
each token is replaced by words ("from here on you feel angry", "cut in"):

```ts
await client.customerFlow.updateHappyPath(flow.id, {
  prompt:
    'You were charged twice for last week\'s cleaning and want one charge refunded. ' +
    'When the agent asks for the card, read out 4111 1111 1111 1111. ' +
    'When the agent reads the card number back, #{interrupt} and say that is the card. ' +
    'If the agent says the refund takes more than a week, #{emotion:angry}. ' +
    `Once the refund is agreed, #{noise:${street.id}} and say you have to go.`,
})
```

- **Voice only.** Improv flows do not run as chat simulations.
- **Emotion is audible only on ElevenLabs v3 and v4 voices.** On any other voice
  the cue changes what the caller says, not how it sounds.
- **The model picks the moment**, from the condition you wrote, so the exact
  turn can differ between calls. When it must happen at one step, use a
  `STRICT` scripted flow (`author-scripted-flows`).
- An edge case with its own brief takes its interrupts from that brief only.
- A call switches between at most eight languages, the starting one included.
  A noise cue whose environment was deleted is dropped.
- Fired cues show in the call transcript: "Emotion changed to angry",
  "Language switched to Spanish", "Environment changed to Street", "Interrupted
  the agent".

## 5. Add agent expectations

Expectations are short, observable things the agent must do, graded from the
transcript. Flow-level ones apply to every variant; replacing them replaces the
whole set:

```ts
await client.customerFlow.update(flow.id, {
  agentExpectations: [
    { prompt: 'Confirms the caller name before changing the booking' },
    { prompt: 'Reads back the new date and time' },
  ],
})
```

Add an edge case with its own extra expectation:

```ts
await client.customerFlowEdgeCase.add(flow.id, {
  title: 'Wants the same day',
  prompt: 'You ask to move the appointment to later today.',
  additionalExpectations: [{ prompt: 'Offers the nearest available slot instead of refusing outright' }],
})
```

Expectations are graded by the `agent_expectations` metric. A flow that carries
them still needs `agent_expectations_check` (or `agent_expectations`) attached
in the run plan, or they are never scored.

## Editing later

`customerFlow.updateHappyPath`, the `customerFlowEdgeCase` add / update / remove /
promote calls, and `customerFlow.update` for title, agents, and expectations.
Shapes are in [references/flows.md](references/flows.md).

**MCP note:** the plugin's `create_persona` and `create_customer_flow` tools take
the same fields as steps 1 and 3. `create_customer_flow` does not set
expectations; add those with `customerFlow.update` on the local code-execution
server, or rely on metrics that do not need them.

## Next

- `build-run-plan` to attach the flow (`happyPath: true`, `edgeCases: 'ALL'`) and
  preview the call count.
- `configure-metrics` for the checks that grade it.
- `author-scripted-flows` if part of the call needs an exact path.
