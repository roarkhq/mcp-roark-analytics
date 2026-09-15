// Remote OAuth resource-server support.
//
// This file is hand-maintained (not generated). It turns the HTTP transport into
// a spec-compliant MCP OAuth *resource server*: it advertises Protected Resource
// Metadata (RFC 9728), validates the access tokens minted by our authorization
// server (bern `mcp-oauth` service), and exchanges the validated identity for a
// short-lived, project-scoped Roark API key that the SDK — and the Deno code
// sandbox — can use as a normal bearer.
//
// It deliberately does NOT do token passthrough: the client's OAuth token is
// validated and dropped; downstream calls use a separately minted credential.

import { IncomingMessage } from 'node:http';
import { ClientOptions } from '@roarkanalytics/sdk';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { getLogger } from './logger';

export type OAuthConfig = {
  /** Authorization server issuer, e.g. https://mcp-oauth.api.roark.ai */
  issuer: string;
  /** JWKS endpoint used to verify access tokens. Defaults to `${issuer}/.well-known/jwks.json`. */
  jwksUrl: string;
  /** This resource server's identifier (the `aud` every token must carry), e.g. https://mcp.api.roark.ai */
  audience: string;
  /** Base URL clients use to reach this resource server, used to build metadata URLs. */
  resourceBaseUrl: string;
  /** Internal HMAC token used to authenticate the ephemeral-key mint call to customer-api. */
  internalToken: string;
  /** customer-api base URL the minted key is used against, e.g. https://api.roark.ai */
  customerApiBaseUrl: string;
};

export type McpAccessTokenClaims = JWTPayload & {
  sub: string;
  /** Projects the authenticated user may act on, embedded by the AS at authorize time. */
  roark_project_ids?: string[];
};

/** Thrown when a request cannot be authorized; carries the WWW-Authenticate value to return. */
export class UnauthorizedError extends Error {
  constructor(
    message: string,
    readonly wwwAuthenticate: string,
    readonly status: 401 | 403 = 401,
  ) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/** The canonical resource identifier for a request, project-scoped when a project is in the path. */
export const resourceIdentifier = (config: OAuthConfig, projectId?: string): string =>
  projectId ? `${config.audience}/mcp/${projectId}` : `${config.audience}/mcp`;

/** URL where this resource server serves its Protected Resource Metadata document. */
export const protectedResourceMetadataUrl = (config: OAuthConfig): string =>
  `${config.resourceBaseUrl.replace(/\/$/, '')}/.well-known/oauth-protected-resource`;

/** RFC 9728 Protected Resource Metadata document. */
export const protectedResourceMetadata = (config: OAuthConfig) => ({
  resource: config.audience,
  authorization_servers: [config.issuer],
  bearer_methods_supported: ['header'],
  resource_documentation: 'https://docs.roark.ai',
});

const bearerChallenge = (config: OAuthConfig, error?: string, description?: string): string => {
  const parts = [`Bearer resource_metadata="${protectedResourceMetadataUrl(config)}"`];
  if (error) parts.push(`error="${error}"`);
  if (description) parts.push(`error_description="${description}"`);
  return parts.join(', ');
};

let _jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
const jwksFor = (config: OAuthConfig) => {
  // Cached for the process; createRemoteJWKSet keeps its own key cache + rotation.
  _jwks ??= createRemoteJWKSet(new URL(config.jwksUrl));
  return _jwks;
};

const extractBearer = (req: IncomingMessage): string | undefined => {
  const header = req.headers.authorization;
  if (!header) return undefined;
  const [scheme, ...rest] = header.split(' ');
  if (scheme !== 'Bearer' || rest.length === 0) return undefined;
  return rest.join(' ');
};

/**
 * Validates the incoming access token against the authorization server.
 * Throws {@link UnauthorizedError} (401) when missing/invalid.
 */
export const validateAccessToken = async (
  req: IncomingMessage,
  config: OAuthConfig,
): Promise<McpAccessTokenClaims> => {
  const token = extractBearer(req);
  if (!token) {
    throw new UnauthorizedError('Missing bearer token', bearerChallenge(config));
  }
  try {
    const { payload } = await jwtVerify(token, jwksFor(config), {
      issuer: config.issuer,
      audience: config.audience,
    });
    if (typeof payload.sub !== 'string' || !payload.sub) {
      throw new Error('token has no subject');
    }
    return payload as McpAccessTokenClaims;
  } catch (error) {
    getLogger().warn({ error }, 'Rejected MCP access token');
    throw new UnauthorizedError(
      'Invalid bearer token',
      bearerChallenge(
        config,
        'invalid_token',
        'The access token is expired, malformed, or not intended for this server',
      ),
    );
  }
};

/**
 * Resolves the project a request acts on and enforces membership.
 *
 * `pathProjectId` comes from the `/mcp/:projectId` route. It must be one of the
 * projects the AS authorized for this user (`roark_project_ids`). When the path
 * carries no project and the token authorizes exactly one, that one is used.
 */
export const resolveProjectId = (
  claims: McpAccessTokenClaims,
  config: OAuthConfig,
  pathProjectId?: string,
): string => {
  const allowed = claims.roark_project_ids ?? [];
  if (pathProjectId) {
    if (!allowed.includes(pathProjectId)) {
      throw new UnauthorizedError(
        `User is not a member of project ${pathProjectId}`,
        bearerChallenge(config, 'insufficient_scope', 'Token does not authorize this project'),
        403,
      );
    }
    return pathProjectId;
  }
  if (allowed.length === 1) return allowed[0]!;
  throw new UnauthorizedError(
    'A project must be selected: use a project-scoped connector URL (/mcp/<projectId>)',
    bearerChallenge(config, 'insufficient_scope', 'Ambiguous or missing project'),
    403,
  );
};

// --- Downstream credential exchange ---------------------------------------
//
// customer-api authenticates with a project-scoped API key (validated on every
// request) or an internal HMAC header. The Deno code sandbox can only pass a
// bearer via the ROARK_API_BEARER_TOKEN env var, so we exchange the OAuth
// identity for a short-lived API key and hand that to the SDK client. The mint
// endpoint itself is protected by the internal HMAC token.

type EphemeralKey = { apiKey: string; expiresAt: number };
const keyCache = new Map<string, EphemeralKey>();
const KEY_SKEW_MS = 60_000;

const mintEphemeralApiKey = async (
  config: OAuthConfig,
  claims: McpAccessTokenClaims,
  projectId: string,
): Promise<string> => {
  const cacheKey = `${claims.sub}:${projectId}`;
  const cached = keyCache.get(cacheKey);
  if (cached && cached.expiresAt - KEY_SKEW_MS > Date.now()) {
    return cached.apiKey;
  }

  // Reuse customer-api's internal-trust path: the internal token authenticates
  // the call and the acting project/user are asserted via headers (the same
  // contract the assistant lambda uses).
  const res = await fetch(`${config.customerApiBaseUrl.replace(/\/$/, '')}/internal/mcp/ephemeral-key`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-roark-internal-token': config.internalToken,
      'x-roark-acting-project-id': projectId,
      'x-roark-acting-user-id': claims.sub,
    },
  });
  if (!res.ok) {
    throw new UnauthorizedError(
      `Failed to mint downstream credential (${res.status})`,
      bearerChallenge(config, 'invalid_token', 'Could not authorize the request against Roark'),
    );
  }
  const { apiKey, expiresAt } = (await res.json()) as { apiKey: string; expiresAt: number };
  keyCache.set(cacheKey, { apiKey, expiresAt });
  return apiKey;
};

/**
 * Builds the SDK client options for an authenticated request: a short-lived
 * project-scoped API key against customer-api. The incoming OAuth token is never
 * forwarded.
 */
export const clientOptionsForRequest = async (
  config: OAuthConfig,
  claims: McpAccessTokenClaims,
  projectId: string,
): Promise<Partial<ClientOptions>> => {
  const apiKey = await mintEphemeralApiKey(config, claims, projectId);
  return { bearerToken: apiKey, baseURL: config.customerApiBaseUrl };
};
