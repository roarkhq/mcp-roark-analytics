# Config-as-code resource kinds

Every resource is one object in `bundle.resources` with a `kind` and a `name`
(the identity: `configKey = <kind>/<name>`). Cross-references are by name. Field
shapes below are the essentials; confirm the full set with docs search or the
Roark config DSL docs, and prefer omitting optional behavioral fields (they
default to complete, sensible values).

## agent

```ts
{ kind: 'agent', name: 'frontdesk', description: 'Inbound reception line' }
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

References agents and personas by name.

```ts
{
  kind: 'flow', type: 'improv', name: 'frustrated-rebooking',
  agents: ['frontdesk'],
  // happy path requires a persona + environment
  // edge cases each have a local name + their own persona/prompt
}
```

## flow (scripted)

A conversation graph. Nodes are labelled with `ref`; a node's `steps` are its
successors (more than one = a branch), and `mergeInto` names refs this node
rejoins (DAG merge edges). No UUIDs; each apply replaces the whole graph. Roles
must alternate agent <-> customer along every edge. Because the graph is easy to
get wrong, build it with docs search open and re-diff to confirm.

## metric (custom, LLM-judged only)

Only `LLM_JUDGE` metrics are authored in config. Derived metrics
(threshold/formula/pattern) reference other metrics by id and are out of scope
here; author those with `configure-metrics`. System metrics are never defined
here, only referenced by slug in a collector.

```ts
{ kind: 'metric', name: 'refund-policy-accuracy', type: 'BOOLEAN',
  prompt: 'Did the agent state the 30-day refund window correctly?' }
```

SCALE metrics carry labelled bands; CLASSIFICATION metrics carry options. Match
the type to the question, same as the imperative metric create.

### The field names differ from `client.metric.createDefinition`

This is deliberate, not a typo: the config bundle uses shorter names because a
config metric is always an LLM judge, so it has no `calculationType` to
disambiguate. Sending the imperative names to `config.apply` fails validation, and
vice versa. Translate:

| config bundle    | `client.metric.createDefinition` | note                                     |
| ---------------- | -------------------------------- | ---------------------------------------- |
| `name`           | `slug` / `metricId`              | config's identity IS the slug; imperative derives the slug from `name` |
| `displayName`    | `name`                           | the human-facing label in the product     |
| `type`           | `outputType`                     | same values                               |
| `prompt`         | `llmPrompt`                      | same 2000-char cap                        |
| `contexts`       | `supportedContexts`              | same values                               |
| `options`        | `classificationOptions`          | CLASSIFICATION only                       |
| `maxSelections`  | `maxClassifications`             | CLASSIFICATION only                       |
| (implied)        | `calculationType: 'LLM_JUDGE'`   | config has no such field: it is always a judge |

`scope`, `participantRole`, `scaleMin`, `scaleMax`, `scaleLabels`, `trueLabel`,
and `falseLabel` are spelled the same in both. One asymmetry to watch:
`participantRole` in config accepts only `AGENT` | `CUSTOMER`, while the
imperative API also takes `SIMULATED_CUSTOMER` and `BACKGROUND_SPEAKER`. A metric
that must be scoped to a simulated caller has to be created imperatively.

## collector (live-call metric policy)

Which metrics get collected on real calls/chats, and on which conversations.

- `conversationType` - required and **immutable** (changing it is a create-new).
- `metrics` - at least one metric **slug** (`metricId`). System and custom slugs
  both allowed.
- `filters` - optional; omit to match every conversation. A filter is an OR of
  groups; conditions within a group are AND. Condition targets include `AGENT`
  (a config-managed agent name), `CALL_SOURCE` (e.g. `VAPI`), `CALL_PROPERTY`
  (key + operator + value), and `INTEGRATION` (integration id).

```ts
{ kind: 'collector', name: 'quality-on-frontdesk', conversationType: 'call',
  metrics: ['call_outcome', 'sentiment_score', 'refund-policy-accuracy'],
  filters: [{ conditions: [{ target: 'AGENT', key: 'frontdesk' }] }] }
```
