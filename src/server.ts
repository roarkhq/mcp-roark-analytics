// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  SetLevelRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ClientOptions } from '@roarkanalytics/sdk';
import Roark from '@roarkanalytics/sdk';
import { codeTool } from './code-tool';
import docsSearchTool from './docs-search-tool';
import { setLocalSearch } from './docs-search-tool';
import { LocalDocsSearch } from './local-docs-search';
import { getInstructions } from './instructions';
import { McpOptions } from './options';
import { blockedMethodsForCodeTool } from './methods';
import { HandlerFunction, McpRequestContext, ToolCallResult, McpTool } from './types';

export const newMcpServer = async ({
  stainlessApiKey,
  customInstructionsPath,
}: {
  stainlessApiKey?: string | undefined;
  customInstructionsPath?: string | undefined;
}) =>
  new McpServer(
    {
      name: 'roarkanalytics_sdk_api',
      version: '3.6.1', // x-release-please-version
    },
    {
      instructions: await getInstructions({ stainlessApiKey, customInstructionsPath }),
      capabilities: { tools: {}, logging: {} },
    },
  );

/**
 * One local docs index per process, keyed by `docsDir`.
 *
 * `LocalDocsSearch.create()` reindexes the whole embedded corpus with
 * MiniSearch. Under `--transport=http` every POST builds a fresh server through
 * `newServer()` -> `initMcpServer()`, so without this the index is rebuilt on
 * every request - including requests that never touch docs search. The corpus
 * is baked into the bundle and cannot change while the process runs, so one
 * instance is correct for its lifetime.
 *
 * The promise is cached rather than the resolved value, so concurrent requests
 * arriving before the first build settles share it instead of racing.
 *
 * A rejection evicts itself. `create()` does have a throwing path:
 * `loadDocsDirectory` catches its own fs errors but then calls `getLogger()`,
 * which throws when `configureLogger()` has not run. Today that is unreachable
 * because `index.ts` configures the logger first - but caching a rejected
 * promise would poison that `docsDir` for the life of the process, and cache
 * correctness should not rest on call ordering in an unrelated file.
 */
const localDocsSearches = new Map<string, Promise<LocalDocsSearch>>();

export const localDocsSearchFor = (docsDir?: string | undefined): Promise<LocalDocsSearch> => {
  const key = docsDir ?? '';
  let search = localDocsSearches.get(key);
  if (!search) {
    search = LocalDocsSearch.create(docsDir ? { docsDir } : undefined).catch((error) => {
      localDocsSearches.delete(key);
      throw error;
    });
    localDocsSearches.set(key, search);
  }
  return search;
};

/**
 * Initializes the provided MCP Server with the given tools and handlers.
 * If not provided, the default client, tools and handlers will be used.
 */
export async function initMcpServer(params: {
  server: Server | McpServer;
  clientOptions?: ClientOptions;
  mcpOptions?: McpOptions;
  stainlessApiKey?: string | undefined;
  upstreamClientEnvs?: Record<string, string> | undefined;
  mcpSessionId?: string | undefined;
  mcpClientInfo?: { name: string; version: string } | undefined;
}) {
  const server = params.server instanceof McpServer ? params.server.server : params.server;

  const logAtLevel =
    (level: 'debug' | 'info' | 'warning' | 'error') =>
    (message: string, ...rest: unknown[]) => {
      void server.sendLoggingMessage({
        level,
        data: { message, rest },
      });
    };
  const logger = {
    debug: logAtLevel('debug'),
    info: logAtLevel('info'),
    warn: logAtLevel('warning'),
    error: logAtLevel('error'),
  };

  if (params.mcpOptions?.docsSearchMode === 'local') {
    setLocalSearch(await localDocsSearchFor(params.mcpOptions?.docsDir));
  }

  let _client: Roark | undefined;
  let _clientError: Error | undefined;
  let _logLevel: 'debug' | 'info' | 'warn' | 'error' | 'off' | undefined;

  const getClient = (): Roark => {
    if (_clientError) throw _clientError;
    if (!_client) {
      try {
        _client = new Roark({
          logger,
          ...params.clientOptions,
          defaultHeaders: {
            ...params.clientOptions?.defaultHeaders,
            'X-Stainless-MCP': 'true',
          },
        });
        if (_logLevel) {
          _client = _client.withOptions({ logLevel: _logLevel });
        }
      } catch (e) {
        _clientError = e instanceof Error ? e : new Error(String(e));
        throw _clientError;
      }
    }
    return _client;
  };

  const providedTools = selectTools(params.mcpOptions);
  const toolMap = Object.fromEntries(providedTools.map((mcpTool) => [mcpTool.tool.name, mcpTool]));

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: providedTools.map((mcpTool) => mcpTool.tool),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const mcpTool = toolMap[name];
    if (!mcpTool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    let client: Roark;
    try {
      client = getClient();
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Failed to initialize client: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }

    return executeHandler({
      handler: mcpTool.handler,
      reqContext: {
        client,
        stainlessApiKey: params.stainlessApiKey ?? params.mcpOptions?.stainlessApiKey,
        upstreamClientEnvs: params.upstreamClientEnvs,
        mcpSessionId: params.mcpSessionId,
        mcpClientInfo: params.mcpClientInfo,
      },
      args,
    });
  });

  server.setRequestHandler(SetLevelRequestSchema, async (request) => {
    const { level } = request.params;
    let logLevel: 'debug' | 'info' | 'warn' | 'error' | 'off';
    switch (level) {
      case 'debug':
        logLevel = 'debug';
        break;
      case 'info':
        logLevel = 'info';
        break;
      case 'notice':
      case 'warning':
        logLevel = 'warn';
        break;
      case 'error':
        logLevel = 'error';
        break;
      default:
        logLevel = 'off';
        break;
    }
    _logLevel = logLevel;
    if (_client) {
      _client = _client.withOptions({ logLevel });
    }
    return {};
  });
}

/**
 * Selects the tools to include in the MCP Server based on the provided options.
 */
export function selectTools(options?: McpOptions): McpTool[] {
  const includedTools = [];

  if (options?.includeCodeTool ?? true) {
    includedTools.push(
      codeTool({
        blockedMethods: blockedMethodsForCodeTool(options),
        codeExecutionMode: options?.codeExecutionMode ?? 'stainless-sandbox',
      }),
    );
  }
  if (options?.includeDocsTools ?? true) {
    includedTools.push(docsSearchTool);
  }
  return includedTools;
}

/**
 * Runs the provided handler with the given client and arguments.
 */
export async function executeHandler({
  handler,
  reqContext,
  args,
}: {
  handler: HandlerFunction;
  reqContext: McpRequestContext;
  args: Record<string, unknown> | undefined;
}): Promise<ToolCallResult> {
  return await handler({ reqContext, args: args || {} });
}
