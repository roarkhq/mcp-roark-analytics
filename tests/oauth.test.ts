import { IncomingMessage } from 'node:http';
import {
  protectedResourceMetadata,
  protectedResourceMetadataUrl,
  requireBearer,
  resourceIdentifier,
  UnauthorizedError,
} from '../src/oauth';

const config = { issuer: 'https://mcp-oauth.api.test/', resourceBaseUrl: 'https://mcp.api.test/' };
const PROJECT = '3f2b7c9e-1d4a-4b6c-9e8f-0a1b2c3d4e5f';
const PINNED = { kind: 'project', projectId: PROJECT } as const;
const UNPINNED = { kind: 'mcp' } as const;

const request = (headers: Record<string, string> = {}): IncomingMessage => ({ headers }) as IncomingMessage;

describe('protected resource metadata', () => {
  it('names the server origin as the resource and points at the authorization server', () => {
    expect(protectedResourceMetadata(config)).toEqual({
      resource: 'https://mcp.api.test',
      authorization_servers: ['https://mcp-oauth.api.test'],
      bearer_methods_supported: ['header'],
      scopes_supported: ['mcp'],
      resource_documentation: 'https://docs.roark.ai',
    });
  });

  it('scopes the resource to the project for a pinned connector URL', () => {
    expect(resourceIdentifier(config, PINNED)).toBe(`https://mcp.api.test/mcp/${PROJECT}`);
    expect(protectedResourceMetadata(config, PINNED).resource).toBe(`https://mcp.api.test/mcp/${PROJECT}`);
    expect(protectedResourceMetadataUrl(config, PINNED)).toBe(
      `https://mcp.api.test/.well-known/oauth-protected-resource/mcp/${PROJECT}`,
    );
    expect(protectedResourceMetadataUrl(config)).toBe(
      'https://mcp.api.test/.well-known/oauth-protected-resource',
    );
  });

  it('names the unpinned connector without a project, which is what asks for a user credential', () => {
    // The distinction the authorization server reads: a `resource` of `<base>/mcp/<id>` is a
    // request for that project, `<base>/mcp` is a request to act as the person. The bare origin
    // is neither, and stays the legacy transport.
    expect(resourceIdentifier(config, UNPINNED)).toBe('https://mcp.api.test/mcp');
    expect(protectedResourceMetadata(config, UNPINNED).resource).toBe('https://mcp.api.test/mcp');
    expect(protectedResourceMetadataUrl(config, UNPINNED)).toBe(
      'https://mcp.api.test/.well-known/oauth-protected-resource/mcp',
    );
    expect(resourceIdentifier(config)).toBe('https://mcp.api.test');
  });
});

describe('requireBearer', () => {
  it('forwards the bearer to the SDK unchanged', () => {
    expect(requireBearer(request({ authorization: 'Bearer roark_abc' }), config)).toEqual({
      bearerToken: 'roark_abc',
    });
  });

  it('pins the SDK project on a pinned connector, and sets none on the unpinned one', () => {
    // The pinned URL must actually constrain a user-scoped credential, not just decorate the
    // metadata. On the unpinned connector `project` is absent entirely, so the SDK sends no
    // project header and code written in the execution tool picks one per call.
    expect(requireBearer(request({ authorization: 'Bearer roark_abc' }), config, PINNED)).toEqual({
      bearerToken: 'roark_abc',
      project: PROJECT,
    });
    expect(requireBearer(request({ authorization: 'Bearer roark_abc' }), config, UNPINNED)).toEqual({
      bearerToken: 'roark_abc',
    });
  });

  it('answers a missing or malformed bearer with a 401 challenge pointing at the metadata', () => {
    for (const headers of [{}, { authorization: 'Basic xyz' }, { authorization: 'Bearer ' }]) {
      let caught: unknown;
      try {
        requireBearer(request(headers), config, PINNED);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(UnauthorizedError);
      const err = caught as UnauthorizedError;
      expect(err.status).toBe(401);
      expect(err.wwwAuthenticate).toBe(
        `Bearer resource_metadata="https://mcp.api.test/.well-known/oauth-protected-resource/mcp/${PROJECT}"`,
      );
    }
  });
});
