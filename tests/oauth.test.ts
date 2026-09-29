import { IncomingMessage } from 'node:http';
import {
  clearBearerVerdictCache,
  DEFAULT_API_BASE_URL,
  resolveApiBaseUrl,
  protectedResourceMetadata,
  protectedResourceMetadataUrl,
  requireBearer,
  requireLiveBearer,
  resourceIdentifier,
  UnauthorizedError,
  verifyBearer,
} from '../src/oauth';

const config = { issuer: 'https://mcp-oauth.api.test/', resourceBaseUrl: 'https://mcp.api.test/' };
const PROJECT = '3f2b7c9e-1d4a-4b6c-9e8f-0a1b2c3d4e5f';
const PINNED = { kind: 'project', projectId: PROJECT } as const;
const UNPINNED = { kind: 'mcp' } as const;

const request = (headers: Record<string, string> = {}): IncomingMessage => ({ headers }) as IncomingMessage;

describe('protected resource metadata', () => {
  it('names the server origin as the resource and points at the authorization server', () => {
    expect(protectedResourceMetadata(config)).toEqual({
      resource: 'https://mcp.api.test',
      authorization_servers: ['https://mcp-oauth.api.test'],
      bearer_methods_supported: ['header'],
      scopes_supported: ['mcp'],
      resource_documentation: 'https://docs.roark.ai',
    });
  });

  it('scopes the resource to the project for a pinned connector URL', () => {
    expect(resourceIdentifier(config, PINNED)).toBe(`https://mcp.api.test/mcp/${PROJECT}`);
    expect(protectedResourceMetadata(config, PINNED).resource).toBe(`https://mcp.api.test/mcp/${PROJECT}`);
    expect(protectedResourceMetadataUrl(config, PINNED)).toBe(
      `https://mcp.api.test/.well-known/oauth-protected-resource/mcp/${PROJECT}`,
    );
    expect(protectedResourceMetadataUrl(config)).toBe(
      'https://mcp.api.test/.well-known/oauth-protected-resource',
    );
  });

  it('names the unpinned connector without a project, which is what asks for a user credential', () => {
    // The distinction the authorization server reads: a `resource` of `<base>/mcp/<id>` is a
    // request for that project, `<base>/mcp` is a request to act as the person. The bare origin
    // is neither, and stays the legacy transport.
    expect(resourceIdentifier(config, UNPINNED)).toBe('https://mcp.api.test/mcp');
    expect(protectedResourceMetadata(config, UNPINNED).resource).toBe('https://mcp.api.test/mcp');
    expect(protectedResourceMetadataUrl(config, UNPINNED)).toBe(
      'https://mcp.api.test/.well-known/oauth-protected-resource/mcp',
    );
    expect(resourceIdentifier(config)).toBe('https://mcp.api.test');
  });
});

describe('requireBearer', () => {
  it('forwards the bearer to the SDK unchanged', () => {
    expect(requireBearer(request({ authorization: 'Bearer roark_abc' }), config)).toEqual({
      bearerToken: 'roark_abc',
    });
  });

  it('pins the SDK project on a pinned connector, and sets none on the unpinned one', () => {
    // The pinned URL must actually constrain a user-scoped credential, not just decorate the
    // metadata. On the unpinned connector `project` is absent entirely, so the SDK sends no
    // project header and code written in the execution tool picks one per call.
    expect(requireBearer(request({ authorization: 'Bearer roark_abc' }), config, PINNED)).toEqual({
      bearerToken: 'roark_abc',
      project: PROJECT,
    });
    expect(requireBearer(request({ authorization: 'Bearer roark_abc' }), config, UNPINNED)).toEqual({
      bearerToken: 'roark_abc',
    });
  });

  it('answers a missing or malformed bearer with a 401 challenge pointing at the metadata', () => {
    for (const headers of [{}, { authorization: 'Basic xyz' }, { authorization: 'Bearer ' }]) {
      let caught: unknown;
      try {
        requireBearer(request(headers), config, PINNED);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(UnauthorizedError);
      const err = caught as UnauthorizedError;
      expect(err.status).toBe(401);
      expect(err.wwwAuthenticate).toBe(
        `Bearer resource_metadata="https://mcp.api.test/.well-known/oauth-protected-resource/mcp/${PROJECT}"`,
      );
    }
  });
});

/* The resource server used to check only that a bearer was PRESENT. A revoked, expired or
   entirely invented token completed `initialize` and `tools/list`; the caller learned nothing
   until a tool call failed with an opaque 401 inside its result text. No data was reachable,
   because every data path revalidates at customer-api, but a client that never sees a 401 from
   the resource server has no reason to re-run the OAuth flow. */
describe('verifyBearer', () => {
  const baseURL = 'https://api.roark.ai';
  const respond = (status: number) => () => Promise.resolve(new Response(null, { status }));

  beforeEach(() => clearBearerVerdictCache());

  it('asks /v1/me, carrying the bearer', async () => {
    const fetchImpl = jest.fn(respond(200));

    await verifyBearer('tok-live', { baseURL: 'https://api.roark.ai/', fetchImpl: fetchImpl as any });

    // Trailing slash on the base URL must not produce `//v1/me`.
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.roark.ai/v1/me',
      expect.objectContaining({ headers: { Authorization: 'Bearer tok-live' } }),
    );
  });

  it('calls a 401 invalid', async () => {
    expect(await verifyBearer('tok-revoked', { baseURL, fetchImpl: respond(401) as any })).toBe('invalid');
  });

  it('calls a 2xx valid', async () => {
    expect(await verifyBearer('tok-live', { baseURL, fetchImpl: respond(200) as any })).toBe('valid');
  });

  /* A 403 means the token authenticated and then failed a permission check. That is a live
     token, and telling the client to re-authorize cannot help it. */
  it('does not call a 403 invalid', async () => {
    expect(await verifyBearer('tok-forbidden', { baseURL, fetchImpl: respond(403) as any })).toBe('unknown');
  });

  it.each([500, 502, 503])('reports unknown on a %s rather than guessing', async (status) => {
    expect(await verifyBearer(`tok-${status}`, { baseURL, fetchImpl: respond(status) as any })).toBe(
      'unknown',
    );
  });

  it('reports unknown when customer-api cannot be reached', async () => {
    const fetchImpl = () => Promise.reject(new Error('ECONNREFUSED'));
    expect(await verifyBearer('tok-offline', { baseURL, fetchImpl: fetchImpl as any })).toBe('unknown');
  });

  /* `newServer` runs per POST, not per session, so an uncached check would add a round trip to
     every MCP request. */
  it('reuses a verdict within the TTL instead of asking again', async () => {
    const fetchImpl = jest.fn(respond(200));
    const deps = { baseURL, fetchImpl: fetchImpl as any, now: () => 1_000, ttlMs: 60_000 };

    await verifyBearer('tok-cached', deps);
    await verifyBearer('tok-cached', deps);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('asks again once the verdict has expired', async () => {
    const fetchImpl = jest.fn(respond(200));
    const at = (t: number) => ({ baseURL, fetchImpl: fetchImpl as any, now: () => t, ttlMs: 60_000 });

    await verifyBearer('tok-expiring', at(1_000));
    await verifyBearer('tok-expiring', at(1_000 + 60_001));

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  /* An unknown must not be cached: a blip would otherwise pin the answer for the whole TTL. */
  /* customer-api can accept a connection and then never answer. Without a deadline every MCP
     request would hang on this check, which is worse than the failure it exists to report. */
  it('gives up on a hanging customer-api and reports unknown', async () => {
    const fetchImpl = (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });

    expect(await verifyBearer('tok-hanging', { baseURL, fetchImpl: fetchImpl as any, timeoutMs: 20 })).toBe(
      'unknown',
    );
  }, 5_000);

  it('passes an abort signal so the request can actually be cut off', async () => {
    const fetchImpl = jest.fn((_url: string, _init: RequestInit) =>
      Promise.resolve(new Response(null, { status: 200 })),
    );

    await verifyBearer('tok-signal', { baseURL, fetchImpl: fetchImpl as any });

    expect(fetchImpl.mock.calls[0]![1]).toMatchObject({ signal: expect.any(AbortSignal) });
  });

  /* Two requests arriving with the same uncached token should cost one round trip, not two.
     That is the shape right after a verdict expires, and whenever a client fires in parallel. */
  it('collapses concurrent checks of the same token into one call', async () => {
    let release: (r: Response) => void = () => {};
    const fetchImpl = jest.fn(() => new Promise<Response>((resolve) => (release = resolve)));
    const deps = { baseURL, fetchImpl: fetchImpl as any };

    const both = Promise.all([verifyBearer('tok-parallel', deps), verifyBearer('tok-parallel', deps)]);
    release(new Response(null, { status: 200 }));

    expect(await both).toEqual(['valid', 'valid']);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not cache an unknown', async () => {
    const fetchImpl = jest.fn(respond(503));
    const deps = { baseURL, fetchImpl: fetchImpl as any };

    await verifyBearer('tok-blip', deps);
    await verifyBearer('tok-blip', deps);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  /* The cap used to be enforced with `clear()`, which let anyone spraying invented tokens flush
     every valid verdict as well: legitimate callers then pay a round trip each, and customer-api
     picks up the work. Evicting only the oldest keeps recent verdicts alive under that pressure. */
  it('evicts the oldest verdict at the cap instead of flushing the cache', async () => {
    const fetchImpl = jest.fn(respond(200));
    const deps = { baseURL, fetchImpl: fetchImpl as any };
    const CAP = 1_000;

    for (let i = 0; i < CAP; i++) await verifyBearer(`tok-${i}`, deps);
    expect(fetchImpl).toHaveBeenCalledTimes(CAP);

    // One past the cap: this evicts exactly one entry, the oldest.
    await verifyBearer('tok-overflow', deps);
    expect(fetchImpl).toHaveBeenCalledTimes(CAP + 1);

    // The oldest is gone, so it costs a round trip. (Re-adding it evicts the next-oldest in
    // turn, which is why the survivor checked below is a recent one rather than tok-1.)
    await verifyBearer('tok-0', deps);
    expect(fetchImpl).toHaveBeenCalledTimes(CAP + 2);

    // A recent verdict survived the overflow, which a clear() would not have allowed.
    await verifyBearer('tok-999', deps);
    expect(fetchImpl).toHaveBeenCalledTimes(CAP + 2);
  }, 20_000);

  it('keeps verdicts separate per token', async () => {
    const fetchImpl = jest.fn((url: string, init: RequestInit) =>
      Promise.resolve(
        new Response(null, {
          status: (init.headers as Record<string, string>)['Authorization'] === 'Bearer good' ? 200 : 401,
        }),
      ),
    );
    const deps = { baseURL, fetchImpl: fetchImpl as any };

    expect(await verifyBearer('good', deps)).toBe('valid');
    expect(await verifyBearer('bad', deps)).toBe('invalid');
  });
});

describe('requireLiveBearer', () => {
  const config = { issuer: 'https://mcp-oauth.api.roark.ai', resourceBaseUrl: 'https://mcp.api.roark.ai' };
  const connector = { kind: 'project' as const, projectId: 'proj-1' };
  const baseURL = 'https://api.roark.ai';
  const respond = (status: number) => () => Promise.resolve(new Response(null, { status }));

  beforeEach(() => clearBearerVerdictCache());

  it('rejects a revoked token with a challenge a client can act on', async () => {
    const attempt = requireLiveBearer('tok-revoked', config, connector, {
      baseURL,
      fetchImpl: respond(401) as any,
    });

    await expect(attempt).rejects.toThrow(UnauthorizedError);
    await expect(attempt).rejects.toMatchObject({
      status: 401,
      // The client needs both: where to re-discover the authorization server, and why.
      wwwAuthenticate: expect.stringContaining(
        'resource_metadata="https://mcp.api.roark.ai/.well-known/oauth-protected-resource/mcp/proj-1"',
      ),
    });
    await expect(attempt).rejects.toMatchObject({
      wwwAuthenticate: expect.stringContaining('error="invalid_token"'),
    });
  });

  it('lets a live token through', async () => {
    await expect(
      requireLiveBearer('tok-live', config, connector, { baseURL, fetchImpl: respond(200) as any }),
    ).resolves.toBeUndefined();
  });

  /* Failing closed would turn a customer-api blip into a dead connector for everyone, and buy no
     confidentiality: the token still has to pass customer-api on the next call that touches data. */
  it('lets a token through when customer-api could not be asked', async () => {
    await expect(
      requireLiveBearer('tok-blip', config, connector, {
        baseURL,
        fetchImpl: (() => Promise.reject(new Error('ECONNREFUSED'))) as any,
      }),
    ).resolves.toBeUndefined();
  });
});

/* The deployed server is launched without `clientOptions` (see `launchStreamableHTTPServer`), so
   this resolution is the only thing standing between the liveness check and the wrong host. A
   hardcoded prod default would check tokens against prod while data calls went to whatever
   ROARK_BASE_URL names, and every request on a non-prod stage would be refused. */
describe('resolveApiBaseUrl', () => {
  const original = process.env['ROARK_BASE_URL'];
  afterEach(() => {
    if (original === undefined) delete process.env['ROARK_BASE_URL'];
    else process.env['ROARK_BASE_URL'] = original;
  });

  it('reads ROARK_BASE_URL when no option is given, which is the deployed case', () => {
    process.env['ROARK_BASE_URL'] = 'https://api.beta.roark.ai';

    expect(resolveApiBaseUrl({})).toBe('https://api.beta.roark.ai');
    expect(resolveApiBaseUrl()).toBe('https://api.beta.roark.ai');
  });

  /* Same precedence as the SDK constructor: an explicit option beats the environment. */
  it('prefers an explicit option over the environment', () => {
    process.env['ROARK_BASE_URL'] = 'https://api.beta.roark.ai';

    expect(resolveApiBaseUrl({ baseURL: 'https://api.self-hosted.example' })).toBe(
      'https://api.self-hosted.example',
    );
  });

  it('falls back to the default only when neither names one', () => {
    delete process.env['ROARK_BASE_URL'];

    expect(resolveApiBaseUrl({})).toBe(DEFAULT_API_BASE_URL);
  });
});
