// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Metadata, McpRequestContext, ToolCallResult, asTextContentResult } from './types';
import { getLogger } from './logger';
import type { LocalDocsSearch } from './local-docs-search';

export const metadata: Metadata = {
  resource: 'all',
  operation: 'read',
  tags: [],
  httpMethod: 'get',
};

export const tool: Tool = {
  name: 'search_docs',
  title: 'Search Roark docs',
  description:
    'Searches Roark SDK documentation for methods, parameters, and response shapes. Returns the matching documentation for the query and language.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'What to look up, in plain words: a task, method, or parameter, such as "create a persona" or "list calls by agent".',
      },
      language: {
        type: 'string',
        description:
          'SDK language the signatures and examples are shown in. http returns the REST endpoints.',
        enum: ['http', 'python', 'go', 'typescript', 'javascript', 'terraform', 'ruby', 'java', 'kotlin'],
      },
      detail: {
        type: 'string',
        description:
          'How much to return for each match: default gives a summary, verbose the full reference. When omitted, default.',
        enum: ['default', 'verbose'],
      },
    },
    required: ['query', 'language'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      results: {
        type: 'array',
        description:
          'Matches, best first. A method match is an object with method, summary, description, endpoint, and, when known, example, params, and response; with detail verbose it is the full Markdown reference as a string. A documentation match is an object with content and source. When results were cut to fit, the first entry is a string saying how many are shown.',
        items: {},
      },
    },
    required: ['results'],
  },
  // Reads a fixed documentation corpus, so the result depends only on the input.
  annotations: {
    title: 'Search Roark docs',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

const docsSearchURL =
  process.env['DOCS_SEARCH_URL'] || 'https://api.stainless.com/api/projects/roark-analytics/docs/search';

let _localSearch: LocalDocsSearch | undefined;

export function setLocalSearch(search: LocalDocsSearch): void {
  _localSearch = search;
}

async function searchLocal(args: Record<string, unknown>): Promise<unknown> {
  if (!_localSearch) {
    throw new Error('Local search not initialized');
  }

  const query = (args['query'] as string) ?? '';
  const language = (args['language'] as string) ?? 'typescript';
  const detail = (args['detail'] as string) ?? 'default';

  return _localSearch.search({
    query,
    language,
    detail,
    maxResults: 10,
  }).results;
}

async function searchRemote(args: Record<string, unknown>, reqContext: McpRequestContext): Promise<unknown> {
  const body = args as any;
  const query = new URLSearchParams(body).toString();

  const startTime = Date.now();
  const result = await fetch(`${docsSearchURL}?${query}`, {
    headers: {
      ...(reqContext.stainlessApiKey && { Authorization: reqContext.stainlessApiKey }),
      ...(reqContext.mcpSessionId && { 'x-stainless-mcp-session-id': reqContext.mcpSessionId }),
      ...(reqContext.mcpClientInfo && {
        'x-stainless-mcp-client-info': JSON.stringify(reqContext.mcpClientInfo),
      }),
    },
  });

  const logger = getLogger();

  if (!result.ok) {
    const errorText = await result.text();
    logger.warn(
      {
        durationMs: Date.now() - startTime,
        query: body.query,
        status: result.status,
        statusText: result.statusText,
        errorText,
      },
      'Got error response from docs search tool',
    );

    if (result.status === 404 && !reqContext.stainlessApiKey) {
      throw new Error(
        'Could not find docs for this project. You may need to provide a Stainless API key via the STAINLESS_API_KEY environment variable, the --stainless-api-key flag, or the x-stainless-api-key HTTP header.',
      );
    }

    throw new Error(
      `${result.status}: ${result.statusText} when using doc search tool. Details: ${errorText}`,
    );
  }

  const resultBody = await result.json();
  logger.info(
    {
      durationMs: Date.now() - startTime,
      query: body.query,
    },
    'Got docs search result',
  );
  return resultBody;
}

/**
 * The local index returns `{ results }`, and so does this tool, as structuredContent and as JSON
 * text. The hosted search (`--docs-search-mode=stainless-api`) returns a body whose shape this
 * package does not define: a body that already has a `results` array passes through, an array
 * becomes `results`, and anything else becomes its only entry.
 */
export const asResults = (results: unknown): ToolCallResult => {
  const alreadyWrapped =
    typeof results === 'object' &&
    results !== null &&
    Array.isArray((results as { results?: unknown }).results);
  const body =
    alreadyWrapped ?
      { results: (results as { results: unknown[] }).results }
    : { results: Array.isArray(results) ? results : [results] };
  return { ...asTextContentResult(body), structuredContent: body };
};

export const handler = async ({
  reqContext,
  args,
}: {
  reqContext: McpRequestContext;
  args: Record<string, unknown> | undefined;
}) => {
  const body = args ?? {};

  if (_localSearch) {
    return asResults(await searchLocal(body));
  }

  return asResults(await searchRemote(body, reqContext));
};

export default { metadata, tool, handler };
