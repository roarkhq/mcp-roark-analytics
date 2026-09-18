import { parseCLIOptions } from '../src/options';

// Mock process.argv
const mockArgv = (args: string[]) => {
  const originalArgv = process.argv;
  process.argv = ['node', 'test.js', ...args];
  return () => {
    process.argv = originalArgv;
  };
};

describe('parseCLIOptions', () => {
  it('default parsing should be stdio', () => {
    const cleanup = mockArgv([]);

    const result = parseCLIOptions();

    expect(result.transport).toBe('stdio');

    cleanup();
  });

  it('using http transport with a port', () => {
    const cleanup = mockArgv(['--transport=http', '--port=2222']);

    const result = parseCLIOptions();

    expect(result.transport).toBe('http');
    expect(result.port).toBe(2222);
    cleanup();
  });
});

describe('code execution mode', () => {
  it('defaults to running code locally', () => {
    const cleanup = mockArgv([]);

    expect(parseCLIOptions().codeExecutionMode).toBe('local');

    cleanup();
  });

  it('rejects the retired Stainless sandbox with an actionable message', () => {
    const cleanup = mockArgv(['--code-execution-mode=stainless-sandbox']);

    expect(() => parseCLIOptions()).toThrow(/no longer available/);

    cleanup();
  });
});

describe('docs search mode', () => {
  it('defaults to the index shipped with this package', () => {
    const cleanup = mockArgv([]);

    expect(parseCLIOptions().docsSearchMode).toBe('local');

    cleanup();
  });

  it('still allows opting back into the Stainless-hosted search', () => {
    const cleanup = mockArgv(['--docs-search-mode=stainless-api']);

    expect(parseCLIOptions().docsSearchMode).toBe('stainless-api');

    cleanup();
  });
});

describe('remote OAuth resource-server mode', () => {
  const OAUTH_ENV = ['MCP_OAUTH_ISSUER', 'MCP_OAUTH_RESOURCE_BASE_URL'] as const;
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = Object.fromEntries(OAUTH_ENV.map((key) => [key, process.env[key]]));
    for (const key of OAUTH_ENV) delete process.env[key];
  });

  afterEach(() => {
    for (const key of OAUTH_ENV) {
      const value = savedEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('stays off by default, leaving the server in legacy optional-bearer mode', () => {
    const cleanup = mockArgv([]);

    expect(parseCLIOptions().oauth).toBeUndefined();

    cleanup();
  });

  it('turns on when both the issuer and this server public base URL are given', () => {
    const cleanup = mockArgv([
      '--oauth-issuer=https://mcp-oauth.api.roark.ai',
      '--oauth-resource-base-url=https://mcp.api.roark.ai',
    ]);

    expect(parseCLIOptions().oauth).toEqual({
      issuer: 'https://mcp-oauth.api.roark.ai',
      resourceBaseUrl: 'https://mcp.api.roark.ai',
    });

    cleanup();
  });

  it('reads the same pair from the environment', () => {
    process.env['MCP_OAUTH_ISSUER'] = 'https://mcp-oauth.api.roark.ai';
    process.env['MCP_OAUTH_RESOURCE_BASE_URL'] = 'https://mcp.api.roark.ai';
    const cleanup = mockArgv([]);

    expect(parseCLIOptions().oauth).toEqual({
      issuer: 'https://mcp-oauth.api.roark.ai',
      resourceBaseUrl: 'https://mcp.api.roark.ai',
    });

    cleanup();
  });

  // Half a config would advertise metadata we cannot build URLs for, or demand a
  // bearer while pointing clients at nothing. Both halves or neither.
  it('stays off when only the issuer is set', () => {
    const cleanup = mockArgv(['--oauth-issuer=https://mcp-oauth.api.roark.ai']);

    expect(parseCLIOptions().oauth).toBeUndefined();

    cleanup();
  });

  it('stays off when only the resource base URL is set', () => {
    const cleanup = mockArgv(['--oauth-resource-base-url=https://mcp.api.roark.ai']);

    expect(parseCLIOptions().oauth).toBeUndefined();

    cleanup();
  });
});
