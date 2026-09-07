# Roark Claude Code plugin

One plugin that bundles the **Roark MCP** with skills that make your coding
agent an expert at testing voice and chat AI agents: registering agents,
designing personas and customer flows, building simulation run plans, and
configuring the metrics that grade them.

These skills complement the MCP. The MCP gives your agent the tools (a code tool
that runs `@roarkanalytics/sdk` snippets, plus docs search); these skills give it
the workflow and judgment: which testing template fits, which metrics to attach,
how to select flow variants without accidentally placing hundreds of calls.

## Skills

| Skill                 | Use it to                                                        |
| --------------------- | ---------------------------------------------------------------- |
| `roark-overview`      | Understand how the Roark MCP works, learn the primitives, and route to the right skill. |
| `register-agent`      | Create the agent under test and a phone endpoint Roark reaches.  |
| `author-personas-flows`| Define who calls (personas) and what they do (improv flows).    |
| `author-scripted-flows`| Author IVR/DTMF/scripted conversation graphs (exact routing).   |
| `configure-outbound-dial`| Define the HTTP request Roark sends to place OUTBOUND calls.   |
| `build-run-plan`      | Configure and start a simulation (the main workflow).            |
| `manage-run-plans`    | Manage saved test suites: find, edit, re-run, delete plans.      |
| `configure-metrics`   | Choose built-in metrics, add pass/fail checks, or author custom. |
| `read-results`        | Poll a run and read metric scores (pass/fail) and transcripts.   |
| `monitor-live-calls`  | Grade real production calls/chats: policies and backfill jobs.   |
| `ingest-calls`        | Import a real recording for analysis; read calls and sentiment.  |
| `subscribe-webhooks`  | Get event notifications (run done, issue opened) instead of polling. |
| `manage-config-as-code`| Manage agents/personas/flows/metrics/collectors declaratively.  |
| `gate-ci`             | Gate a deploy/CI pipeline on a run (start, wait, assert).        |

`roark-overview` also carries two cross-cutting references every other skill leans
on: `references/primitives.md` (the object model, and exactly which primitives the
SDK can create) and `references/conventions.md` (auth, permissions, pagination,
cost, error handling).

Each skill is a `SKILL.md`, some with a `references/` folder that loads on demand.

## Install (Claude Code)

Add the Roark marketplace once if it is not already registered:

```
/plugin marketplace add roarkhq/mcp-roark-analytics
```

Set your Roark API key in the environment that launches Claude Code:

```sh
export ROARK_API_BEARER_TOKEN="My Bearer Token"
```

Then install the bundled MCP and skills together:

```
/plugin install roark@roark
```

The bundled MCP server is named `roark`, so Claude Code exposes its tools as
`mcp__roark__*`. It reads `ROARK_API_BEARER_TOKEN` from the environment; Claude
Code does not prompt for this value during plugin installation. See
https://docs.roark.ai.

## Other agents

The skills follow the open Agent Skills format (`SKILL.md` + `references/`), so
they port to Cursor, Codex, and other agents: copy the `skills/*` directories
into your agent's skills location.

## For maintainers

This package lives beside the generated MCP on purpose, so the workflow docs
version with the SDK surface they describe. It is hand-authored and is **not**
touched by `app-agent-codegen` (which only rewrites the four generated files in
`src/`) and **not** published to npm (the plugin ships from git). The tree is
listed in `.prettierignore` so `pnpm lint` does not format it.
