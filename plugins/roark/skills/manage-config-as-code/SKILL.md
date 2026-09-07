---
name: manage-config-as-code
description: >-
  Use to manage Roark resources declaratively from a repo instead of imperative
  create/update calls: define agents, personas, flows, custom metrics, and
  collectors as a bundle, preview changes with config.diff, and reconcile with
  config.apply. Use when someone wants Roark config in version control, a
  repeatable/idempotent setup, or to sync a whole project's resources at once.
---

# Manage Roark as config-as-code

Roark supports a declarative path: submit the **full desired set** of resources
as a bundle; the server diffs it against what exists and reconciles. This is the
repo-native alternative to the imperative `create`/`update` calls in the other
skills. Prefer it when the user wants their Roark setup **in git**, reproducible,
and idempotent.

## The model

- Identity is by **`name`**, not id. The server keys each resource by
  `<kind>/<name>` (its "configKey") and resolves cross-references (a flow's
  `agents`, a collector's agent filter) by name. Your bundle carries no UUIDs.
- **`prune` defaults to `true`**: a config-managed resource missing from the
  bundle is **deleted**. The bundle is the complete desired state, not a patch.
  Set `prune: false` for additive-only syncs.
- Applying is **idempotent**: re-submitting unchanged config updates in place and
  never duplicates.
- Config-managed resources become **read-only in the product UI** (a "managed by
  config" badge). They are edited in config and re-applied, or detached to hand
  ownership back to the UI.

## Always diff before apply

`config.diff` is a dry run: it returns the projected `create` / `update` /
`delete` / `noop` changes and a summary, and writes nothing. Show the diff (and
call out deletes) before applying.

```ts
const bundle = {
  resources: [
    { kind: 'agent', name: 'frontdesk', description: 'Inbound reception line' },
    // ... personas, flows, metrics, collectors
  ],
  prune: true,
}

const diff = await client.config.diff(bundle)
// diff.summary => { create, update, delete, noop }
// diff.changes => [{ configKey, kind, name, op, detail? }]
// Surface this to the user. If delete > 0, confirm it is intended.

const applied = await client.config.apply(bundle)
// applied.changes => [{ ..., status: 'applied'|'skipped'|'failed', id?, error? }]
// applied.summary => { create, update, delete, noop, failed }
```

Applying needs an API key with the **`config:apply`** permission; `diff` is
read-only. If `apply` returns any `failed` change, report its `error`; do not
retry blindly.

## Resource kinds

`agent`, `persona`, `flow` (improv or scripted), `metric` (custom LLM-judged),
`collector`. Field shapes are in
[references/resource-kinds.md](references/resource-kinds.md). The important
boundaries:

- **System metrics are not defined here.** They are Roark-managed; reference them
  by slug inside a `collector`. Only custom LLM-judge metrics are authored as
  `metric` resources (derived threshold/formula/pattern metrics are out of scope
  for config-as-code; author those with `configure-metrics`).
- **Collectors are live-call metric policies:** which metrics get collected on
  real calls/chats, by filter. This is how config-as-code touches production
  monitoring, distinct from simulation grading.
- **Run plans are not a config kind.** Config manages the resources a run
  references (agents, personas, flows, metrics); *triggering runs* stays
  imperative via `build-run-plan` (`simulation.run`). Keep the two separate:
  reconcile config, then start runs.

## When to use this vs imperative calls

- **Config-as-code** when: managing many resources, wanting them in git,
  reproducible environments, or a "make Roark match this repo" request.
- **Imperative** (`register-agent`, `author-personas-flows`, `configure-metrics`)
  when: a one-off tweak, exploring, or working with resources the user does not
  want config to own (and thus lock in the UI).

## CLI alternative

For a directory of YAML files, Roark's CLI does the globbing, `file://` prompt
inlining, and diff/apply for you: `roark config diff ./roark` then
`roark config apply ./roark`. It is the same wire contract as `config.diff` /
`config.apply`; suggest it when the user already keeps YAML rather than building
the bundle in code.
