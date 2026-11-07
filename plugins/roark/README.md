# Roark Claude Code plugin

One plugin that bundles the **Roark MCP** with skills that make your coding
agent an expert at testing voice and chat AI agents: registering agents,
designing personas and customer flows, building simulation run plans, and
configuring the metrics that grade them.

New to Roark, or not sure where to begin? Ask your agent to use
`simulate-quickstart`. It picks the industry playbook (`flows-*`) that matches
your agent, authors personas and flows from it, builds the run plan, and tells
you how many billable calls the run will place before anything starts.

These skills complement the MCP. The plugin connects to Roark's remote connector,
which signs you in through the browser and exposes separate tools for reading
agents, calls, transcripts, and simulation results, and for creating personas,
customer flows, and simulations. The skills give the workflow and judgment:
which testing template fits, which metrics to attach, how to select flow
variants without accidentally placing hundreds of calls.

## Skills

Each skill does one job and opens with when to use it, when to use a different
skill, and what you will have at the end. Not sure where to start? Load
`roark-overview` (the map) or `simulate-quickstart` (the start-here path).

**Start here: run a simulation**

| Skill | Use it to |
| --- | --- |
| `simulate-quickstart` | **Start here.** Go from "test my agent" to a created, previewed, confirmed run. |
| `flows-customer-support` | Playbook: billing, account access, troubleshooting, cancellation, escalation. |
| `flows-healthcare` | Playbook: appointments, refills, insurance verification, after-hours, disclosures. |
| `flows-car-dealership` | Playbook: sales, service scheduling, parts, financing, test-drive follow-up. |
| `flows-home-services` | Playbook: booking, rescheduling, technician ETA, billing, emergency triage. |
| `flows-finance` | Playbook: account inquiries, fraud and cards, transfers, disputes, identity checks. |
| `flows-car-insurance` | Playbook: first notice of loss, policy, claims status, billing, coverage. |
| `flows-debt-collection` | Playbook: payment plans, hardship, disputes, disclosures, collection policy. |
| `simulate-load-testing` | Load test a voice agent: concurrency, iterations, staged ramp-up. |
| `build-run-plan` | Design and start a simulation: flow selection, metrics, preview the call count, confirm, run. |
| `manage-run-plans` | Reuse or update a saved test suite: find, edit, re-run, promote, delete. |
| `read-results` | Read how a simulation went: checks, scores, reasoning, transcripts. |

**Write the conversations**

| Skill | Use it to |
| --- | --- |
| `author-personas-flows` | Write an improvised test conversation: personas and IMPROV flows. |
| `author-scripted-flows` | Write a scripted or IVR conversation: menus, keypad (DTMF), exact turns. |

**Connect the agent**

| Skill | Use it to |
| --- | --- |
| `register-agent` | Connect your agent to Roark: the agent and the phone endpoint Roark calls. |
| `configure-outbound-dial` | Trigger outbound simulated calls through your platform's API. Inbound agents skip it. |

**Grade**

| Skill | Use it to |
| --- | --- |
| `configure-metrics` | Choose how calls are graded: built-in metrics, pass/fail checks, custom judges. |

**Production calls**

| Skill | Use it to |
| --- | --- |
| `ingest-calls` | Import a real recording into Roark and read calls back. |
| `monitor-live-calls` | Grade live production calls going forward, or backfill scores over past calls. |

**Automate**

| Skill | Use it to |
| --- | --- |
| `gate-ci` | Block a release on simulation results. |
| `subscribe-webhooks` | Get notified when a run or analysis finishes. |
| `manage-config-as-code` | Manage Roark resources from a repo with diff and apply. |

**Reference**

| Skill | Use it to |
| --- | --- |
| `roark-overview` | Which Roark skill should I use? A one-page map, plus the cost rule. |
| `roark-concepts` | What each Roark object *is*. The shared definitions the others reference. |

`roark-concepts` is generated, not hand-written: it is synced from
`src/packages/roark-concepts` in `roarkhq/app-roark-analytics` by a workflow
there, and the same corpus composes Roark's in-product assistant prompt, so the
two cannot describe the product differently. Edits made here are overwritten by
the next sync.

The division of labour is the point. A **concept** says what a thing is and which
choice is right; a **skill** says which call to make and what the API will
reject, including where the public vocabulary diverges from the internal one
(`type: 'IMPROV'` over the API where the concept says `mode: 'UNSCRIPTED'`).

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

Then install the bundled MCP and skills together:

```
/plugin install roark@roark
```

The bundled MCP server is named `roark`, so Claude Code exposes its tools as
`mcp__roark__*`. When Claude connects, it opens a browser window so you can
sign in to Roark. No API key is pasted into the plugin. See
https://docs.roark.ai.

The remote connector covers the everyday loop: list what a project already
has, create a persona or customer flow, run a simulation, and read the
results. Workflows the named tools do not cover (scripted flow graphs, metric
policies, webhooks, config as code, importing a recording) use the local
code-execution server instead. That install is separate and is described in
the [repository README](../../README.md). It needs Deno and a Roark API key.

## Other agents

The skills follow the open Agent Skills format (`SKILL.md` + `references/`), so
they are not Claude-specific. Install them into any agent with the `skills` CLI,
which reads this repository directly:

```sh
npx skills add roarkhq/mcp-roark-analytics
```

That installs all 24 skills. Pass `-a` to choose targets, repeating the flag per
agent (a comma-separated list is parsed as one name and rejected):

```sh
npx skills add roarkhq/mcp-roark-analytics -a codex -a cursor -a gemini-cli -a github-copilot
```

Codex, Cursor, Gemini CLI and GitHub Copilot all read the universal
`.agents/skills/` layout, which is where the CLI puts them, so nothing needs
converting. Claude Code gets `.claude/skills/` instead. Add `-g` to install for
your user rather than the current project.

The MCP is separate: the CLI installs skills only. Agents that want the Roark
API tools as well still configure the MCP server, per the [root
README](../../README.md).

**Keep the skills together.** More than 40 of the cross-references in this tree
point from one skill into another, mostly into `roark-concepts` and from the
industry playbooks into the core skills. Any install that packages
skills individually breaks those links. That rules out Claude Desktop, whose
Customize -> Skills screen takes one zip per skill and has no notion of sibling
skills; use Claude Code or one of the `.agents/skills/` agents instead.

## For maintainers

This package lives beside the generated MCP on purpose, so the workflow docs
version with the SDK surface they describe. It is hand-authored and is **not**
touched by `app-agent-codegen` (which only rewrites the four generated files in
`src/`) and **not** published to npm (the plugin ships from git). The tree is
listed in `.prettierignore` so `pnpm lint` does not format it.
