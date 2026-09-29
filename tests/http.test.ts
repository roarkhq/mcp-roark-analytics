import * as fs from 'node:fs';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { streamableHTTPApp } from '../src/http';
import { configureLogger } from '../src/logger';
import { clearBearerVerdictCache } from '../src/oauth';
import { McpOptions } from '../src/options';

// Exercises the Express wiring in `streamableHTTPApp` over a real socket, rather
// than the oauth helpers in isolation (tests/oauth.test.ts does that). This is
// what catches a wiring regression: a route that stops being mounted, an
// `UnauthorizedError` that stops being translated into a 401, or a challenge
// header a browser client can no longer read.

const OAUTH = { issuer: 'https://mcp-oauth.api.test', resourceBaseUrl: 'https://mcp.api.test' };
const PROJECT = '3f2b7c9e-1d4a-4b6c-9e8f-0a1b2c3d4e5f';

// `newMcpServer` fetches the instructions document from the Stainless API unless
// a local path is configured. Pointing at a temp file keeps every test in this
// file offline and deterministic.
const instructionsPath = path.join(os.tmpdir(), `mcp-http-test-instructions-${process.pid}.md`);

const baseOptions: McpOptions = {
  codeExecutionMode: 'local',
  docsSearchMode: 'local',
  customInstructionsPath: instructionsPath,
};

// The one bearer this file's stubbed customer-api recognises.
const LIVE_TOKEN = 'roark_test_key';
const REVOKED_TOKEN = 'roark_revoked_key';

const INITIALIZE = {
  jsonrpc: '2.0',
  id: 7,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '0.0.0' },
  },
};

const servers: Server[] = [];

/** Boots the app on an ephemeral port and returns a fetch bound to its origin. */
const serve = async (mcpOptions: McpOptions) => {
  const server = await new Promise<Server>((resolve) => {
    const s = streamableHTTPApp({ mcpOptions }).listen(0, () => resolve(s));
  });
  servers.push(server);
  const { port } = server.address() as AddressInfo;
  return (path: string, init?: RequestInit) => fetch(`http://127.0.0.1:${port}${path}`, init);
};

const postJson = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers },
  body: JSON.stringify(body),
});

// The transport now asks customer-api whether the bearer is still live. Answer `/v1/me` here so
// this file stays offline, and pass everything else - the tests' own loopback requests - straight
// through to the real fetch.
const realFetch = globalThis.fetch;

beforeAll(() => {
  // 'fatal' keeps pino-http's per-request lines out of the test output.
  configureLogger({ level: 'fatal', pretty: false });
  fs.writeFileSync(instructionsPath, 'test instructions');

  globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input
      : input instanceof URL ? input.href
      : input.url;
    if (url.endsWith('/v1/me')) {
      const authorization = new Headers(init?.headers).get('authorization');
      return Promise.resolve(
        new Response(null, { status: authorization === `Bearer ${LIVE_TOKEN}` ? 200 : 401 }),
      );
    }
    return realFetch(input, init);
  }) as typeof fetch;
});

// Verdicts are cached per token for a minute, and every test here shares the process.
beforeEach(() => clearBearerVerdictCache());

afterAll(async () => {
  globalThis.fetch = realFetch;
  await Promise.all(servers.map((s) => new Promise<void>((resolve) => s.close(() => resolve()))));
  fs.rmSync(instructionsPath, { force: true });
});

describe('remote OAuth mode', () => {
  const options: McpOptions = { ...baseOptions, oauth: OAUTH };

  it('answers an unauthenticated MCP request with a 401 challenge, not a 500', async () => {
    const request = await serve(options);
    const res = await request('/', postJson(INITIALIZE));

    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBe(
      'Bearer resource_metadata="https://mcp.api.test/.well-known/oauth-protected-resource"',
    );
    expect(await res.json()).toEqual({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Missing bearer token' },
      id: 7,
    });
  });

  it('points the challenge at the project connector when one is in the path', async () => {
    const request = await serve(options);
    const res = await request(`/mcp/${PROJECT}`, postJson(INITIALIZE));

    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBe(
      `Bearer resource_metadata="https://mcp.api.test/.well-known/oauth-protected-resource/mcp/${PROJECT}"`,
    );
  });

  it('serves the MCP request once a live bearer is present', async () => {
    const request = await serve(options);
    const res = await request(
      `/mcp/${PROJECT}`,
      postJson(INITIALIZE, { authorization: `Bearer ${LIVE_TOKEN}` }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('www-authenticate')).toBeNull();
    expect(await res.text()).toContain('"serverInfo"');
  });

  /* Presence used to be the whole check, so a revoked, expired or invented token completed the
     handshake and listed the tools. No data was reachable - every data path revalidates at
     customer-api - but a client that never sees a 401 from the resource server has no reason to
     re-run the OAuth flow, so a 24h token turned into a connector that looked connected and
     silently could not work. */
  it('rejects a bearer customer-api has disowned, with a challenge naming the reason', async () => {
    const request = await serve(options);
    const res = await request(
      `/mcp/${PROJECT}`,
      postJson(INITIALIZE, { authorization: `Bearer ${REVOKED_TOKEN}` }),
    );

    expect(res.status).toBe(401);
    const challenge = res.headers.get('www-authenticate') ?? '';
    expect(challenge).toContain(
      `resource_metadata="https://mcp.api.test/.well-known/oauth-protected-resource/mcp/${PROJECT}"`,
    );
    expect(challenge).toContain('error="invalid_token"');
    expect(await res.text()).not.toContain('"serverInfo"');
  });

  it('lets a browser client read the challenge and the session header cross-origin', async () => {
    const request = await serve(options);
    const res = await request('/', postJson(INITIALIZE, { origin: 'https://claude.ai' }));

    expect(res.headers.get('access-control-allow-origin')).toBe('https://claude.ai');
    const exposed = (res.headers.get('access-control-expose-headers') ?? '').toLowerCase();
    expect(exposed).toContain('www-authenticate');
    expect(exposed).toContain('mcp-session-id');
  });

  it('serves protected resource metadata for the server origin', async () => {
    const request = await serve(options);
    const res = await request('/.well-known/oauth-protected-resource');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      resource: 'https://mcp.api.test',
      authorization_servers: ['https://mcp-oauth.api.test'],
      bearer_methods_supported: ['header'],
      scopes_supported: ['mcp'],
      resource_documentation: 'https://docs.roark.ai',
    });
  });

  it('points the challenge at the unpinned connector, with no project in the resource', async () => {
    // The single connector a person adds once. Its `resource` carries no project, which is the
    // signal the authorization server reads to mint a credential for the person.
    const request = await serve(options);
    const res = await request('/mcp', postJson(INITIALIZE));

    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBe(
      'Bearer resource_metadata="https://mcp.api.test/.well-known/oauth-protected-resource/mcp"',
    );
  });

  it('serves the unpinned connector once a bearer is present', async () => {
    const request = await serve(options);
    const res = await request('/mcp', postJson(INITIALIZE, { authorization: 'Bearer roark_test_key' }));

    expect(res.status).toBe(200);
    expect(await res.text()).toContain('"serverInfo"');
  });

  it('serves unpinned metadata, and does not mistake /mcp for an empty project id', async () => {
    // Registration order matters: `/mcp/:projectId` would otherwise be a candidate match for a
    // bare `/mcp`, and the resource would come out as `<base>/mcp/` with a trailing slash.
    const request = await serve(options);
    const res = await request('/.well-known/oauth-protected-resource/mcp');

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      resource: 'https://mcp.api.test/mcp',
      authorization_servers: ['https://mcp-oauth.api.test'],
    });
  });

  it('serves project-scoped metadata whose resource matches the connector URL', async () => {
    const request = await serve(options);
    const res = await request(`/.well-known/oauth-protected-resource/mcp/${PROJECT}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      resource: `https://mcp.api.test/mcp/${PROJECT}`,
      authorization_servers: ['https://mcp-oauth.api.test'],
    });
  });
});

describe('legacy mode', () => {
  it('does not advertise an authorization server when oauth is unconfigured', async () => {
    const request = await serve(baseOptions);

    expect((await request('/.well-known/oauth-protected-resource')).status).toBe(404);
    expect((await request('/.well-known/oauth-protected-resource/mcp')).status).toBe(404);
    expect((await request(`/.well-known/oauth-protected-resource/mcp/${PROJECT}`)).status).toBe(404);
  });

  it('still serves a request with no Authorization header', async () => {
    const request = await serve(baseOptions);
    const res = await request('/', postJson(INITIALIZE));

    expect(res.status).toBe(200);
    expect(res.headers.get('www-authenticate')).toBeNull();
  });

  it('serves the unpinned connector path too, so a local install can use one URL', async () => {
    const request = await serve(baseOptions);
    const res = await request('/mcp', postJson(INITIALIZE));

    expect(res.status).toBe(200);
  });
});
