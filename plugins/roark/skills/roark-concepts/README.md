<!-- Synced from https://github.com/roarkhq/app-roark-analytics/tree/main/src/packages/roark-concepts. Do not edit here: edits are overwritten by the next sync. -->

# Roark concepts

What the Roark domain objects are, shared with the in-product assistant so the
two cannot describe the product differently. Skills reference these rather than
restating them; a skill owns the workflow and the SDK calls, not the definitions.

| Concept | Covers |
| --- | --- |
| [`config-as-code`](./config-as-code.md) | The declarative config bundle - resources identified by name, what reconciliation does, what config cannot express, and why its field vocabulary differs from the imperative API. |
| [`flows`](./flows.md) | Customer flows - the conversation a simulated caller has with the agent under test, in improv or scripted form, and the variants and expectations hanging off it. |
| [`metric-config-mapping`](./metric-config-mapping.md) | How a config-as-code metric maps onto the imperative metric API, checked against the translation function that performs it. |
| [`metrics`](./metrics.md) | How conversations get graded - metric definitions, pass/fail checks, collectors that run metrics on live conversations, and the chain from an abstract question to a chart. |
| [`personas`](./personas.md) | Who is calling - the reusable identity, voice and temperament of a simulated caller, and how it differs from the brief describing a single call. |
| [`run-plans`](./run-plans.md) | The simulation run plan - what it binds together, how variant selection and iteration multiply into real calls, and what a run snapshots when it starts. |
| [`scripted-flows`](./scripted-flows.md) | The step graph behind a scripted flow - node types, the DAG and role-alternation rules, branching modes, and how paths become variants. |
| [`templates-catalogue`](./templates-catalogue.md) | The run templates that ship with Roark - what each one tests, checked against the system data catalogue. |
| [`templates`](./templates.md) | Run templates - curated blueprints that map a testing goal onto a ready bundle of metrics, pass/fail checks and flows. |
