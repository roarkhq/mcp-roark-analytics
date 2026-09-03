---
name: roark-overview
description: >-
  Use when testing, simulating, or evaluating a voice or chat AI agent with
  Roark, or when the Roark MCP is connected. Covers how the Roark MCP works
  (you write @roarkanalytics/sdk snippets, you do not call one tool per
  endpoint), how to authenticate, the core testing loop (register agent ->
  personas and flows -> run plan -> run -> metrics -> results), and which
  companion skill to use for each step. Read this first.
---

# Roark: testing voice AI agents

Roark stress-tests a voice or chat agent with simulated calls before launch, then
grades every call against a suite of metrics. This skill orients you; the
companion skills (`build-run-plan`, `configure-metrics`) do the detailed work.

## How the Roark MCP works (read this)

The Roark MCP is a **code-execution** server, not a one-tool-per-endpoint server.
You do not call `create_run_plan(...)`. Instead you **write short TypeScript
against the `@roarkanalytics/sdk` client** and run it through the MCP's code
tool. One snippet can chain several calls (list personas, then build a plan, then
start it).

Two MCP tools matter:

- **the code tool** runs your `@roarkanalytics/sdk` snippet and returns the
  result. A pre-initialized `client` is in scope. Write `await client.<resource>.<method>(...)`.
- **the docs search tool** looks up exact method signatures, parameter names, and
  response shapes. **Use it whenever you are unsure of an argument** rather than
  guessing. The skills give you the shape; docs search confirms it against the
  installed SDK version.

Everything the client can do maps to `resource.method`, for example:

```ts
const { data: personas } = await client.simulationPersona.list({ limit: 50 })
const agents = await client.agent.list()
const run = await client.simulation.run({ plan: { /* ... */ } })
```

If a snippet fails schema validation, the error names the offending field. Read
it, fix that one field, and re-run. Do not fall back to raw HTTP.

## Auth

The MCP authenticates with a bearer token from the `ROARK_API_BEARER_TOKEN`
environment variable against `https://api.roark.ai`. If calls return 401, the
token is missing or expired; tell the user to set a Roark API key rather than
trying to work around it. Never read a token out of a checked-in file.

## The core loop

```
  agent + endpoint     who + how Roark reaches the agent under test
        |
  personas + flows     who calls (persona) and what they do (customer flow)
        |
  run plan             the test matrix: endpoints x flows x personas x metrics
        |
  run                  places the simulated calls
        |
  metrics              each finished call is graded pass/fail and scored
        |
  results / datasets   read scores and transcripts; curate calls for regression
```

You rarely build all of this from scratch. Most projects already have an agent,
some flows, and the system persona library. The common request is **"assemble
the right run plan and metrics and run it"**, which is `build-run-plan` +
`configure-metrics`.

## Which skill to use

- **`build-run-plan`** - configure and start a simulation: pick a testing goal,
  choose flows and how much of each to run, set iteration and concurrency, attach
  metrics, preview the call count, and run. This is the main skill.
- **`configure-metrics`** - choose the built-in metrics for a goal, add pass/fail
  checks, or author a custom metric (LLM judge, formula, temporal pattern).
- **`register-agent`** - create the agent under test and a phone endpoint Roark
  can reach. Use when the agent is new.
- **`author-personas-flows`** - define who calls (personas) and what they do
  (customer flows) when a run needs one that does not exist yet.
- **`read-results`** - poll a run, list its calls, and read metric scores
  (pass/fail) and transcripts.
- **`manage-config-as-code`** - manage agents, personas, flows, metrics, and
  collectors declaratively from a repo (diff then apply), instead of imperative
  create/update. Reach for this when the user wants Roark config in git.
- **`gate-ci`** - gate a deploy or CI pipeline on a run (start -> wait -> assert
  the pass/fail metrics -> exit code).

Cross-cutting rules every skill relies on (auth, project scoping, pagination,
idempotency, cost, error handling) are in
[references/conventions.md](references/conventions.md).

A typical first-time setup runs them in order: `register-agent` ->
`author-personas-flows` -> `build-run-plan` (+ `configure-metrics`) ->
`read-results`. Most repeat runs are just `build-run-plan` -> `read-results`.

## The one rule that costs money

**Every simulated call is a real call that bills.** The number of calls a run
places is `flows and variants x personas x endpoints x iterationCount`, and it is
easy to make it explode (selecting `edgeCases: 'ALL'` across several flows, or a
large `iterationCount`). Before starting any run that could be large, **create
the plan, read back `testCaseCount`, state it to the user, and only then start
the run.** `build-run-plan` shows exactly how.
