# Config-as-code resource kinds

Every resource is one object in `bundle.resources` with a `kind` and a `name`
(the identity: `configKey = <kind>/<name>`). Cross-references are by name. Field
shapes below are the essentials; confirm the full set with docs search or the
Roark config DSL docs, and prefer omitting optional behavioral fields (they
default to complete, sensible values).

Every `name` must match `/^[a-z0-9][a-z0-9-_.]*$/` - lowercase, starting
alphanumeric. `Frontdesk` and `front desk` are both invalid.

## agent

Agents declare their **endpoints** here; this is the only way config-as-code
creates the phone endpoints simulations target.

```ts
{ kind: 'agent', name: 'frontdesk', description: 'Inbound reception line',
  customId: 'crm-42',
  endpoints: [
    { name: 'main-line', value: '+15551234567',
      direction: 'INCOMING', // INCOMING | OUTGOING | INCOMING_AND_OUTGOING
      environment: 'production' },
  ] }
```

## persona

Required: `name`, `language`, `accent`, `gender`. Everything else (speech and
behavioral knobs, `displayName`, idle handling) defaults just like the imperative
create (see `author-personas-flows/references/personas.md`).

```ts
{ kind: 'persona', name: 'frustrated-caller', language: 'EN', accent: 'US', gender: 'FEMALE',
  backstoryPrompt: 'Has been on hold twice already and wants a refund' }
```

## flow (improv)

References agents, personas, and environments **by name**. `agents` (min 1) and
`happyPath` are both **required**, and the happy path's `persona` and `environment`
are required within it.

```ts
{
  kind: 'flow', type: 'improv', name: 'frustrated-rebooking',
  title: 'Frustrated rebooking',
  agents: ['frontdesk'],                 // required, at least one
  expectations: ['confirms the new time'],
  happyPath: {                           // required
    persona: 'frustrated-caller',         // required
    environment: 'quiet-office',          // required, must already exist
    title: 'Standard rebooking',
    prompt: 'Caller wants to move an existing booking',
  },
  edgeCases: [
    { name: 'wrong-number', prompt: 'Caller has the wrong business',
      persona: 'confused-caller' },       // omit to inherit the happy path's
  ],
}
```

## flow (scripted)

Sends a **`graph`** (required, min 1 step) instead of a happy path and edge cases;
`agents` is **optional** here (the opposite of improv).

```ts
{
  kind: 'flow', type: 'scripted', name: 'billing-ivr',
  branchingMode: 'DETERMINISTIC',        // or ADAPTIVE
  graph: [
    { type: 'CUSTOMER_FIRST_MESSAGE', content: 'Hi' },
    { type: 'AGENT_TURN', content: 'Press 1 for billing.',
      steps: [{ type: 'CUSTOMER_DTMF', dtmfDigits: '1', ref: 'after-1' }] },
  ],
}
```

Step `type` is one of `AGENT_TURN`, `CUSTOMER_TURN`, `CUSTOMER_FIRST_MESSAGE`,
`CUSTOMER_SILENCE`, `CUSTOMER_DTMF`, `VOICEMAIL`, `SCENARIO_LINK`, carrying
`content`, `silenceDurationSeconds`, `dtmfDigits`, or `flow` as appropriate. Steps
nest via `steps` (more than one = a branch) and rejoin via `mergeInto` naming a
`ref`. There are **no UUIDs** in config: each apply replaces the whole graph. Roles
must alternate agent <-> customer along every edge. See `author-scripted-flows` for
the semantics, which are the same as the imperative graph.

## metric (custom, LLM-judged only)

Only `LLM_JUDGE` metrics are authored in config. Derived metrics
(threshold/formula/pattern) reference other metrics by id and are out of scope
here; author those with `configure-metrics`. System metrics are never defined
here, only referenced by slug in a collector.

```ts
{ kind: 'metric', name: 'refund-policy-accuracy', // == the slug, immutable
  displayName: 'Refund policy accuracy',
  type: 'BOOLEAN',                  // BOOLEAN | SCALE | NUMERIC | TEXT | CLASSIFICATION
  prompt: 'Did the agent state the 30-day refund window correctly? {{transcript}}',
  scope: 'GLOBAL',                  // or PER_PARTICIPANT (+ participantRole)
  contexts: ['CALL'] }              // CALL | SEGMENT | TURN, default ['CALL']
```

- `prompt` is **required** and should reference the `{{transcript}}` and
  `{{world_context}}` template variables.
- `scope: 'PER_PARTICIPANT'` requires `participantRole` (`AGENT` | `CUSTOMER`).
- `SCALE` **requires** both `scaleMin` and `scaleMax` (optional `scaleLabels` bands);
  `CLASSIFICATION` **requires** `options` (optional `maxSelections`). These are not
  optional extras.
- `name` (the slug), `type`, and `scope` are immutable: changing one fails the apply.
- `contexts` here is `CALL | SEGMENT | TURN` - do not confuse it with the
  `CALL | SEGMENT | SEGMENT_RANGE` enum on collected metric *values*.

## collector (live-call metric policy)

Which metrics get collected on real calls/chats, and on which conversations.

- **`modality`** (`'call'` | `'chat'`) - required and **immutable** (changing it is
  rejected up front; make a new collector). The field is `modality`, **not**
  `conversationType`.
- `status` - `ACTIVE` (default) | `INACTIVE`. Use `INACTIVE` to park a collector.
- `metrics` - at least one metric **slug**. System and custom slugs both allowed,
  but every metric must support this collector's `modality` (a `chat` collector
  cannot reference a call-only metric).
- `filters` - optional; omit to match every conversation. A filter is an OR of
  groups; conditions within a group are AND. Each condition's discriminator field
  is **`type`**, **not** `target`: `AGENT` (a config-managed agent name),
  `CALL_SOURCE` (e.g. `VAPI`), `CALL_PROPERTY` (needs `operator` + `value`), or
  `INTEGRATION` (integration id). Operators: `EQUALS`, `NOT_EQUALS`, `CONTAINS`,
  `STARTS_WITH`, `GREATER_THAN`, `LESS_THAN`, `GREATER_THAN_OR_EQUALS`,
  `LESS_THAN_OR_EQUALS`.

```ts
{ kind: 'collector', name: 'quality-on-frontdesk', modality: 'call', status: 'ACTIVE',
  metrics: ['call_outcome', 'sentiment_score', 'refund-policy-accuracy'],
  filters: [{ conditions: [{ type: 'AGENT', key: 'frontdesk' }] }] }
```

Because chat conversations cannot be simulated, a `modality: 'chat'` collector is
the only way to grade chat.
