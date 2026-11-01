# AGENTS.md

Guidance for AI coding agents (Claude Code, Codex, Cursor, etc.) working in this repository.

## What this is

`@roarkanalytics/sdk-mcp`, the Roark MCP server: the local stdio/HTTP code-execution server (`execute`,
`search_docs`), the remote OAuth server, and its named directory tools. It depends on the published
`@roarkanalytics/sdk`. The runtime started as Stainless output; it is now maintained here by hand, except
for four generated regions.

## Generated regions: never hand-edit

[`app-agent-codegen`](https://github.com/roarkhq/app-agent-codegen) (the `mcp` target) splices one region
into each of four files and opens a PR here (`automation/mcp-update`) when the API changes. A hand edit
inside a region is overwritten by the next regeneration, and until then the codegen review's "Reproducible
from the spec" gate fails.

| File                       | Generated region                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------ |
| `src/methods.ts`           | the entries of `export const sdkMethods: SdkMethod[] = [ ... ];` (the tool table)    |
| `src/local-docs-search.ts` | the entries of `const EMBEDDED_METHODS: MethodEntry[] = [ ... ];` (the docs index)   |
| `src/code-tool-worker.ts`  | the method names inside `const fuse = new Fuse([ ... ],` (the "did you mean" corpus) |
| `src/code-tool.ts`         | the fenced `async function run(client) { ... }` worked example in the prompt         |

Plus `package.json` `dependencies["@roarkanalytics/sdk"]` and `pnpm-lock.yaml`, which codegen's `open-pr`
raises (SDK floor sync) when the tool table names a method an older SDK lacks. Do not lower the range by
hand.

Rules for the four files:

- Everything outside the region is hand-written (the allow/block filtering in `methods.ts`, the MiniSearch
  wiring in `local-docs-search.ts`, the worker and the prompt around the example).
- Do not rename, reformat or move the anchors above. The splice finds them by exact text and throws
  when it cannot.
- After splicing, codegen runs prettier over the whole file. Hand edits anywhere in these files must
  already be prettier-clean, or regeneration produces a diff and the reproducibility gate fails.

Verified against `src/generate-mcp.ts`, `src/emit/mcp-*.ts`, `src/targets.ts` (the `mcp` target owns no
directory, so codegen never deletes a file here) and `src/sdk-floor-sync.ts` in app-agent-codegen, and by
running `apply --target mcp --dry-run` against this repository: it touches only these four paths.

### How to change generated output

- What a region contains or how it is laid out: change the emitter in app-agent-codegen
  (`src/emit/mcp-methods.ts`, `mcp-docs-search.ts`, `mcp-code-tool-worker.ts`, `mcp-code-tool.ts`).
- Which methods exist, their names, or the headline endpoint used for the worked example: change
  `sdk.yml` in `app-roark-analytics`.
- A method's description or parameters (what the docs index says): change the spec in
  `app-roark-analytics`.

A renamed tool is a breaking change (the caller is a model reading tool names), pinned in codegen's
`mcp-tools.snapshot.txt`.

## Hand-written files

Everything else in `src/` (`server.ts`, `http.ts`, `stdio.ts`, `auth.ts`, `oauth.ts`, `options.ts`,
`directory-tools.ts`, `docs-search-tool.ts`, `instructions.ts`, `types.ts`, ...), `tests/`, `scripts/`,
`plugins/` and `.claude-plugin/` (agent skills), `examples/`, `manifest.json`, `Dockerfile` and the
configs. Many still carry a "File generated from our OpenAPI spec by Stainless" header; it is stale, the
files are ours. `src/client-headers.ts`, `CHANGELOG.md` and the version literals belong to release-please
and `scripts/sync-version.cjs`.

**SDK types in hand-written files:** import from the package root (`import { type Roark } from
'@roarkanalytics/sdk'`) and derive what you need, e.g.
`NonNullable<Parameters<Roark['call']['list']>[0]>`, as `src/directory-tools.ts` does. Do not deep-import
`@roarkanalytics/sdk/resources/*`: this package typechecks with `moduleResolution: node`, and codegen's
typecheck gate links an SDK built from the spec whose subpaths exist only in the exports map, so those
imports fail there (#226).

## Commands

- `pnpm install --frozen-lockfile`
- `pnpm typecheck` (`tsc --noEmit`), `pnpm test` (jest), `pnpm lint` (`eslint . && prettier --check .`),
  `pnpm build`. CI runs all of them plus the Deno sandbox and SDK-floor checks; run the four before every
  push. `pnpm fix` applies eslint and prettier fixes.

Formatting is enforced by `.prettierrc.json`: single quotes, `printWidth` 110, trailing commas,
`experimentalTernaries`. It does not set `semi: false`, so prettier keeps **semicolons** in this repository
and `pnpm lint` fails without them. Follow the config, not the house no-semicolon default.

## Code structure (hand-written files)

- **Arrow functions only**: `const foo = () => {}`, never `function foo() {}`. No classes; group related
  functions in a module (or a namespace object).
- **kebab-case** file and folder names.
- **Types** go in a `types.ts` (or `<feature>-types.ts`, as `code-tool-types.ts` does). Do not declare
  `interface`/`type` in implementation files, including named input and return shapes. Zod schemas and
  their inferred types go in `schema.ts`.
- **Pure helpers** go in a `helpers.ts`, never inlined into the file doing IO.
- **Separate IO from decisions.** SDK calls, `fetch`, `fs` and process spawning sit at the edge; the logic
  takes plain data or injected functions so it is testable without a network.
- **No duplication.** Before writing a helper, type or parser, search `src/` (`util.ts`, `types.ts`) for an
  existing one and reuse or extract a shared one.
- **Never hand-roll a type that exists canonically.** Derive from the SDK or `src/types.ts` with `Pick`,
  `Omit`, `Extract` or `Parameters<...>`; never retype an SDK param shape.
- **No `any`.** Use `unknown` and narrow.
- **Static imports only**; no `await import(...)` in new code.

## Tests

- Tests live in `tests/<file>.test.ts`, mirroring `src/<file>.ts`. Not beside the source: everything under
  `src/` is compiled into the published package.
- A test for a fix must fail when the fix is reverted. Revert it locally and watch it go red before you
  push.

## Copy

No em dashes in user-facing text you write: tool names and descriptions, server instructions, error
messages and skill prose. Use a colon, a comma or a new sentence. Method descriptions in the generated docs
index come from the spec; fix them there.
