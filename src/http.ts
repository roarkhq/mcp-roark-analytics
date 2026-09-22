// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ClientOptions } from '@roarkanalytics/sdk';
import cors from 'cors';
import express from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { getStainlessApiKey, parseClientAuthHeaders } from './auth';
import { getLogger } from './logger';
import { McpOptions } from './options';
import {
  Connector,
  ORIGIN_CONNECTOR,
  protectedResourceMetadata,
  requireBearer,
  UnauthorizedError,
} from './oauth';
import { initMcpServer, newMcpServer } from './server';

/**
 * Which connector URL this request arrived on.
 *
 * `req.path` is the path within the matched route, so `/mcp` and `/mcp/<id>` are distinguishable
 * from the legacy `/` transport without threading a flag through every handler.
 */
const connectorFrom = (req: express.Request): Connector => {
  const projectId = req.params?.['projectId'];
  if (typeof projectId === 'string' && projectId.length > 0) return { kind: 'project', projectId };
  return req.path === '/mcp' || req.path.startsWith('/mcp/') ? { kind: 'mcp' } : ORIGIN_CONNECTOR;
};

const newServer = async ({
  clientOptions,
  mcpOptions,
  req,
  res,
}: {
  clientOptions: ClientOptions;
  mcpOptions: McpOptions;
  req: express.Request;
  res: express.Response;
}): Promise<McpServer | null> => {
  // Remote OAuth mode: a bearer is mandatory and a missing one is answered with
  // 401 + WWW-Authenticate so the client discovers the authorization server. The
  // token is a Roark API key and is forwarded to the SDK unchanged. Without oauth
  // config we keep the legacy optional-bearer behavior (local installs).
  //
  // This runs before the server is built on purpose: `newMcpServer` fetches the
  // instructions document over the network, and an unauthenticated caller should
  // not be able to make us do that.
  let authOptions: Partial<ClientOptions>;
  if (mcpOptions.oauth) {
    authOptions = requireBearer(req, mcpOptions.oauth, connectorFrom(req));
  } else {
    authOptions = parseClientAuthHeaders(req, false);
  }

  const stainlessApiKey = getStainlessApiKey(req, mcpOptions);
  const customInstructionsPath = mcpOptions.customInstructionsPath;
  const server = await newMcpServer({ stainlessApiKey, customInstructionsPath });

  let upstreamClientEnvs: Record<string, string> | undefined;
  const clientEnvsHeader = req.headers['x-stainless-mcp-client-envs'];
  if (typeof clientEnvsHeader === 'string') {
    try {
      const parsed = JSON.parse(clientEnvsHeader);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        upstreamClientEnvs = parsed;
      }
    } catch {
      // Ignore malformed header
    }
  }

  // Parse x-stainless-mcp-client-permissions header to override permission options
  //
  // Note: Permissions are best-effort and intended to prevent clients from doing unexpected things;
  // they're not a hard security boundary, so we allow arbitrary, client-driven overrides.
  //
  // See the Stainless MCP documentation for more details.
  let effectiveMcpOptions = mcpOptions;
  const clientPermissionsHeader = req.headers['x-stainless-mcp-client-permissions'];
  if (typeof clientPermissionsHeader === 'string') {
    try {
      const parsed = JSON.parse(clientPermissionsHeader);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        effectiveMcpOptions = {
          ...mcpOptions,
          ...(typeof parsed.allow_http_gets === 'boolean' && { codeAllowHttpGets: parsed.allow_http_gets }),
          ...(Array.isArray(parsed.allowed_methods) && { codeAllowedMethods: parsed.allowed_methods }),
          ...(Array.isArray(parsed.blocked_methods) && { codeBlockedMethods: parsed.blocked_methods }),
        };
        getLogger().info(
          { clientPermissions: parsed },
          'Overriding code execution permissions from x-stainless-mcp-client-permissions header',
        );
      }
    } catch (error) {
      getLogger().warn({ error }, 'Failed to parse x-stainless-mcp-client-permissions header');
    }
  }

  const mcpClientInfo =
    typeof req.body?.params?.clientInfo?.name === 'string' ?
      { name: req.body.params.clientInfo.name, version: String(req.body.params.clientInfo.version ?? '') }
    : undefined;

  await initMcpServer({
    server: server,
    mcpOptions: effectiveMcpOptions,
    clientOptions: {
      ...clientOptions,
      ...authOptions,
    },
    stainlessApiKey: stainlessApiKey,
    upstreamClientEnvs,
    mcpSessionId: (req as any).mcpSessionId,
    mcpClientInfo,
  });

  if (mcpClientInfo) {
    getLogger().info({ mcpSessionId: (req as any).mcpSessionId, mcpClientInfo }, 'MCP client connected');
  }

  return server;
};

const post =
  (options: { clientOptions: ClientOptions; mcpOptions: McpOptions }) =>
  async (req: express.Request, res: express.Response) => {
    let server: McpServer | null;
    try {
      server = await newServer({ ...options, req, res });
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        res.setHeader('WWW-Authenticate', error.wwwAuthenticate);
        res.status(error.status).json({
          jsonrpc: '2.0',
          error: { code: -32001, message: error.message },
          id: req.body?.id ?? null,
        });
        return;
      }
      throw error;
    }
    // If we return null, we already set the authorization error.
    if (server === null) return;
    const transport = new StreamableHTTPServerTransport();
    await server.connect(transport as any);
    await transport.handleRequest(req, res, req.body);
  };

const get = async (req: express.Request, res: express.Response) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: {
      code: -32000,
      message: 'Method not supported',
    },
  });
};

const del = async (req: express.Request, res: express.Response) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: {
      code: -32000,
      message: 'Method not supported',
    },
  });
};

const redactHeaders = (headers: Record<string, any>) => {
  const hiddenHeaders = /auth|cookie|key|token|x-stainless-mcp-client-envs/i;
  const filtered = { ...headers };
  Object.keys(filtered).forEach((key) => {
    if (hiddenHeaders.test(key)) {
      filtered[key] = '[REDACTED]';
    }
  });
  return filtered;
};

export const streamableHTTPApp = ({
  clientOptions = {},
  mcpOptions,
}: {
  clientOptions?: ClientOptions;
  mcpOptions: McpOptions;
}): express.Express => {
  const app = express();
  app.set('query parser', 'extended');
  // Browser-based clients (Claude web, ChatGPT web) need CORS on the MCP and
  // metadata endpoints, and must be able to read the challenge header.
  //
  // `origin: true` reflects the caller's Origin, which CodeQL flags as permissive.
  // It is deliberate: this is a public resource server whose only credential is
  // the bearer a client attaches per request. No cookies are ever set and
  // `credentials` stays off, so reflecting the origin is equivalent to `*` and
  // grants a page nothing it could not already do with a token it holds. An
  // allowlist would have to enumerate every MCP client's web origin (Claude,
  // ChatGPT, Cursor, VS Code webviews, Inspector on localhost) and break the
  // next one to appear.
  app.use(
    cors({
      origin: true,
      exposedHeaders: ['WWW-Authenticate', 'mcp-session-id'],
      allowedHeaders: ['authorization', 'content-type', 'mcp-session-id'],
    }),
  );
  app.use(express.json());
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const existing = req.headers['mcp-session-id'];
    const sessionId = (Array.isArray(existing) ? existing[0] : existing) || crypto.randomUUID();
    (req as any).mcpSessionId = sessionId;
    const origWriteHead = res.writeHead.bind(res);
    res.writeHead = function (statusCode: number, ...rest: any[]) {
      res.setHeader('mcp-session-id', sessionId);
      return origWriteHead(statusCode, ...rest);
    } as typeof res.writeHead;
    next();
  });
  app.use(
    pinoHttp({
      logger: getLogger(),
      customProps: (req) => ({
        mcpSessionId: (req as any).mcpSessionId,
      }),
      customLogLevel: (req, res) => {
        if (res.statusCode >= 500) {
          return 'error';
        } else if (res.statusCode >= 400) {
          return 'warn';
        }
        return 'info';
      },
      customSuccessMessage: function (req, res) {
        return `Request ${req.method} to ${req.url} completed with status ${res.statusCode}`;
      },
      customErrorMessage: function (req, res, err) {
        return `Request ${req.method} to ${req.url} errored with status ${res.statusCode}`;
      },
      serializers: {
        req: pino.stdSerializers.wrapRequestSerializer((req) => {
          return {
            ...req,
            headers: redactHeaders(req.raw.headers),
          };
        }),
        res: pino.stdSerializers.wrapResponseSerializer((res) => {
          return {
            ...res,
            headers: redactHeaders(res.headers),
          };
        }),
      },
    }),
  );

  app.get('/health', async (req: express.Request, res: express.Response) => {
    res.status(200).send('OK');
  });

  // RFC 9728 Protected Resource Metadata, the discovery entrypoint every OAuth
  // MCP client hits first. Served per resource: the server origin, and each
  // project-scoped connector URL (its `resource` is what the client echoes to
  // the authorization server, which is how consent learns the project). Only
  // served in remote OAuth mode.
  if (mcpOptions.oauth) {
    const oauth = mcpOptions.oauth;
    app.get('/.well-known/oauth-protected-resource', (_req, res) => {
      res.status(200).json(protectedResourceMetadata(oauth));
    });
    // The single connector. Its `resource` carries no project, which is what tells the
    // authorization server to mint a credential for the person rather than for one project.
    app.get('/.well-known/oauth-protected-resource/mcp', (_req, res) => {
      res.status(200).json(protectedResourceMetadata(oauth, { kind: 'mcp' }));
    });
    app.get('/.well-known/oauth-protected-resource/mcp/:projectId', (req, res) => {
      const projectId = req.params['projectId'];
      res
        .status(200)
        .json(
          protectedResourceMetadata(
            oauth,
            typeof projectId === 'string' ? { kind: 'project', projectId } : undefined,
          ),
        );
    });
  }

  app.get('/', get);
  app.post('/', post({ clientOptions, mcpOptions }));
  app.delete('/', del);

  // The connector URL: <base>/mcp, with no project in it. One URL, added once, that reaches
  // every project the person belongs to. Registered BEFORE the pinned route so express does not
  // match a bare `/mcp` as `/mcp/:projectId` with an empty parameter.
  app.get('/mcp', get);
  app.post('/mcp', post({ clientOptions, mcpOptions }));
  app.delete('/mcp', del);

  // Pinned connector URL: /mcp/<projectId>. Still supported, and now enforced rather than
  // decorative: the project in the path becomes the SDK's project, so a user-scoped credential
  // used here acts on that project only.
  app.get('/mcp/:projectId', get);
  app.post('/mcp/:projectId', post({ clientOptions, mcpOptions }));
  app.delete('/mcp/:projectId', del);

  return app;
};

export const launchStreamableHTTPServer = async ({
  mcpOptions,
  port,
}: {
  mcpOptions: McpOptions;
  port: number | string | undefined;
}) => {
  const app = streamableHTTPApp({ mcpOptions });
  const server = app.listen(port);
  const address = server.address();

  const logger = getLogger();

  if (typeof address === 'string') {
    logger.info(`MCP Server running on streamable HTTP at ${address}`);
  } else if (address !== null) {
    logger.info(`MCP Server running on streamable HTTP on port ${address.port}`);
  } else {
    logger.info(`MCP Server running on streamable HTTP on port ${port}`);
  }
};
