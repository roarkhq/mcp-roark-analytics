// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import qs from 'qs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import z from 'zod';
import { readEnv } from './util';
import type { OAuthConfig } from './oauth';

export type CLIOptions = McpOptions & {
  debug: boolean;
  logFormat: 'json' | 'pretty';
  transport: 'stdio' | 'http';
  port: number | undefined;
  socket: string | undefined;
};

export type McpOptions = {
  includeCodeTool?: boolean | undefined;
  includeDocsTools?: boolean | undefined;
  stainlessApiKey?: string | undefined;
  docsSearchMode?: 'stainless-api' | 'local' | undefined;
  docsDir?: string | undefined;
  codeAllowHttpGets?: boolean | undefined;
  codeAllowedMethods?: string[] | undefined;
  codeBlockedMethods?: string[] | undefined;
  codeExecutionMode: McpCodeExecutionMode;
  customInstructionsPath?: string | undefined;
  /**
   * Remote OAuth resource-server config. When set (http transport), every request
   * must carry a bearer and a missing one is answered with a 401 challenge that
   * points at the authorization server; when unset the server keeps the legacy
   * optional-bearer behavior (local stdio + API-key installs).
   */
  oauth?: OAuthConfig | undefined;
};

export type McpCodeExecutionMode = 'stainless-sandbox' | 'local';

export function parseCLIOptions(): CLIOptions {
  const opts = yargs(hideBin(process.argv))
    .option('code-allow-http-gets', {
      type: 'boolean',
      description:
        'Allow all code tool methods that map to HTTP GET operations. If all code-allow-* flags are unset, then everything is allowed.',
    })
    .option('code-allowed-methods', {
      type: 'string',
      array: true,
      description:
        'Methods to explicitly allow for code tool. Evaluated as regular expressions against method fully qualified names. If all code-allow-* flags are unset, then everything is allowed.',
    })
    .option('code-blocked-methods', {
      type: 'string',
      array: true,
      description:
        'Methods to explicitly block for code tool. Evaluated as regular expressions against method fully qualified names. If all code-allow-* flags are unset, then everything is allowed.',
    })
    .option('code-execution-mode', {
      type: 'string',
      choices: ['stainless-sandbox', 'local'],
      default: 'local',
      description:
        "Where to run code execution in code tool; 'local' executes code on the MCP server machine using Deno. 'stainless-sandbox' has been retired and is rejected.",
    })
    .option('custom-instructions-path', {
      type: 'string',
      description: 'Path to custom instructions for the MCP server',
    })
    .option('debug', { type: 'boolean', description: 'Enable debug logging' })
    .option('docs-dir', {
      type: 'string',
      description:
        'Path to a directory of local documentation files (markdown/JSON) to include in local docs search.',
    })
    .option('docs-search-mode', {
      type: 'string',
      choices: ['stainless-api', 'local'],
      // 'local' by default: the index this package ships is built from the same
      // spec as the rest of it and is current by construction, while the
      // Stainless-hosted one stopped tracking our config when SDK generation
      // moved in-house and now answers "customer flows" with the retired
      // simulationScenario methods and no customer_flow methods at all. Local
      // also needs no network and no Stainless API key, which the hosted path
      // 404s without. 'stainless-api' stays available as an opt-in.
      default: 'local',
      description:
        "Where to search documentation; 'local' (the default) uses an in-memory search index built from embedded SDK method data and optional local docs files, whereas 'stainless-api' uses the Stainless-hosted search API.",
    })
    .option('log-format', {
      type: 'string',
      choices: ['json', 'pretty'],
      description: 'Format for log output; defaults to json unless tty is detected',
    })
    .option('no-tools', {
      type: 'string',
      array: true,
      choices: ['code', 'docs'],
      description: 'Tools to explicitly disable',
    })
    .option('port', {
      type: 'number',
      default: 3000,
      description: 'Port to serve on if using http transport',
    })
    .option('socket', { type: 'string', description: 'Unix socket to serve on if using http transport' })
    .option('stainless-api-key', {
      type: 'string',
      default: readEnv('STAINLESS_API_KEY'),
      description:
        'API key for Stainless. Used to authenticate requests to Stainless-hosted tools endpoints.',
    })
    .option('tools', {
      type: 'string',
      array: true,
      choices: ['code', 'docs'],
      description: 'Tools to explicitly enable',
    })
    .option('transport', {
      type: 'string',
      choices: ['stdio', 'http'],
      default: 'stdio',
      description: 'What transport to use; stdio for local servers or http for remote servers',
    })
    .option('oauth-issuer', {
      type: 'string',
      default: readEnv('MCP_OAUTH_ISSUER'),
      description: 'Authorization server issuer URL. Enables remote OAuth resource-server mode.',
    })
    .option('oauth-resource-base-url', {
      type: 'string',
      default: readEnv('MCP_OAUTH_RESOURCE_BASE_URL'),
      description: 'Public base URL of this resource server, used to build metadata and resource URLs.',
    })
    .env('MCP_SERVER')
    .version(true)
    .help();

  const argv = opts.parseSync();

  const shouldIncludeToolType = (toolType: 'code' | 'docs') =>
    argv.noTools?.includes(toolType) ? false
    : argv.tools?.includes(toolType) ? true
    : undefined;

  const includeCodeTool = shouldIncludeToolType('code');
  const includeDocsTools = shouldIncludeToolType('docs');

  const codeExecutionMode = argv.codeExecutionMode as McpCodeExecutionMode;
  // The choice is still accepted by yargs so that anyone carrying the old flag (or
  // the MCP_SERVER_CODE_EXECUTION_MODE env var) gets told why it stopped working,
  // instead of a request that fails against the retired endpoint at tool-call time.
  if (codeExecutionMode === 'stainless-sandbox') {
    throw new Error(
      "code-execution-mode 'stainless-sandbox' is no longer available: the Stainless-hosted sandbox has been retired. Use 'local', which runs code on this machine with Deno (https://deno.land).",
    );
  }

  const transport = argv.transport as 'stdio' | 'http';
  const logFormat =
    argv.logFormat ? (argv.logFormat as 'json' | 'pretty')
    : process.stderr.isTTY ? 'pretty'
    : 'json';

  // When unset, an http server runs in legacy optional-bearer mode (a static
  // token in the Authorization header). Remote account-based auth needs this set.
  const oauth = buildOAuthConfig(argv);

  return {
    ...(includeCodeTool !== undefined && { includeCodeTool }),
    ...(includeDocsTools !== undefined && { includeDocsTools }),
    debug: !!argv.debug,
    stainlessApiKey: argv.stainlessApiKey,
    docsSearchMode: argv.docsSearchMode as 'stainless-api' | 'local' | undefined,
    docsDir: argv.docsDir,
    codeAllowHttpGets: argv.codeAllowHttpGets,
    codeAllowedMethods: argv.codeAllowedMethods,
    codeBlockedMethods: argv.codeBlockedMethods,
    codeExecutionMode,
    customInstructionsPath: argv.customInstructionsPath,
    ...(oauth && { oauth }),
    transport,
    logFormat,
    port: argv.port,
    socket: argv.socket,
  };
}

/**
 * Assembles the OAuth resource-server config from CLI/env, or returns undefined
 * when either field is absent (legacy optional-bearer mode). Both the issuer and
 * this server's public base URL are required together.
 */
const buildOAuthConfig = (argv: {
  oauthIssuer?: string | undefined;
  oauthResourceBaseUrl?: string | undefined;
}): OAuthConfig | undefined => {
  const { oauthIssuer, oauthResourceBaseUrl } = argv;
  if (!oauthIssuer || !oauthResourceBaseUrl) {
    return undefined;
  }
  return { issuer: oauthIssuer, resourceBaseUrl: oauthResourceBaseUrl };
};

const coerceArray = <T extends z.ZodTypeAny>(zodType: T) =>
  z.preprocess(
    (val) =>
      Array.isArray(val) ? val
      : val ? [val]
      : val,
    z.array(zodType).optional(),
  );

const QueryOptions = z.object({
  tools: coerceArray(z.enum(['code', 'docs'])).describe('Specify which MCP tools to use'),
  no_tools: coerceArray(z.enum(['code', 'docs'])).describe('Specify which MCP tools to not use.'),
  tool: coerceArray(z.string()).describe('Include tools matching the specified names'),
});

export function parseQueryOptions(defaultOptions: McpOptions, query: unknown): McpOptions {
  const queryObject = typeof query === 'string' ? qs.parse(query) : query;
  const queryOptions = QueryOptions.parse(queryObject);

  let codeTool: boolean | undefined =
    queryOptions.no_tools && queryOptions.no_tools?.includes('code') ? false
    : queryOptions.tools?.includes('code') ? true
    : defaultOptions.includeCodeTool;

  let docsTools: boolean | undefined =
    queryOptions.no_tools && queryOptions.no_tools?.includes('docs') ? false
    : queryOptions.tools?.includes('docs') ? true
    : defaultOptions.includeDocsTools;

  return {
    ...(codeTool !== undefined && { includeCodeTool: codeTool }),
    ...(docsTools !== undefined && { includeDocsTools: docsTools }),
    codeExecutionMode: defaultOptions.codeExecutionMode,
    docsSearchMode: defaultOptions.docsSearchMode,
    docsDir: defaultOptions.docsDir,
  };
}
