#!/usr/bin/env node
/**
 * Boots the code tool's real Deno sandbox against the built `dist/` and asserts it works.
 *
 * The unit tests in tests/code-tool.test.ts cover the flags we hand Deno. They cannot
 * cover the thing that actually broke production: whether Deno ACCEPTS them. A
 * `--allow-net=unix:/tmp/....sock` entry is a well-formed string and made a perfectly
 * reasonable-looking fixture, but Deno parses every --allow-net entry as `host[:port]`
 * and exited with "invalid port" before serving anything. The published image was green
 * the whole way: it built, it booted, `deno --version` ran, and every `execute` call
 * failed with "Deno exited before being ready".
 *
 * So this runs the tool for real. It executes no network call, so it needs no
 * credentials and no live API: getting a value back is the whole assertion.
 *
 * Runs against dist rather than src because @valtown/deno-http-worker is ESM-only and
 * dynamically imported, which Jest's transform cannot load; dist is also the artifact
 * that ships.
 */
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

try {
  execSync('command -v deno', { stdio: 'ignore' });
} catch {
  console.error('deno is required for this check. Install it from https://deno.land');
  process.exit(1);
}

const { codeTool } = await import('../dist/code-tool.mjs');
const { configureLogger } = await import('../dist/logger.mjs');
const { default: Roark } = await import('@roarkanalytics/sdk');

configureLogger({ level: 'silent', pretty: false });

/** The text the tool returned, unwrapped from the MCP content blocks. */
const textOf = (result) =>
  (result.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

const runCode = (code) =>
  codeTool({ blockedMethods: undefined, codeExecutionMode: 'local' }).handler({
    reqContext: {
      client: new Roark({ bearerToken: 'not-used-no-request-is-made', baseURL: 'https://api.roark.ai' }),
      project: undefined,
    },
    args: { code },
  });

const boots = await runCode('async function run(client) { return { sum: 1 + 1 } }');
assert.ok(!boots.isError, `the Deno sandbox did not start: ${textOf(boots)}`);
assert.deepEqual(
  JSON.parse(textOf(boots)),
  { sum: 2 },
  'the sandbox started but did not return the value the code produced',
);
console.log('✓ the Deno sandbox boots and returns a result');

// The --allow-net allowlist is the sandbox's containment. Losing it would not fail the
// check above, so assert it separately rather than trusting the flag is still there.
const egress = await runCode(`async function run(client) {
  try { await fetch('https://example.com'); return { escaped: true } }
  catch (e) { return { escaped: false, error: String(e) } }
}`);
assert.equal(
  JSON.parse(textOf(egress)).escaped,
  false,
  `the sandbox reached a host outside the API allowlist: ${textOf(egress)}`,
);
console.log('✓ the Deno sandbox cannot reach hosts outside the API allowlist');
