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

import { createHash } from 'node:crypto';
import { IncomingMessage } from 'node:http';
import { ClientOptions } from '@roarkanalytics/sdk';
import { readEnv } from './util';

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
 * Which connector URL a request arrived on. There are three, and the difference is the whole
 * point of this PR:
 *
 *  - `origin`  the bare server origin, the legacy `/` transport.
 *  - `mcp`     the single connector, `<base>/mcp`. No project in the URL: the credential is
 *              user-scoped and names a project per request. This is what a person adds to
 *              Claude or Cursor once and never revisits.
 *  - `project` a pinned connector, `<base>/mcp/<projectId>`. Still supported, and now actually
 *              enforced: the project in the path becomes the SDK's project, so a user-scoped
 *              credential used on a pinned URL acts only on that project.
 */
export type Connector = { kind: 'origin' } | { kind: 'mcp' } | { kind: 'project'; projectId: string };

export const ORIGIN_CONNECTOR: Connector = { kind: 'origin' };

/** The path a connector is served on, relative to the origin. */
const connectorPath = (connector: Connector): string =>
  connector.kind === 'origin' ? ''
  : connector.kind === 'mcp' ? '/mcp'
  : `/mcp/${connector.projectId}`;

/**
 * The resource identifier (RFC 8707) for a request: the connector URL it arrived on. Clients
 * send it back to the authorization server as `resource`, which is how consent learns whether
 * the grant is for one project or for the person.
 */
export const resourceIdentifier = (config: OAuthConfig, connector: Connector = ORIGIN_CONNECTOR): string =>
  `${stripSlash(config.resourceBaseUrl)}${connectorPath(connector)}`;

/**
 * Where this server publishes its Protected Resource Metadata, per resource.
 *
 * RFC 9728 puts the resource's path after the well-known segment, so this is literally the
 * origin, the well-known path, and the connector path, in that order.
 */
export const protectedResourceMetadataUrl = (
  config: OAuthConfig,
  connector: Connector = ORIGIN_CONNECTOR,
): string =>
  `${stripSlash(config.resourceBaseUrl)}/.well-known/oauth-protected-resource${connectorPath(connector)}`;

/** RFC 9728 Protected Resource Metadata document. */
export const protectedResourceMetadata = (config: OAuthConfig, connector: Connector = ORIGIN_CONNECTOR) => ({
  resource: resourceIdentifier(config, connector),
  authorization_servers: [stripSlash(config.issuer)],
  bearer_methods_supported: ['header'],
  scopes_supported: ['mcp'],
  resource_documentation: 'https://docs.roark.ai',
});

const bearerChallenge = (
  config: OAuthConfig,
  connector: Connector,
  error?: string,
  description?: string,
): string => {
  const parts = [`Bearer resource_metadata="${protectedResourceMetadataUrl(config, connector)}"`];
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
 *
 * A pinned connector also fixes the SDK's `project`. This is `project` rather than a
 * `defaultHeaders` entry deliberately: code the model writes inside the execution tool can still
 * call `client.withOptions({ project })` to reach another project the credential covers, which a
 * default header would silently override. On the unpinned `/mcp` connector no project is set at
 * all, and choosing one is the caller's job.
 */
export const requireBearer = (
  req: IncomingMessage,
  config: OAuthConfig,
  connector: Connector = ORIGIN_CONNECTOR,
): Partial<ClientOptions> & { bearerToken: string } => {
  const token = extractBearer(req);
  if (!token) {
    throw new UnauthorizedError('Missing bearer token', bearerChallenge(config, connector));
  }
  // Assigned rather than conditionally spread: a spread of `cond && { project }` is not checked
  // against `ClientOptions`, so on an SDK without the option the pin would compile and then
  // silently vanish. This way the dependency is enforced by the build.
  const options: Partial<ClientOptions> & { bearerToken: string } = { bearerToken: token };
  if (connector.kind === 'project') {
    options.project = connector.projectId;
  }
  return options;
};

/**
 * What customer-api says about a bearer: `unknown` means it could not be asked, not that the
 * token is fine.
 */
export type BearerVerdict = 'valid' | 'invalid' | 'unknown';

/** The SDK's own default, for when neither an option nor the environment names one. */
export const DEFAULT_API_BASE_URL = 'https://api.roark.ai';

/**
 * The base URL the SDK will actually call, resolved exactly the way the SDK resolves it:
 * explicit option, then `ROARK_BASE_URL`, then the default.
 *
 * This has to agree with the SDK or the liveness check asks the wrong host. `launchStreamableHTTPServer`
 * passes no `clientOptions` at all, so for the deployed server the answer always comes from the
 * environment: a hardcoded prod default would send every check to prod while data calls went to
 * whatever `ROARK_BASE_URL` names. On any stage but prod that turns a valid token into a 401 from
 * a server it was never issued for, and this file would then refuse every request - a dead
 * connector, which is strictly worse than the bug it is here to fix.
 */
export const resolveApiBaseUrl = (clientOptions: Pick<ClientOptions, 'baseURL'> = {}): string =>
  clientOptions.baseURL ?? readEnv('ROARK_BASE_URL') ?? DEFAULT_API_BASE_URL;

/**
 * How long a verdict is reused. `newServer` runs per POST, not per session, so an uncached check
 * would add a round trip to every single MCP request. The window is what a revoked token buys:
 * it can still complete a handshake and read the tool list for up to this long. It cannot read
 * anything, because every data path carries the same token to customer-api and is refused there
 * immediately.
 */
const BEARER_CACHE_TTL_MS = 60_000;

/**
 * An unreachable customer-api is handled by the catch below, but a customer-api that accepts the
 * connection and then never answers is not: without a deadline every MCP request would hang on
 * it, which is worse than the failure this check exists to report. A hang becomes `unknown` like
 * any other transport failure.
 */
const BEARER_CHECK_TIMEOUT_MS = 3_000;

/**
 * Bounded so that spraying invented tokens cannot grow the process's memory. Keys are hashes,
 * not the tokens themselves: these are live credentials and there is no reason to keep a second
 * copy of them in a long-lived map.
 */
const BEARER_CACHE_MAX = 1_000;

const bearerVerdicts = new Map<string, { verdict: 'valid' | 'invalid'; expiresAt: number }>();

/**
 * Checks already in flight, so concurrent requests bearing the same uncached token make one call
 * rather than one each. That is the common shape right after a verdict expires, and whenever a
 * client opens several requests at once.
 */
const inFlightChecks = new Map<string, Promise<BearerVerdict>>();

/** Test seam. */
export const clearBearerVerdictCache = (): void => {
  bearerVerdicts.clear();
  inFlightChecks.clear();
};

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

const rememberVerdict = (key: string, verdict: 'valid' | 'invalid', expiresAt: number): void => {
  // Evict the oldest entry rather than clearing the map. A `clear()` would let anyone spraying
  // invented tokens flush every valid verdict too, making legitimate callers pay a round trip
  // each and handing customer-api the extra work. Map iterates in insertion order, so the first
  // key is the oldest.
  if (bearerVerdicts.size >= BEARER_CACHE_MAX) {
    const oldest = bearerVerdicts.keys().next();
    if (!oldest.done) bearerVerdicts.delete(oldest.value);
  }
  bearerVerdicts.set(key, { verdict, expiresAt });
};

export interface VerifyBearerDeps {
  /** customer-api base URL. Use {@link resolveApiBaseUrl} rather than passing a literal. */
  baseURL: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  ttlMs?: number;
  timeoutMs?: number;
}

/**
 * Asks customer-api whether a bearer is still live, via the `/v1/me` endpoint it already exposes
 * for exactly this ("who is this credential"), and caches the answer briefly.
 *
 * Only a 401 counts as invalid. A 403 means the token authenticated and then failed a permission
 * check, which is a live token; treating it as invalid would tell a client to re-authorize when
 * re-authorizing cannot help. Anything else - a 5xx, a timeout, a DNS failure - is `unknown`.
 */
export const verifyBearer = async (token: string, deps: VerifyBearerDeps): Promise<BearerVerdict> => {
  const {
    baseURL,
    fetchImpl = fetch,
    now = Date.now,
    ttlMs = BEARER_CACHE_TTL_MS,
    timeoutMs = BEARER_CHECK_TIMEOUT_MS,
  } = deps;
  const key = hashToken(token);

  const cached = bearerVerdicts.get(key);
  if (cached && cached.expiresAt > now()) return cached.verdict;

  const alreadyRunning = inFlightChecks.get(key);
  if (alreadyRunning) return alreadyRunning;

  const check = (async (): Promise<BearerVerdict> => {
    let response: Response;
    try {
      response = await fetchImpl(`${stripSlash(baseURL)}/v1/me`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      return 'unknown';
    }

    const verdict: BearerVerdict =
      response.status === 401 ? 'invalid'
      : response.ok ? 'valid'
      : 'unknown';
    // An `unknown` is never cached: a blip would otherwise pin the answer for the whole TTL.
    if (verdict !== 'unknown') rememberVerdict(key, verdict, now() + ttlMs);
    return verdict;
  })();

  inFlightChecks.set(key, check);
  try {
    return await check;
  } finally {
    inFlightChecks.delete(key);
  }
};

/**
 * Rejects a bearer customer-api has already disowned, with the 401 + WWW-Authenticate that tells
 * an MCP client to re-run the OAuth flow.
 *
 * Without this the resource server only checked that a token was PRESENT. A revoked, expired or
 * entirely invented token completed `initialize` and `tools/list`, and the caller learned nothing
 * until a tool call failed with an opaque 401 in its result text. No data was reachable - every
 * data path revalidates at customer-api - but a client that never sees a 401 from the resource
 * server has no reason to refresh, which for a 24h token means a connector that looks connected
 * and silently cannot work.
 *
 * `unknown` is allowed through deliberately. Failing closed would turn a customer-api blip into a
 * dead connector for everyone, and it would buy no confidentiality: the token still has to pass
 * customer-api on the very next call that touches data.
 */
export const requireLiveBearer = async (
  token: string,
  config: OAuthConfig,
  connector: Connector,
  deps: VerifyBearerDeps,
): Promise<void> => {
  const verdict = await verifyBearer(token, deps);
  if (verdict !== 'invalid') return;
  throw new UnauthorizedError(
    'The access token is expired or has been revoked',
    bearerChallenge(config, connector, 'invalid_token', 'The access token is expired or has been revoked'),
  );
};
