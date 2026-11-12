---
name: roark-overview
description: >-
  Use when working with Roark and you are not sure which Roark skill to load:
  a one-page map from the job someone wants done (run a simulation, write test
  conversations, connect an agent, decide how calls are graded, grade real
  production calls, automate in CI) to the skill that does it. For the actual
  create-and-run path, go straight to simulate-quickstart.
---

# Which Roark skill should I use?

Roark is a voice and chat agent observability and simulation platform. It tests
an agent with simulated phone calls before launch, and grades real calls after
launch. Each skill below does one job. Find the job, load that skill.

## Use this when

- You have a Roark task and do not know which skill covers it.
- You need the one rule about cost before doing anything that places calls.

## Use a different skill when

- You want to create and run a simulation: go straight to
  **`simulate-quickstart`**. It is the start-here path.
- You need to know what a Roark object *is* (persona, flow, run plan, metric):
  read **`roark-concepts`**.

## You will have

The name of the one skill to load next.

## The map

### 1. Run a simulation

- **`simulate-quickstart`** - start here: from "test my agent" to a created,
  previewed, and confirmed run, end to end.
- **`flows-*` playbooks** - what to test for an industry: personas, flows, and
  metrics for `flows-customer-support`, `flows-healthcare`,
  `flows-car-dealership`, `flows-home-services`, `flows-finance`,
  `flows-car-insurance`, and `flows-debt-collection`.
- **`simulate-load-testing`** - high-volume runs only: concurrency, iterations,
  staged ramp-up.
- **`build-run-plan`** - the detailed how-to for assembling a plan, previewing its
  call count, and starting it.
- **`manage-run-plans`** - work with a suite that is already saved: find, edit,
  re-run, promote, delete.
- **`read-results`** - find out how a run went: pass/fail checks, scores,
  transcripts.

### 2. Write the test conversations

- **`author-personas-flows`** - create the caller (persona) and a natural,
  improvised conversation (IMPROV flow).
- **`author-scripted-flows`** - create an exact conversation: IVR menus, keypad
  (DTMF) entry, silence, voicemail, fixed turn order.

### 3. Connect the agent

- **`register-agent`** - give Roark the agent under test and the phone number it
  calls. Skip it if the agent already has an endpoint.
- **`configure-outbound-dial`** - only when Roark must call your platform's API
  to make the agent dial out. Inbound agents skip it.

### 4. Decide what "good" means

- **`configure-metrics`** - pick the built-in metrics and pass/fail checks that
  grade each call, or write a custom one.

### 5. Grade real production calls

- **`ingest-calls`** - import a recording of a call that already happened, and
  read calls back.
- **`monitor-live-calls`** - grade production traffic automatically from now on,
  or backfill scores over past calls.

### 6. Automate

- **`gate-ci`** - fail a deploy when a simulation's checks fail.
- **`subscribe-webhooks`** - get an HTTP callback when a run or analysis finishes,
  instead of polling.
- **`manage-config-as-code`** - keep agents, personas, flows, metrics, and
  collectors in a repo and sync them with diff and apply.

### 7. Reference

- **`roark-concepts`** - what each Roark object is and which choice is right.
  Generated from Roark's own product docs; trust it over memory.
- [references/primitives.md](references/primitives.md) - the object graph, and
  which objects the SDK can create.
- [references/conventions.md](references/conventions.md) - permissions,
  pagination, response envelopes, errors.

## Typical orders

- **First run:** `simulate-quickstart` -> the matching `flows-*` playbook ->
  `build-run-plan` -> `read-results`. It pulls in `register-agent` and
  `author-personas-flows` only when the agent, personas, or flows do not exist.
- **Repeat run:** `manage-run-plans` (re-run by id) -> `read-results`.
- **Release gate:** `manage-run-plans` (a saved suite) -> `gate-ci`.

## The one rule that costs money

**Every simulated call is a real call that bills.** A run places
`flows and variants x personas x endpoints x iterationCount` calls, and that
multiplies fast (`edgeCases: 'ALL'` across several flows, or a large
`iterationCount`). Before any run starts: **create the plan, read back
`testCaseCount`, tell the user the number, and wait for a yes.**
`build-run-plan` shows exactly how.

Simulations are voice calls. Chat cannot be simulated through the SDK; real
chats can only be imported and graded (`ingest-calls`, `monitor-live-calls`).

## Not available through the SDK

Do not invent client methods for these. They live in the product, on raw HTTP,
or in provider integrations: chat (`POST /v1/chat` only, no `client.chat.*`),
knowledge-base grounding, datasets, issues, provider call imports (Vapi, Retell,
LiveKit, Pipecat send webhooks to Roark), and metric update, delete, and
thresholds. The full list is in
[references/primitives.md](references/primitives.md). If unsure a method exists,
search the SDK docs rather than guessing a name.

## Next

- Creating and running a simulation: `simulate-quickstart`.
- Anything else: the skill named in the map above.

## How the tools connect (MCP note)

The skills' TypeScript examples are `@roarkanalytics/sdk` calls.

- **Claude Code plugin (default).** Connects to Roark's hosted MCP at
  `https://mcp.roark.ai/mcp` and signs in through the browser. It exposes
  named tools: `list_projects`, `list_agents`, `list_agent_endpoints`,
  `list_calls`, `get_call`, `get_call_transcript`, `list_call_metrics`,
  `list_metric_definitions`, `get_simulation_results`, `list_personas`,
  `list_customer_flows`, `list_simulation_environments`, `search_docs`, and the
  writes `create_agent`, `create_agent_endpoint`, `create_persona`,
  `create_customer_flow`, `run_simulation`. Pass `project` on each call
  (`list_projects` returns ids), unless the URL is pinned as `/mcp/<projectId>`.
  It does not run TypeScript.
- **Local code-execution server** (separate install, see the repository README).
  Runs an `async function run(client)` against the SDK with a
  `ROARK_API_BEARER_TOKEN` API key. Needed for anything the named tools do not
  cover: scripted flow graphs, run plan create and update, metric policies,
  webhooks, config as code, importing a recording.

On a 401, the sign-in expired or the token is missing: tell the user to sign in
again or set the key. Never read a token from a checked-in file. Permissions,
pagination, and error handling are in
[references/conventions.md](references/conventions.md).
