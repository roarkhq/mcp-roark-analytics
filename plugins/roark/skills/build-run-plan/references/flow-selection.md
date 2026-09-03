# Flow selection and variables

A run plan attaches customer flows through the `flows` array. Each entry is one
flow plus which of its parts you cover. Nothing is defaulted, because each part
you select is a separate billable call.

## Shape

```ts
flows: [
  {
    id: 'flow-uuid', // the customer flow to run
    happyPath: true, // run the happy path (optional)
    edgeCases: 'ALL', // or an array; see below (optional)
    personaOverrideId: 'persona-uuid', // optional: run everything this entry
    // resolves as that persona instead of each part's own
    variables: { customerName: 'John Doe' }, // optional: {{placeholder}} values
  },
]
```

You must provide `happyPath: true`, a non-empty `edgeCases`, or both. An entry
with neither is rejected with a 400 that names the field.

### edgeCases

- `edgeCases: 'ALL'` runs every edge case the flow has **at run time**, so an edge
  case added later is automatically covered.
- `edgeCases: [{ id, personaOverrideId?, variables? }]` runs only the ones you
  name. Each named edge case can carry its own persona override and its own
  variable values, which win over the entry-level ones.

```ts
{
  id: 'flow-uuid',
  happyPath: true,
  edgeCases: [
    { id: 'edge-uuid-1', variables: { tier: 'premium' } },
    { id: 'edge-uuid-2', personaOverrideId: 'angry-caller-uuid' },
  ],
}
```

Find a flow's edge case ids with `client.customerFlow.getByID(flowId)`.

## Fanning one flow across personas or languages

Attach the **same flow more than once** with a different `personaOverrideId` each
time. This is how the multilingual recipe runs one flow across languages: one
entry per language, each overriding to that language's persona.

```ts
flows: [
  { id: flowId, happyPath: true, personaOverrideId: enSpeakerId },
  { id: flowId, happyPath: true, personaOverrideId: esSpeakerId },
  { id: flowId, happyPath: true, personaOverrideId: deSpeakerId },
]
```

List personas with `client.simulationPersona.list()` to get their ids.

## Variables

Flows can contain `{{placeholder}}` tokens. Values resolve in this order (later
wins): plan-level pin on the flow entry -> per-edge-case pin -> runtime override
passed to the run.

Runtime overrides go on the run call, not the plan:

```ts
// Applies to the whole run:
await client.simulation.run({ planId, variables: { orderNumber: '12345' } })

// Scoped per flow (or its happy path / one edge case) when one set will not do:
await client.simulation.run({
  planId,
  variables: [
    { flowId, variables: { orderNumber: '12345' } },
    { flowId, happyPath: true, variables: { orderNumber: '55555' } },
    { flowId, edgeCaseId, variables: { orderNumber: '67890' } },
  ],
})
```

An override that names a flow the plan does not attach, or an edge case that does
not belong to the flow, is rejected rather than ignored.

## Call-count arithmetic

Calls placed by a run =

```
sum over each flow entry of (happyPath ? 1 : 0) + (number of edge cases it runs)
  x (personas resolved for that entry)
  x (number of agentEndpoints)
  x iterationCount
```

`edgeCases: 'ALL'` across several flows plus a high `iterationCount` multiplies
fast. Always create the plan and read `testCaseCount` before starting (see the
main skill, step 5).

## Deprecated: scenarios

Older plans use `scenarios` + `personas` instead of `flows`. A scenario is
crossed with the plan's personas to form test cases. Do not build new plans this
way. A plan runs either `flows` or `scenarios`, never both; send `scenarios: []`
alongside `flows` to migrate an existing plan.
