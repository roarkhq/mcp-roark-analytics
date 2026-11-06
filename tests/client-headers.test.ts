import { MCP_CLIENT_HEADERS, MCP_SERVER_VERSION } from '../src/client-headers';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pkg from '../package.json';

describe('MCP_CLIENT_HEADERS', () => {
  it('names the MCP server and its released version, which the API reads to count MCP usage', () => {
    expect(MCP_CLIENT_HEADERS['X-Roark-Client']).toBe(`mcp/${pkg.version}`);
    expect(MCP_SERVER_VERSION).toBe(pkg.version);
  });

  it('matches the version server.ts reports, which publish.yml checks in the build', () => {
    const server = readFileSync(join(__dirname, '..', 'src', 'server.ts'), 'utf8');
    expect(server).toContain(`version: '${pkg.version}', // x-release-please-version`);
  });
});
