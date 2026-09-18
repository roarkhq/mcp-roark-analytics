// Remote OAuth resource-server support.
//
// This file is hand-maintained (not generated). It turns the HTTP transport into
// an MCP OAuth *resource server* (RFC 9728): it advertises Protected Resource
// Metadata pointing at Roark's authorization server (bern `mcp-oauth`) and
// answers requests without a bearer with 401 + WWW-Authenticate so clients know
// where to go. The access token the authorization server issues is a Roark API
// key (minted at consent with the permissions the user picked, expiring and
// rotated by the client's refresh token), so it is forwarded to customer-api as
// the SDK bearer unchanged: customer-api validates it on every call.

import { IncomingMessage } from 'node:http';
import { ClientOptions } from '@roarkanalytics/sdk';

export type OAuthConfig = {
  /** Authorization server issuer, e.g. https://mcp-oauth.api.roark.ai */
  issuer: string;
  /** Public origin of this resource server, e.g. https://mcp.api.roark.ai; connector URLs are `<base>/mcp/<projectId>`. */
  resourceBaseUrl: string;
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

const stripSlash = (url: string): string => url.replace(/\/+$/, '');

/**
 * The resource identifier (RFC 8707) for a request: the project-scoped connector
 * URL when a project is in the path, else the server origin. Clients send it back
 * to the authorization server as `resource`, which is how consent learns which
 * project the connector was added for.
 */
export const resourceIdentifier = (config: OAuthConfig, projectId?: string): string =>
  projectId ? `${stripSlash(config.resourceBaseUrl)}/mcp/${projectId}` : stripSlash(config.resourceBaseUrl);

/** Where this server publishes its Protected Resource Metadata, per resource. */
export const protectedResourceMetadataUrl = (config: OAuthConfig, projectId?: string): string =>
  projectId ?
    `${stripSlash(config.resourceBaseUrl)}/.well-known/oauth-protected-resource/mcp/${projectId}`
  : `${stripSlash(config.resourceBaseUrl)}/.well-known/oauth-protected-resource`;

/** RFC 9728 Protected Resource Metadata document. */
export const protectedResourceMetadata = (config: OAuthConfig, projectId?: string) => ({
  resource: resourceIdentifier(config, projectId),
  authorization_servers: [stripSlash(config.issuer)],
  bearer_methods_supported: ['header'],
  scopes_supported: ['mcp'],
  resource_documentation: 'https://docs.roark.ai',
});

const bearerChallenge = (
  config: OAuthConfig,
  projectId: string | undefined,
  error?: string,
  description?: string,
): string => {
  const parts = [`Bearer resource_metadata="${protectedResourceMetadataUrl(config, projectId)}"`];
  if (error) parts.push(`error="${error}"`);
  if (description) parts.push(`error_description="${description}"`);
  return parts.join(', ');
};

const extractBearer = (req: IncomingMessage): string | undefined => {
  const header = req.headers.authorization;
  if (!header) return undefined;
  const [scheme, ...rest] = header.split(' ');
  if (scheme !== 'Bearer' || rest.length === 0) return undefined;
  const token = rest.join(' ').trim();
  return token.length > 0 ? token : undefined;
};

/**
 * Requires a bearer token and hands it to the SDK as-is. Throws
 * {@link UnauthorizedError} (401 + challenge) when it is missing, which is the
 * signal an MCP client needs to start the OAuth flow. Validity is decided by
 * customer-api on each call; an expired or revoked key surfaces there.
 */
export const requireBearer = (
  req: IncomingMessage,
  config: OAuthConfig,
  projectId?: string,
): Partial<ClientOptions> => {
  const token = extractBearer(req);
  if (!token) {
    throw new UnauthorizedError('Missing bearer token', bearerChallenge(config, projectId));
  }
  return { bearerToken: token };
};
