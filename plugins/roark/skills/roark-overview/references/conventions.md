# Roark API conventions

Cross-cutting rules that apply to every skill. Read once; they prevent whole
classes of mistakes.

## Auth and scoping

- The MCP authenticates with a bearer token from `ROARK_API_BEARER_TOKEN` against
  `https://api.roark.ai`.
- **A token is scoped to one project.** Everything you list or create lives in
  that project. There is no cross-project call; to work in another project you
  need that project's key. Do not assume resources from one project are visible
  in another.
- Some actions need a **permission** on the key, not just a valid token: config
  `apply` needs `config:apply`. A 403 means the key lacks the permission; tell
  the user to grant it rather than working around it.

## Identity and idempotency

- Reuse before you create. Agents match by `name` or `customId`; personas and
  flows by `name`; metrics by `slug`. Search first (`list({ searchText })`) and
  reuse the id, so re-running a setup does not create duplicates.
- `config.apply` is idempotent by construction (keyed by `<kind>/<name>`); the
  imperative `create` calls are not, so guard them with a lookup.

## Pagination

List endpoints are cursor-paginated: pass `limit` (max 50) and `after`, and read
`pagination.nextCursor` / `hasMore` to continue. Do not assume the first page is
everything; loop until `hasMore` is false when you need the full set.

```ts
let after, all = []
do {
  const page = await client.simulationPersona.list({ limit: 50, after })
  all.push(...page.data)
  after = page.pagination.nextCursor
} while (after)
```

## Concurrency and cost

- Simulated calls are **real calls that bill**. Preview counts before starting
  (see `build-run-plan`).
- `maxConcurrentJobs` is capped by the account quota; asking for more does not
  exceed it. Sequential execution modes exist for rate-sensitive agents.

## Errors: surface, do not paper over

- When a call fails schema validation, the error names the offending field. Fix
  that field and retry; do not fall back to raw HTTP or invent a different shape.
- On a 401 (auth) or 403 (permission), stop and tell the user what to fix. Do not
  loop retrying.
- Use the MCP docs search tool to confirm a method's exact signature and
  parameter names when unsure, rather than guessing.

## Dates

Timestamps are ISO 8601 strings. Compare and format them as such.
