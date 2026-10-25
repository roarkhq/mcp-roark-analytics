// Kept in step with package.json by scripts/sync-version.cjs, which `pnpm build` runs.
export const MCP_SERVER_VERSION = '4.33.0'; // x-release-please-version

/**
 * Sent on every request the server's SDK clients make, including the sandbox that
 * runs model-written code. The SDK's user agent is the same for every program built
 * on it, so this is how the API tells MCP traffic from direct SDK use.
 */
export const MCP_CLIENT_HEADERS = {
  'X-Roark-Client': `mcp/${MCP_SERVER_VERSION}`,
} as const;
