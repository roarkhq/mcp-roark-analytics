---
name: "metrics"
description: "How conversations get graded - metric definitions, pass/fail checks, collectors that run metrics on live conversations, and the chain from an abstract question to a chart."
---

<!-- Synced from https://github.com/roarkhq/app-roark-analytics/tree/main/src/packages/roark-concepts. Do not edit here: edits are overwritten by the next sync. -->

# Metrics

A metric is **what to measure** about a conversation. It is a definition, not a
result: attaching it to a run plan or a collector is what makes it produce
values.

## What a definition says

**Output type** decides the shape of the answer: a yes/no judgment, a number, a
rating on a scale, one or more labels from a set, or free text. Boolean is what
makes a metric usable as a gate; scale and numeric are what trend on a chart.

**Scope** decides who is measured: the conversation as a whole, or each
participant separately. Per-participant metrics need to know which role they
apply to.

**Calculation type** decides how the answer is produced, and carries the cost
consequence:

- A **provider** metric comes from a specialised model.
- An **LLM-judged** metric reads the transcript against a prompt. This is what
  custom metrics almost always are.
- **Threshold**, **temporal** and **formula** metrics are computed by Roark from
  values that already exist - a comparison, a count within a window, an
  arithmetic expression. They reach no model and no provider, and are **not
  billed**.

That last group is why a pass/fail check is cheap: a threshold over an existing
measurement adds a gate without adding a graded call.

**Modality and source** gate where a metric can be used: which of calls and chats
it applies to, and whether it runs on simulated conversations, live ones, or
both. A collector cannot attach a metric that does not support its modality, and
the rejection is a hard gate.

Classification metrics come in two label modes: a fixed set the author provides,
or an open set discovered from the agent's own conversations and grown over time.

Exact value sets are generated from the schema rather than listed here.

## Checks

A metric answers a question; a **check** decides whether the answer is
acceptable. Checks are threshold metrics over other metrics, and they turn a
completed run into a pass or a fail rather than a table to read.

A run that completes is not a run that passed. Completion means the calls
happened; the checks say whether the agent met the bar. A gate built without
checks passes vacuously, forever.

## Auto-managed configuration

Some metrics need per-attachment configuration rather than one global definition:
which pronunciations to enforce, which tools to expect, the knowledge bases to
check grounding against, the voicemail script to compare, the screening brief to
hold. That configuration travels with the attachment, so the same metric can be
attached twice with different expectations, and each configuration is versioned
with an audit of who changed it.

## Collectors

A **collector** (a metric policy) makes metrics run automatically on real
conversations as they arrive. Without one, a metric produces nothing on live
traffic no matter how it is defined.

- Its **modality** - calls or chats - is a single immutable value. Switching
  means a new collector.
- Its **filters** decide which conversations it applies to. Conditions combine as
  an OR of groups, with conditions inside each group combining as AND. Omitting
  filters matches everything.
- It can be parked rather than deleted by setting its status to inactive.

**Collectors only score forward.** A collector attached today says nothing about
last month, which is the most common surprise: a new metric with a new collector
and a new chart shows an empty chart, correctly. Scoring the past is a separate,
explicit backfill over recent conversations, and it is real background work.

## From a question to a chart

Turning "how often do callers ask about pricing" into live analytics is a chain,
and skipping a link produces a plausible-looking result that is empty or wrong:

1. **Resolve the metric.** Prefer an existing one; author a new one only when
   nothing fits.
2. **Attach a collector** so new conversations get scored going forward.
3. **Add a report** so the values are visible.
4. **Backfill** so the chart is not empty until traffic arrives.

## Evaluators

Evaluators are the older, block-based grading system - custom prompts, data field
checks, sentiment, latency, tool calls - assembled into a grader. They can still
be attached to a run plan, and a plan is validly graded by evaluators alone. New
work should use metrics.
