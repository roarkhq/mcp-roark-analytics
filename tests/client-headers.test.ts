import { MCP_CLIENT_HEADERS, MCP_SERVER_VERSION } from '../src/client-headers';
import pkg from '../package.json';

describe('MCP_CLIENT_HEADERS', () => {
  it('names the MCP server and its released version, which the API reads to count MCP usage', () => {
    expect(MCP_CLIENT_HEADERS['X-Roark-Client']).toBe(`mcp/${pkg.version}`);
    expect(MCP_SERVER_VERSION).toBe(pkg.version);
  });
});
