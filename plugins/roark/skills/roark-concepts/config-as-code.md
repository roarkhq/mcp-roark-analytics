---
name: "config-as-code"
description: "The declarative config bundle - resources identified by name, what reconciliation does, what config cannot express, and why its field vocabulary differs from the imperative API."
---

<!-- Synced from https://github.com/roarkhq/app-roark-analytics/tree/main/src/packages/roark-concepts. Do not edit here: edits are overwritten by the next sync. -->

# Config as code

Config as code declares a project's agents, personas, flows, metrics and
collectors as a bundle of resources, and reconciles the project to match it. It
is the path for version-controlling a test suite alongside the agent it tests.

## Identity is the name

Every resource carries a `kind` and a `name`, and the pair is its identity.
Cross-references are by name, never by id: a collector names the metrics it
collects, a flow names its agents and personas.

Names are lowercase, start alphanumeric, and allow hyphens, underscores and
dots. `Frontdesk` and `front desk` are both invalid.

Because identity is the name, **renaming is not renaming**. A changed name is a
different resource: the old one is pruned and a new one created, taking its
history with it.

## Reconciliation

Applying a bundle converges the project onto it. Resources in the bundle are
created or updated; resources it no longer mentions are pruned, which is what
makes the bundle a description of the whole managed surface rather than a list of
edits. Preview the diff before applying.

Some fields cannot change on an existing resource: a metric's slug, its output
type, its scope, a collector's modality. An apply that tries fails rather than
silently recreating the resource underneath its history.

## What config cannot express

Config covers the declarative surface, not the whole product:

- Metrics authored in config are **always LLM judges**. Derived metrics -
  thresholds, formulas, pattern metrics - reference other metrics and are created
  imperatively.
- Some enum values are narrower in config than in the imperative API. A metric
  scoped to a simulated caller rather than a real customer is one example: the
  role is out of config's range, so that metric has to be created imperatively.
- Running anything. A bundle describes configuration; starting a run is an
  action, not a declaration.

Everything a config metric creates is filed under a single automatically created
analysis package.

## The vocabularies differ, deliberately

The same metric has different field names in a config bundle and in the
imperative API. Not an inconsistency to tidy away: a config metric is always an
LLM judge, so it has no calculation type to disambiguate and can afford shorter
names, and the two schemas are validated separately. Sending one vocabulary to
the other fails validation.

**The mapping between them is generated** from the translation function that
performs it. This is the exact class of thing that drifts: the published skills
package once documented a pair as identical when the code renames it, and a
reader following that document would have sent a field the API rejects. A table
transcribed by reading two schemas side by side reliably pairs only the fields
that happen to share a name.
