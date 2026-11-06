---
name: manage-config-as-code
description: >-
  Use when someone wants their Roark setup kept in a repo and synced, instead of
  one-off create and update calls: declare agents (with endpoints), personas,
  flows, custom metrics, and live-call collectors as one bundle, preview with
  config.diff, then reconcile with config.apply. Not for starting runs; runs stay
  imperative in build-run-plan.
---

# Manage Roark resources from a repo

Config as code submits the **full desired set** of resources; Roark diffs it
against what exists and reconciles. It is the repo-native alternative to the
imperative calls in the other skills.

## Use this when

- The user wants Roark config in git, reviewed in pull requests, reproducible
  across projects.
- A request is "make Roark match this repo" or "sync all our personas and flows".
- Setup must be idempotent: re-running it should never duplicate anything.

## Use a different skill when

- It is a one-off tweak or exploration: the imperative skills
  (`register-agent`, `author-personas-flows`, `configure-metrics`,
  `monitor-live-calls`) are quicker, and do not lock the resource in the UI.
- You want to run a simulation: `build-run-plan`. Run plans are not a config kind.
- You need threshold, formula, or pattern metrics: `configure-metrics`. Config
  authors custom LLM-judge metrics only.

## You will have

A bundle in the repo, a reviewed diff (with any deletes called out and
confirmed), and an apply report where every change is `applied`, or the `failed`
ones reported with their errors.

**Read first:** `../roark-concepts/config-as-code.md` (identity by name, why
renaming is not renaming, what reconciliation prunes, what config cannot express).
Field mapping to the imperative API: `../roark-concepts/metric-config-mapping.md`.

## How it behaves

- Each resource is keyed `<kind>/<name>` (its configKey). No UUIDs in the bundle.
- **`prune` defaults to `true`**: a config-managed resource missing from the
  bundle is **deleted**. Use `prune: false` for additive-only syncs.
- Applying is idempotent: unchanged config updates in place, never duplicates.
- Config-managed resources become **read-only in the product UI** ("managed by
  config"). Edit them in config and re-apply.
- Both `diff` and `apply` need the `config:apply` permission.

## 1. Write the bundle, diff it, then apply

The request body **is** the bundle: top-level `resources` and `prune` only. No
`bundle` wrapper, no `dryRun`, no `version`.

Worked example: an agent with its phone endpoint and one persona.

```ts
const bundle = {
  resources: [
    {
      kind: 'agent',
      name: 'frontdesk', // lowercase, matches /^[a-z0-9][a-z0-9-_.]*$/
      description: 'Inbound reception line',
      endpoints: [
        { name: 'main-line', value: '+15551234567', direction: 'INCOMING', environment: 'production' },
      ],
    },
    { kind: 'persona', name: 'calm-caller', language: 'EN', accent: 'US', gender: 'FEMALE' },
  ],
  prune: false, // additive while you are getting started
}

const { data: diff } = await client.config.diff(bundle) // writes nothing
// diff.summary => { create, update, delete, noop }
// diff.changes => [{ configKey, kind, name, op }]  op is lowercase
// Show this to the user. If summary.delete > 0, confirm before applying.

const { data: applied } = await client.config.apply(bundle)
// applied.changes => [{ ..., status: 'applied' | 'failed', id?, error? }]
```

What the response really does:

- **`noop` is never returned.** The diff classifies by existence only: managed
  already means `update`, otherwise `create`. "Everything shows as update" is
  normal.
- **`apply` is not atomic.** A failure partway leaves earlier changes committed;
  treat `changes[]` as a partial-success report and report each `error`. Do not
  retry blindly.
- Deletes run last; flows are deleted before the agents and personas they use.
- Usual `failed` causes: changing a collector's `modality`, changing an immutable
  metric field (`name`/slug, `type`, `scope`), or naming an environment that does
  not exist (`unknown environment "X"`). The first two mean "make a new resource".

## 2. Resource kinds

`agent` (with `endpoints`), `persona`, `flow` (improv or scripted), `metric`
(custom LLM judge), and `collector` (a live-call metric policy, by filter).
Shapes: [references/resource-kinds.md](references/resource-kinds.md).

- **System metrics are referenced, not defined**: name them by slug inside a
  `collector`.
- **Collectors use their own vocabulary** (`filters` with `type` / `key` /
  `operator` / `value`, metrics by slug), different from the SDK's
  `metricPolicy` shape in `monitor-live-calls`. Do not mix the two.
- **Environments are not a kind** and cannot be created anywhere in the API.
- **Run plans are not a kind.** Reconcile config, then start runs with
  `build-run-plan`.

## CLI alternative

For a directory of YAML files, the Roark CLI does the globbing, `file://` prompt
inlining, and diff and apply: `roark config diff ./roark` then
`roark config apply ./roark`. Same contract as `config.diff` / `config.apply`.

## Next

- `build-run-plan` to run simulations against the reconciled resources.
- `gate-ci` to apply config and gate on a run in the same pipeline.
- `monitor-live-calls` for the imperative equivalent of collectors.
