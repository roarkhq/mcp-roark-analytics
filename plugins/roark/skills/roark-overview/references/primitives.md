# Roark primitives (the object model)

Every skill manipulates these objects. This is the map: what each one is, what it
references, and - critically - **which ones you can actually create through the
SDK**. Guessing a method for a read-only or unexposed primitive is the most common
way to waste a turn.

## The object graph

```
agent ──── agentEndpoint ─────────┐   (endpoint = where Roark reaches the agent)
  │            │                  │
  │            └── httpRequestDefinition   (outbound dial: Roark calls YOUR api)
  │                                │
  │                          run plan  ── metrics[]         (the test suite)
  │                            │  │
customerFlow ──────────────────┘  └── run plan job          (one execution)
  │   │                                   │
  │   ├── happy path (variant) ───────────┤
  │   └── edge cases (variants)           └── simulation job (ONE call)
  │         │                                     │
  │         ├── persona   (who calls)             └── call ── metric values
  │         └── environment (background noise)              ── transcript
  │                                                          ── sentiment runs
  └── graph (scripted only: steps, DTMF, branches)

live traffic:  call / chat ── metricPolicy (standing rule) ── metricCollectionJob
                                                              (batch/backfill)
webhook ── events (run finished, analysis done, issue opened)
```

## What you can create, and what you cannot

| primitive | SDK resource | you can |
| --- | --- | --- |
| agent | `agent` | create, update (name/description only), list, get |
| agent endpoint | `agentEndpoint` | create **PHONE only**, narrow update, list, get |
| persona | `simulationPersona` | create, update, list, get (**no delete**) |
| environment | `simulationEnvironment` | **list, get only** - never create |
| customer flow | `customerFlow` | create, update, delete, list, get, `replaceGraph`, `updateHappyPath` |
| flow edge case | `customerFlowEdgeCase` | add, update, promote, remove (**improv flows only**) |
| metric definition | `metric` | `createDefinition`, `listDefinitions` **only** |
| threshold (a check) | - | **not in the SDK** (HTTP route only) |
| run plan | `simulationRunPlan` | create, update, list, delete, get |
| run (batch) | `simulation.run`, `simulationRunPlanJob` | run, list, get, `start` (deprecated) |
| one call's job | `simulationJob` | get, `lookup` (by Roark phone number) |
| call | `call` | create (ingest), list, get, transcript, metrics, sentiment runs |
| live metric policy | `metricPolicy` | create, update, list, delete, get |
| metric backfill | `metricCollectionJob` | create, list, get |
| outbound dial request | `httpRequestDefinition` | create, update, list, get (**no delete**) |
| webhook | `webhook` | create, list, delete, get |
| config bundle | `config` | `diff`, `apply` |

**Not in the SDK at all** - do not invent client methods for these:

- **chat** - chats exist and can be graded, but only via the raw
  `POST /v1/chat` REST endpoint. There is no `client.chat.*`.
- **knowledge base** - grounding documents are attached to metrics in the product.
- **datasets** - curating calls into regression datasets is **in-product only**.
- **issues** - auto-detected problem clusters, surfaced on the Issues page.
- **provider imports** (Vapi, Retell, LiveKit, Pipecat) - Roark *receives* their
  webhooks; to bring a call in from code, use `call.create`.
- **metric update/delete, get-one-metric, thresholds** - HTTP routes exist, no
  client methods.
- **persona folders**, **flow labels** - real product concepts, not filterable or
  settable through the API.
- **the legacy `scenario` resource** - deprecated and replaced by customer flows.

## What each primitive *is*

Definitions live in the `roark-concepts` skill, shared with Roark's in-product
assistant so the two cannot describe the product differently. Read the one you
need rather than all of them:

| To understand | Read |
| --- | --- |
| personas, and why a trait in a brief does nothing | `../../roark-concepts/personas.md` |
| flows, variants, improv vs scripted, expectations | `../../roark-concepts/flows.md` |
| step graphs, DTMF, branching modes | `../../roark-concepts/scripted-flows.md` |
| run plans, variant selection, the call multiplication | `../../roark-concepts/run-plans.md` |
| metric definitions, checks, collectors | `../../roark-concepts/metrics.md` |
| run templates, and the current catalogue | `../../roark-concepts/templates.md` |
| the declarative bundle | `../../roark-concepts/config-as-code.md` |

What follows is only the part a concept does not cover, because it is about the
SDK rather than the domain.

**Agent vs endpoint.** The agent is the thing under test; the endpoint is how Roark
reaches it. Run plans reference **endpoints**, not agents. One agent can have many
endpoints (different numbers, environments, transports).

**Run plan vs run vs simulation job vs call.** The plan is the suite. Running it
creates a **run plan job** (the batch). That fans out into one **simulation job**
per test case, each of which produces a **call** once it connects. Metrics attach to
the call.

**A metric value carries a `captureStatus`.** Check it before reading `value`: a
value that could not be graded still comes back, and reading it blind is how a
failed grade turns into a confident wrong number.

**System resources are read-only.** Roark ships system personas, flows,
environments, metrics and policies. They appear in your lists (flows need
`includeSystem: true`) and edits to them fail. Copy rather than edit.

## Two hard limits to respect

- **Every simulated call bills.** Calls placed =
  `variants x personas x endpoints x iterationCount`. Preview `testCaseCount`
  before starting. See `../../roark-concepts/run-plans.md` for why the selection
  is never defaulted.
- **Scripted graphs** cap at 100 steps across 25 leaf paths.
