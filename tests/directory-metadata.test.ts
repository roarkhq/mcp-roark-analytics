import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/ajv-provider.js';
import { configureLogger } from '../src/logger';
import { setLocalSearch } from '../src/docs-search-tool';
import type { LocalDocsSearch } from '../src/local-docs-search';
import { newMcpServer, selectTools } from '../src/server';
import { McpRequestContext, McpTool } from '../src/types';

configureLogger({ level: 'fatal', pretty: false });

const directory = () => selectTools({ toolSurface: 'directory', codeExecutionMode: 'local' });

const toolByName = (tools: McpTool[], name: string): McpTool => {
  const found = tools.find((entry) => entry.tool.name === name);
  if (!found) throw new Error(`missing tool ${name}`);
  return found;
};

/** A client whose every SDK method resolves `response`, scoped or not. */
const clientReturning = (response: unknown): McpRequestContext['client'] => {
  const resource = new Proxy({}, { get: () => () => Promise.resolve(response) });
  const client: Record<string, unknown> = new Proxy(
    {},
    { get: (_target, key) => (key === 'withOptions' ? () => client : resource) },
  );
  return client as unknown as McpRequestContext['client'];
};

const pagination = { hasMore: false, nextCursor: null, total: 1 };
const timestamps = { createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z' };

const agent = { id: 'a1', name: 'Front desk', description: null, customId: null, ...timestamps };
const endpoint = {
  id: 'e1',
  agentId: 'a1',
  type: 'PHONE',
  direction: 'INCOMING',
  value: '+14155550123',
  environment: 'production',
  outboundDialType: 'NONE',
  outboundDialHttpRequestDefinitionId: null,
  ...timestamps,
};
const liveCall = {
  id: 'c1',
  projectId: 'p1',
  callDirection: 'INBOUND',
  recordingUrlAccess: 'AVAILABLE',
  startedAt: '2026-11-01T10:00:00.000Z',
  endedAt: null,
  durationMs: null,
  status: 'IN_PROGRESS',
  title: null,
  summary: null,
  simulationJobId: null,
};
const persona = {
  id: 'pe1',
  name: 'Sam',
  language: 'EN',
  accent: 'US',
  gender: 'FEMALE',
  age: 'ADULT',
  baseEmotion: 'NEUTRAL',
  backstoryPrompt: null,
  description: null,
  ...timestamps,
};
const flow = {
  id: 'f1',
  title: 'Book an appointment',
  type: 'IMPROV',
  source: 'CUSTOM',
  description: null,
  agents: [{ id: 'a1' }],
  agentExpectations: [],
  happyPath: null,
  edgeCases: [],
  ...timestamps,
};

// Response bodies shaped like customer-api's, nulls included, one per tool.
const responses: Record<string, unknown> = {
  list_projects: {
    data: {
      projects: [
        {
          id: 'p1',
          name: 'Support',
          slug: 'support',
          grantedPermissions: ['read'],
          organization: { id: 'o1', name: 'Acme' },
        },
      ],
    },
  },
  list_agents: { data: [agent], pagination },
  list_agent_endpoints: { data: [endpoint], pagination },
  list_calls: { data: [liveCall], pagination },
  get_call: { data: liveCall },
  get_call_transcript: {
    data: {
      transcriptionSource: null,
      participants: [{ id: 'pa1', type: 'AGENT' }],
      entries: [{ participantId: null, role: null, text: 'Hello', startOffsetMs: 0, endOffsetMs: 900 }],
    },
  },
  list_call_metrics: {
    data: [
      {
        metricDefinitionId: 'md1',
        metricId: 'call_outcome',
        slug: 'call_outcome',
        name: 'Call outcome',
        description: 'Whether the caller got what they came for.',
        type: 'BOOLEAN',
        scope: 'GLOBAL',
        value: true,
        captureStatus: 'SUCCESS',
      },
    ],
  },
  list_metric_definitions: {
    data: [
      {
        id: 'md1',
        metricId: 'call_outcome',
        slug: 'call_outcome',
        name: 'Call outcome',
        description: 'Whether the caller got what they came for.',
        type: 'BOOLEAN',
        calculationType: 'LLM_JUDGE',
        scope: 'GLOBAL',
      },
    ],
    pagination: { hasMore: false, nextCursor: null, limit: 500 },
  },
  get_simulation_results: {
    data: {
      run: { simulationRunPlanJobId: 'j1', status: 'RUNNING_SIMULATIONS' },
      summary: { totalCalls: 1, score: null },
      verdict: null,
      metrics: [],
      calls: [],
      comparison: null,
      attemptSummary: { attemptCount: 1 },
      breakdowns: { byAgent: [], byPersona: [] },
      debrief: null,
      sweepAttribution: null,
    },
  },
  list_personas: { data: [persona], pagination },
  list_customer_flows: { data: [flow], pagination },
  list_simulation_environments: {
    data: [
      {
        id: 'en1',
        name: 'Quiet office',
        description: null,
        backgroundNoise: 'NONE',
        backgroundNoiseVolume: 0,
        ...timestamps,
      },
    ],
    pagination,
  },
  create_agent: { data: agent },
  create_agent_endpoint: { data: endpoint },
  create_persona: { data: persona },
  create_customer_flow: { data: flow },
  run_simulation: {
    data: {
      simulationRunPlanJobId: 'j1',
      simulationRunPlanId: 'rp1',
      status: 'PENDING',
      simulationJobCount: 4,
      savedAsPlan: false,
      createdAt: '2026-11-01T10:00:00.000Z',
    },
  },
};

// The local docs index's own result shape: a method match, a documentation match, and the
// truncation note it puts first when results were cut.
const docsResults = {
  results: [
    'Truncated; showing 2 of 3 results.',
    {
      method: 'client.simulationPersona.create',
      summary: 'Create a persona',
      description: 'Creates a simulated caller persona.',
      endpoint: 'POST /v1/persona',
    },
    { content: 'A persona is the simulated caller.', source: 'concepts/personas.md' },
  ],
};
responses['search_docs'] = docsResults;
setLocalSearch({ search: () => docsResults } as unknown as LocalDocsSearch);

// Inputs that pass each handler's own validation.
const inputs: Record<string, Record<string, unknown>> = {
  get_call: { callId: 'c1' },
  get_call_transcript: { callId: 'c1' },
  list_call_metrics: { callId: 'c1' },
  get_simulation_results: { jobId: 'j1' },
  search_docs: { query: 'create a persona', language: 'typescript' },
  create_agent: { name: 'Front desk' },
  create_agent_endpoint: { agentId: 'a1', value: '+14155550123', direction: 'INCOMING' },
  create_persona: { name: 'Sam', language: 'EN', accent: 'US', gender: 'FEMALE' },
  create_customer_flow: {
    title: 'Book an appointment',
    agentIds: ['a1'],
    happyPath: { title: 'Books a slot', personaOverrideId: 'pe1', environmentId: 'en1' },
  },
  run_simulation: { planId: 'rp1' },
};

describe('server metadata', () => {
  it('advertises a title, description, website, and icons in the initialize handshake', async () => {
    const server = await newMcpServer({ toolSurface: 'directory' });
    const client = new Client({ name: 'metadata-test', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const info = client.getServerVersion();
    expect(info).toMatchObject({
      name: 'roarkanalytics_sdk_api',
      title: 'Roark',
      websiteUrl: 'https://roark.ai',
    });
    expect(info?.description).toEqual(expect.any(String));
    expect(info?.icons).toEqual(
      expect.arrayContaining([expect.objectContaining({ mimeType: 'image/svg+xml' })]),
    );
    expect(client.getServerCapabilities()).toMatchObject({ tools: {}, logging: {} });

    await client.close();
  });
});

describe('directory tool annotations', () => {
  const tools = directory();

  it('declares every behavior hint as a boolean', () => {
    for (const { tool } of tools) {
      for (const hint of ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint'] as const) {
        expect([tool.name, typeof tool.annotations?.[hint]]).toEqual([tool.name, 'boolean']);
      }
    }
  });

  it('marks only run_simulation as reaching outside Roark', () => {
    const openWorld = tools
      .filter(({ tool }) => tool.annotations?.openWorldHint)
      .map(({ tool }) => tool.name);
    expect(openWorld).toEqual(['run_simulation']);
  });

  it('marks reads idempotent and writes not', () => {
    for (const { tool, metadata } of tools) {
      expect([tool.name, tool.annotations?.idempotentHint]).toEqual([
        tool.name,
        metadata.operation === 'read',
      ]);
    }
  });
});

describe('directory tool output schemas', () => {
  const tools = directory();
  const validator = new AjvJsonSchemaValidator();
  const withOutput = tools;

  it('declares an object output schema on every tool', () => {
    for (const { tool } of withOutput) {
      expect([tool.name, tool.outputSchema?.type]).toEqual([tool.name, 'object']);
    }
    expect(Object.keys(responses).sort()).toEqual(withOutput.map(({ tool }) => tool.name).sort());
  });

  it.each(Object.keys(responses))(
    '%s returns structuredContent that its output schema accepts',
    async (name) => {
      const { tool, handler } = toolByName(tools, name);
      const response = responses[name];
      const result = await handler({
        reqContext: { client: clientReturning(response), project: 'p1' },
        args: inputs[name] ?? {},
      });

      expect(result.isError).toBeUndefined();
      expect(result.structuredContent).toEqual(response);
      expect(JSON.parse((result.content[0] as { text: string }).text)).toEqual(response);

      const check = validator.getValidator(tool.outputSchema as Parameters<typeof validator.getValidator>[0])(
        result.structuredContent,
      );
      expect([name, check.valid, check.errorMessage]).toEqual([name, true, undefined]);
    },
  );

  it('accepts grouped call metric rows as well as flattened ones', () => {
    const schema = toolByName(tools, 'list_call_metrics').tool.outputSchema;
    const grouped = {
      data: [
        {
          metricDefinitionId: 'md1',
          metricId: 'call_outcome',
          slug: 'call_outcome',
          name: 'Call outcome',
          description: 'Whether the caller got what they came for.',
          type: 'BOOLEAN',
          scope: 'GLOBAL',
          values: [{ value: true }],
        },
      ],
    };
    const check = validator.getValidator(schema as Parameters<typeof validator.getValidator>[0])(grouped);
    expect(check.valid).toBe(true);
  });

  it('returns no structuredContent on an error', async () => {
    const result = await toolByName(tools, 'get_call').handler({
      reqContext: { client: clientReturning({ data: {} }), project: 'p1' },
      args: {},
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
  });

  it.each([[[]], [null], [undefined], ['ok']])(
    'reports a non-object API response (%p) as an error, not unstructured content',
    async (response) => {
      const result = await toolByName(tools, 'list_agents').handler({
        reqContext: { client: clientReturning(response), project: 'p1' },
        args: {},
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent).toBeUndefined();
      expect((result.content[0] as { text: string }).text).toMatch(/Unexpected response from the Roark API/);
    },
  );
});
