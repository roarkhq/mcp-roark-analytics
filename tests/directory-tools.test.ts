import Roark, { APIError } from '@roarkanalytics/sdk';
import { configureLogger } from '../src/logger';
import { selectTools } from '../src/server';
import { McpRequestContext, McpTool } from '../src/types';

// `execute` asks for the logger while the tool is being built, which is during
// this file's describe callbacks, before any beforeAll would run.
configureLogger({ level: 'fatal', pretty: false });

/**
 * A fake SDK client. Each resource method records the call and resolves a
 * marker, and `withOptions` returns a client that records the project it was
 * scoped to, so a test can see whether a tool pinned the call.
 */
const fakeClient = () => {
  const calls: { method: string; args: unknown[]; project?: string }[] = [];
  const resource = (name: string, project?: string) =>
    new Proxy(
      {},
      {
        get: (target, method) => {
          if (Object.prototype.hasOwnProperty.call(target, method)) {
            return (target as Record<string, unknown>)[String(method)];
          }
          return (...args: unknown[]) => {
            calls.push({ method: `${name}.${String(method)}`, args, ...(project ? { project } : {}) });
            return Promise.resolve({ data: { method: `${name}.${String(method)}` } });
          };
        },
      },
    );

  const build = (project?: string) => ({
    project: resource('project', project),
    agent: resource('agent', project),
    agentEndpoint: resource('agentEndpoint', project),
    call: resource('call', project),
    metric: resource('metric', project),
    simulationRunPlanJob: resource('simulationRunPlanJob', project),
    simulationPersona: resource('simulationPersona', project),
    customerFlow: resource('customerFlow', project),
    simulationEnvironment: resource('simulationEnvironment', project),
    simulation: resource('simulation', project),
    withOptions: ({ project: next }: { project: string }) => build(next),
  });

  return { client: build(), calls };
};

const context = (
  project?: string,
): { ctx: McpRequestContext; calls: ReturnType<typeof fakeClient>['calls'] } => {
  const { client, calls } = fakeClient();
  return {
    calls,
    ctx: { client: client as unknown as McpRequestContext['client'], project },
  };
};

const toolByName = (tools: McpTool[], name: string): McpTool => {
  const found = tools.find((entry) => entry.tool.name === name);
  if (!found) throw new Error(`missing tool ${name}`);
  return found;
};

const call = async (tool: McpTool, args: Record<string, unknown>, project?: string) => {
  const { ctx, calls } = context(project);
  const result = await tool.handler({ reqContext: ctx, args });
  return { result, calls };
};

const directory = () => selectTools({ toolSurface: 'directory', codeExecutionMode: 'local' });
const codeSurface = () => selectTools({ toolSurface: 'code', codeExecutionMode: 'local' });

const READS = [
  'search_docs',
  'list_projects',
  'list_agents',
  'list_agent_endpoints',
  'list_calls',
  'get_call',
  'get_call_transcript',
  'list_call_metrics',
  'list_metric_definitions',
  'get_simulation_results',
  'list_personas',
  'list_customer_flows',
  'list_simulation_environments',
];

const WRITES = [
  'create_agent',
  'create_agent_endpoint',
  'create_persona',
  'create_customer_flow',
  'run_simulation',
];

describe('directory tool surface', () => {
  const tools = directory();

  it('exposes the named tools and docs search, and not execute', () => {
    expect(tools.map((entry) => entry.tool.name).sort()).toEqual([...READS, ...WRITES].sort());
  });

  it('gives every tool a title and a hint that matches whether it writes', () => {
    for (const { tool, metadata } of tools) {
      expect(tool.title).toEqual(expect.any(String));
      expect(tool.title!.length).toBeGreaterThan(0);
      expect(tool.annotations?.title).toBe(tool.title);
      expect(tool.name.length).toBeLessThanOrEqual(64);

      const readOnly = tool.annotations?.readOnlyHint === true;
      const destructive = tool.annotations?.destructiveHint === true;
      if (metadata.operation === 'read') {
        expect(readOnly).toBe(true);
        expect(destructive).toBe(false);
        expect(metadata.httpMethod).toBe('get');
      } else {
        expect(readOnly).toBe(false);
        expect(destructive).toBe(true);
        expect(metadata.httpMethod).toBe('post');
      }
    }
  });

  // The Claude directory sync rejects a parameter with no JSON Schema type ("Add a type to this
  // parameter"), and clients that convert schemas need one at every depth, not only the top level.
  it('declares a JSON Schema type on every parameter at every depth', () => {
    const untyped: string[] = [];
    const walk = (node: unknown, path: string): void => {
      if (!node || typeof node !== 'object') return;
      const schema = node as Record<string, unknown>;
      if (!('type' in schema)) untyped.push(path);
      const properties = (schema['properties'] ?? {}) as Record<string, unknown>;
      for (const [key, child] of Object.entries(properties)) walk(child, `${path}.${key}`);
      if (schema['items'] && typeof schema['items'] === 'object') walk(schema['items'], `${path}[]`);
      if (schema['additionalProperties'] && typeof schema['additionalProperties'] === 'object') {
        walk(schema['additionalProperties'], `${path}{}`);
      }
    };
    for (const { tool } of tools) walk(tool.inputSchema, tool.name);
    expect(untyped).toEqual([]);
  });

  it('does not collect an intent parameter on any tool', () => {
    for (const { tool } of tools) {
      expect(tool.inputSchema.properties).not.toHaveProperty('intent');
      expect(tool.description ?? '').not.toMatch(/improving the service/i);
    }
  });

  it('keeps tool descriptions factual', () => {
    for (const { tool } of tools) {
      const description = tool.description ?? '';
      expect(description).not.toMatch(/you are a skilled/i);
      expect(description).not.toMatch(/do not add/i);
      expect(description).not.toMatch(/ignore previous/i);
      expect(description.length).toBeGreaterThan(20);
    }
  });

  it('ignores a request to put the code tool back on this surface', () => {
    const names = selectTools({
      toolSurface: 'directory',
      includeCodeTool: true,
      codeExecutionMode: 'local',
    }).map((entry) => entry.tool.name);

    expect(names).not.toContain('execute');
  });
});

describe('code tool surface', () => {
  const tools = codeSurface();

  it('keeps execute and docs search for local installs', () => {
    expect(tools.map((entry) => entry.tool.name).sort()).toEqual(['execute', 'search_docs']);
  });

  it('annotates execute as a write and drops the intent parameter', () => {
    const execute = toolByName(tools, 'execute').tool;

    expect(execute.title).toBe('Run Roark SDK code');
    expect(execute.annotations).toMatchObject({
      title: 'Run Roark SDK code',
      readOnlyHint: false,
      destructiveHint: true,
    });
    expect(execute.inputSchema.properties).not.toHaveProperty('intent');
    expect(execute.inputSchema.required).toEqual(['code']);
    expect(execute.description).not.toMatch(/you are a skilled/i);
    expect(execute.description).toMatch(/async function named run/);
  });

  it('annotates docs search as read-only', () => {
    const docs = toolByName(tools, 'search_docs').tool;

    expect(docs.title).toBe('Search Roark docs');
    expect(docs.annotations).toMatchObject({
      title: 'Search Roark docs',
      readOnlyHint: true,
      destructiveHint: false,
    });
  });
});

describe('directory tool handlers', () => {
  const tools = directory();

  it('lists projects without a project id', async () => {
    const { result, calls } = await call(toolByName(tools, 'list_projects'), {});

    expect(result.isError).toBeUndefined();
    expect(calls.map((entry) => entry.method)).toEqual(['project.list']);
  });

  it('asks for a project when the connection is not pinned', async () => {
    const { result, calls } = await call(toolByName(tools, 'list_agents'), {});

    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({ type: 'text' });
    expect((result.content[0] as { text: string }).text).toMatch(/project id/);
    expect(calls).toEqual([]);
  });

  it('uses the pinned project without calling withOptions', async () => {
    const { calls } = await call(toolByName(tools, 'list_agents'), { limit: 10 }, 'proj_pinned');

    expect(calls).toEqual([{ method: 'agent.list', args: [{ limit: 10 }] }]);
  });

  it('scopes an explicit project onto the client', async () => {
    const { calls } = await call(
      toolByName(tools, 'get_call'),
      { callId: 'call_1', project: 'proj_other' },
      'proj_pinned',
    );

    expect(calls).toEqual([{ method: 'call.getByID', args: ['call_1'], project: 'proj_other' }]);
  });

  it('rejects a simulation run that names more than one way to start', async () => {
    const { result } = await call(toolByName(tools, 'run_simulation'), {
      planId: 'plan_1',
      template: 'live-bench',
      project: 'proj_1',
    });

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toMatch(/exactly one of planId, plan, or template/);
  });

  it('starts a run from a plan id', async () => {
    const { result, calls } = await call(toolByName(tools, 'run_simulation'), {
      planId: 'plan_1',
      project: 'proj_1',
    });

    expect(result.isError).toBeUndefined();
    expect(calls[0]).toMatchObject({
      method: 'simulation.run',
      args: [{ planId: 'plan_1' }],
      project: 'proj_1',
    });
  });

  it('rejects a persona that is missing a required field', async () => {
    const { result, calls } = await call(toolByName(tools, 'create_persona'), {
      name: 'Maria',
      language: 'ES',
      project: 'proj_1',
    });

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toMatch(/accent/);
    expect(calls).toEqual([]);
  });

  it('rejects a persona accent the API does not accept', async () => {
    const { result } = await call(toolByName(tools, 'create_persona'), {
      name: 'Maria',
      language: 'ES',
      accent: 'MARS',
      gender: 'FEMALE',
      project: 'proj_1',
    });

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toMatch(/accent must be one of/);
  });

  it('creates a persona with the required fields', async () => {
    const { calls } = await call(toolByName(tools, 'create_persona'), {
      name: 'Maria',
      language: 'ES',
      accent: 'ES',
      gender: 'FEMALE',
      backstoryPrompt: 'Calling to reschedule',
      project: 'proj_1',
    });

    expect(calls[0]).toMatchObject({
      method: 'simulationPersona.create',
      args: [
        {
          name: 'Maria',
          language: 'ES',
          accent: 'ES',
          gender: 'FEMALE',
          backstoryPrompt: 'Calling to reschedule',
        },
      ],
    });
  });

  it('rejects a customer flow whose happy path has no environment', async () => {
    const { result } = await call(toolByName(tools, 'create_customer_flow'), {
      title: 'Reschedule',
      agentIds: ['agent_1'],
      happyPath: { title: 'Standard', personaOverrideId: 'persona_1' },
      project: 'proj_1',
    });

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toMatch(/environmentId/);
  });

  const agentA = '11111111-1111-4111-8111-111111111111';
  const agentB = '22222222-2222-4222-8222-222222222222';

  it('exposes agent, property, and sort filters on list_calls', () => {
    const schema = toolByName(tools, 'list_calls').tool;
    const properties = schema.inputSchema.properties ?? {};

    expect(properties).toHaveProperty('agentId');
    expect(properties).toHaveProperty('properties');
    expect(properties).toHaveProperty('sortBy');
    expect(properties).toHaveProperty('sortDirection');
    expect(properties['sortBy']).toMatchObject({
      enum: ['createdAt', 'startedAt', 'endedAt', 'duration', 'title', 'status'],
    });
    expect(properties['sortDirection']).toMatchObject({ enum: ['asc', 'desc'] });
    expect(properties['properties']).toMatchObject({
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          eq: { type: 'string' },
          exists: { type: 'boolean' },
        },
      },
    });
    expect(schema.description).toMatch(/agent_name/);
    expect(schema.description).toMatch(/agentName/);
    expect(schema.description).toMatch(/agent_id/);
    expect(schema.description).toMatch(/\beq\b/);
  });

  it('passes agent, property, and sort filters through to call.list', async () => {
    const { calls } = await call(toolByName(tools, 'list_calls'), {
      project: 'proj_1',
      agentId: `${agentA},${agentB}`,
      properties: {
        agent_name: { eq: 'Front Desk' },
        agentName: { eq: 'Front Desk' },
        agent_id: { eq: agentA },
        plan_tier: { exists: false },
      },
      sortBy: 'startedAt',
      sortDirection: 'asc',
      status: 'ENDED',
    });

    expect(calls[0]).toMatchObject({
      method: 'call.list',
      project: 'proj_1',
      args: [
        {
          agentId: `${agentA},${agentB}`,
          properties: {
            agent_name: { eq: 'Front Desk' },
            agentName: { eq: 'Front Desk' },
            agent_id: { eq: agentA },
            plan_tier: { exists: false },
          },
          sortBy: 'startedAt',
          sortDirection: 'asc',
          status: 'ENDED',
        },
      ],
    });
  });

  it('serializes list_calls filters as GET /v1/call query parameters', async () => {
    const seen: string[] = [];
    const client = new Roark({
      bearerToken: 'test-token',
      fetch: async (url) => {
        seen.push(String(url));
        return new Response(
          JSON.stringify({ data: [], pagination: { hasMore: false, nextCursor: null, total: 0 } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    });
    const result = await toolByName(tools, 'list_calls').handler({
      reqContext: { client, project: 'proj_1' },
      args: {
        project: 'proj_1',
        agentId: `${agentA},${agentB}`,
        properties: {
          agent_name: { eq: 'Front Desk' },
          agent_id: { eq: agentA },
          plan_tier: { exists: true },
        },
        sortBy: 'duration',
        sortDirection: 'desc',
      },
    });

    expect(result.isError).toBeUndefined();
    expect(seen).toHaveLength(1);
    const url = new URL(seen[0] ?? '');
    expect(url.pathname).toBe('/v1/call');
    expect(url.searchParams.get('agentId')).toBe(`${agentA},${agentB}`);
    expect(url.searchParams.get('properties[agent_name][eq]')).toBe('Front Desk');
    expect(url.searchParams.get('properties[agent_id][eq]')).toBe(agentA);
    expect(url.searchParams.get('properties[plan_tier][exists]')).toBe('true');
    expect(url.searchParams.get('sortBy')).toBe('duration');
    expect(url.searchParams.get('sortDirection')).toBe('desc');
  });

  it('rejects an agentId list the API would answer with 400', async () => {
    const spaced = await call(toolByName(tools, 'list_calls'), {
      project: 'proj_1',
      agentId: `${agentA}, ${agentB}`,
    });
    expect(spaced.result.isError).toBe(true);
    expect((spaced.result.content[0] as { text: string }).text).toMatch(/no spaces/);
    expect(spaced.calls).toEqual([]);

    const malformed = await call(toolByName(tools, 'list_calls'), {
      project: 'proj_1',
      agentId: 'not-a-uuid',
    });
    expect(malformed.result.isError).toBe(true);
    expect((malformed.result.content[0] as { text: string }).text).toMatch(/UUID/);
    expect(malformed.calls).toEqual([]);

    const tooMany = await call(toolByName(tools, 'list_calls'), {
      project: 'proj_1',
      agentId: Array.from({ length: 101 }, () => agentA).join(','),
    });
    expect(tooMany.result.isError).toBe(true);
    expect((tooMany.result.content[0] as { text: string }).text).toMatch(/100/);
    expect(tooMany.calls).toEqual([]);
  });

  it('rejects a property filter that sets more than one operator', async () => {
    const { result, calls } = await call(toolByName(tools, 'list_calls'), {
      project: 'proj_1',
      properties: { agent_name: { eq: 'Frontdesk', exists: true } },
    });

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toMatch(/exactly one of eq or exists/);
    expect(calls).toEqual([]);
  });

  it('rejects an agent_id property that is not one UUID', async () => {
    const { result, calls } = await call(toolByName(tools, 'list_calls'), {
      project: 'proj_1',
      properties: { agent_id: { eq: `${agentA},${agentB}` } },
    });

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toMatch(/agent_id/);
    expect(calls).toEqual([]);
  });

  it('returns the API error message when the SDK rejects the call', async () => {
    const { ctx } = context('proj_1');
    (ctx.client.agent as unknown as { list: () => Promise<never> }).list = () => {
      throw new APIError(400, { message: 'status is not a call filter' }, undefined, new Headers());
    };
    const result = await toolByName(tools, 'list_agents').handler({
      reqContext: ctx,
      args: { status: 'ENDED' },
    });

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('status is not a call filter');
  });
});
