# Roark agent skills

A skills package that makes your coding agent an expert at using the **Roark
MCP** to test voice and chat AI agents: registering agents, designing personas
and customer flows, building simulation run plans, and configuring the metrics
that grade them.

These skills complement the MCP. The MCP gives your agent the tools (a code tool
that runs `@roarkanalytics/sdk` snippets, plus docs search); these skills give it
the workflow and judgment: which testing template fits, which metrics to attach,
how to select flow variants without accidentally placing hundreds of calls.

## Skills

| Skill                 | Use it to                                                        |
| --------------------- | ---------------------------------------------------------------- |
| `roark-overview`      | Understand how the Roark MCP works and route to the right skill. |
| `register-agent`      | Create the agent under test and a phone endpoint Roark reaches.  |
| `author-personas-flows`| Define who calls (personas) and what they do (customer flows).  |
| `build-run-plan`      | Configure and start a simulation (the main workflow).            |
| `configure-metrics`   | Choose built-in metrics, add pass/fail checks, or author custom. |
| `read-results`        | Poll a run and read metric scores (pass/fail) and transcripts.   |
| `manage-config-as-code`| Manage agents/personas/flows/metrics/collectors declaratively.  |

Each skill is a `SKILL.md`, some with a `references/` folder that loads on demand.

## Install (Claude Code)

```
/plugin marketplace add roarkhq/mcp-roark-analytics
/plugin install roark
```

Then connect the Roark MCP and set `ROARK_API_BEARER_TOKEN` so the skills have
tools to drive. See https://docs.roark.ai.

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
