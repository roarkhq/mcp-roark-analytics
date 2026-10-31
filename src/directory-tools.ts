// Named tools for the remote OAuth server that Claude's connector directory reviews.
//
// The directory rejects one tool that both reads and writes. `execute` is that tool:
// a snippet can call any SDK method. This surface replaces it with one tool per
// action, each a single HTTP method, for the operations Roark users actually do:
// look up a project, read agents, calls, transcripts, and simulation results, and
// separately create a persona or customer flow and start a simulation.
//
// The local code-execution server stays on `execute`. This file is not generated.

import { APIError, type Roark } from '@roarkanalytics/sdk';
import type { SimulationRunParams } from '@roarkanalytics/sdk/resources/simulation';
import type { SimulationPersonaCreateParams } from '@roarkanalytics/sdk/resources/simulation-persona';
import type { CustomerFlowCreateParams } from '@roarkanalytics/sdk/resources/customer-flow';
import type { AgentEndpointCreateParams } from '@roarkanalytics/sdk/resources/agent-endpoint';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  McpRequestContext,
  McpTool,
  Metadata,
  ToolCallResult,
  asErrorResult,
  asTextContentResult,
} from './types';

/**
 * Server instructions for the directory surface.
 *
 * Kept in-process on purpose. The code-execution server fetches its instructions
 * from Stainless, and that document tells the model how to write snippets. The
 * directory reviews tool text for instructions that are not about the tool, so
 * this surface describes what the server does and stops there.
 */
export const DIRECTORY_SERVER_INSTRUCTIONS =
  'Roark is a voice and chat agent observability and simulation platform. ' +
  'This server reads agents, calls, transcripts, simulation results, and metrics, ' +
  'and it can create agents, phone endpoints, personas, and customer flows, and start simulations, in the signed-in account. ' +
  'Each tool does one of those things. ' +
  'Tools that act inside a project take a project id when the connection is not already pinned to one. ' +
  'list_projects returns the projects this credential can use.';

const ACCENTS = [
  'US',
  'US_X_SOUTH',
  'GB',
  'ES',
  'DE',
  'IN',
  'FR',
  'NL',
  'SA',
  'GR',
  'AU',
  'IT',
  'ID',
  'TH',
  'JP',
  'NZ',
  'PH',
  'SG',
  'MY',
  'HK',
  'TR',
  'PT',
  'IL',
] as const;

const LANGUAGES = [
  'EN',
  'ES',
  'DE',
  'HI',
  'FR',
  'NL',
  'AR',
  'EL',
  'IT',
  'ID',
  'TH',
  'JA',
  'TL',
  'MS',
  'ZH',
  'TR',
  'PT',
  'HE',
] as const;

const GENDERS = ['MALE', 'FEMALE'] as const;
const AGES = ['CHILD', 'TEENAGER', 'ADULT', 'ELDERLY'] as const;
const EMOTIONS = [
  'NEUTRAL',
  'CHEERFUL',
  'CONFUSED',
  'FRUSTRATED',
  'SKEPTICAL',
  'RUSHED',
  'DISTRACTED',
  'ANGRY',
  'ANXIOUS',
  'SAD',
] as const;

const DIRECTIONS = ['INBOUND', 'OUTBOUND'] as const;
const ENDPOINT_DIRECTIONS = ['INCOMING', 'OUTGOING', 'INCOMING_AND_OUTGOING'] as const;
const CALL_STATUSES = ['RINGING', 'IN_PROGRESS', 'ENDED'] as const;
const FLOW_TYPES = ['SCRIPTED', 'IMPROV', 'VOICEMAIL'] as const;
const TRANSCRIPT_SOURCES = [
  'ROARK_POST_CALL',
  'SIMULATION_AGENT_REALTIME',
  'CUSTOMER_AGENT_REALTIME',
] as const;

class ToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolInputError';
  }
}

const readAnnotations = (title: string) => ({
  title,
  readOnlyHint: true as const,
  destructiveHint: false as const,
});

const writeAnnotations = (title: string) => ({
  title,
  readOnlyHint: false as const,
  destructiveHint: true as const,
});

const projectProperty = {
  type: 'string' as const,
  description:
    'Roark project id. Required when this connection is not already pinned to one project. list_projects returns the ids this credential can use.',
};

const pagingProperties = {
  after: {
    type: 'string' as const,
    description: 'Cursor from a previous response. Omit for the first page.',
  },
  limit: {
    type: 'number' as const,
    description: 'Maximum number of rows to return.',
  },
};

type JsonSchema = Tool['inputSchema'];

const objectSchema = (properties: JsonSchema['properties'], required?: string[]): JsonSchema => ({
  type: 'object',
  properties,
  ...(required && required.length > 0 ? { required } : {}),
});

const readMeta = (resource: string, httpPath: string): Metadata => ({
  resource,
  operation: 'read',
  tags: [],
  httpMethod: 'get',
  httpPath,
});

const writeMeta = (resource: string, httpPath: string): Metadata => ({
  resource,
  operation: 'write',
  tags: [],
  httpMethod: 'post',
  httpPath,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requireString = (args: Record<string, unknown>, key: string): string => {
  const value = args[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new ToolInputError(`${key} is required and must be a non-empty string.`);
  }
  return value;
};

const optionalString = (args: Record<string, unknown>, key: string): string | undefined => {
  if (args[key] === undefined) return undefined;
  return requireString(args, key);
};

const optionalNumber = (args: Record<string, unknown>, key: string): number | undefined => {
  if (args[key] === undefined) return undefined;
  const value = args[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ToolInputError(`${key} must be a number.`);
  }
  return value;
};

const optionalLimit = (args: Record<string, unknown>): number | undefined => {
  const value = optionalNumber(args, 'limit');
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 1) {
    throw new ToolInputError('limit must be an integer of at least 1.');
  }
  return value;
};

const requireEnum = <T extends string>(
  args: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T => {
  const value = requireString(args, key);
  if (!allowed.includes(value as T)) {
    throw new ToolInputError(`${key} must be one of: ${allowed.join(', ')}.`);
  }
  return value as T;
};

const optionalEnum = <T extends string>(
  args: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T | undefined => {
  if (args[key] === undefined) return undefined;
  return requireEnum(args, key, allowed);
};

const requireStringArray = (args: Record<string, unknown>, key: string): string[] => {
  const value = args[key];
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((entry) => typeof entry !== 'string' || entry.length === 0)
  ) {
    throw new ToolInputError(`${key} is required and must be a non-empty array of strings.`);
  }
  return value;
};

const requireRecord = (args: Record<string, unknown>, key: string): Record<string, unknown> => {
  const value = args[key];
  if (!isRecord(value)) {
    throw new ToolInputError(`${key} is required and must be an object.`);
  }
  return value;
};

/**
 * The unpinned connector (`/mcp`) has no project, and customer-api rejects a call
 * that names none. A pinned connector already set `reqContext.project` on the SDK
 * client, so passing the same id again would be a second, conflicting scope.
 */
const scopedClient = (reqContext: McpRequestContext, args: Record<string, unknown>): Roark => {
  if (
    args['project'] !== undefined &&
    (typeof args['project'] !== 'string' || args['project'].length === 0)
  ) {
    throw new ToolInputError('project must be a non-empty string.');
  }
  const project = typeof args['project'] === 'string' ? args['project'] : reqContext.project;
  if (!project) {
    throw new ToolInputError(
      'This connection is not pinned to a project. Pass a project id. list_projects returns the projects this credential can use.',
    );
  }
  if (project === reqContext.project) return reqContext.client;
  return reqContext.client.withOptions({ project });
};

/**
 * Drops keys whose value is undefined.
 *
 * `exactOptionalPropertyTypes` rejects `{ after: string | undefined }` for an
 * SDK query type whose `after` is optional, so the returned type has to say
 * the key is absent rather than present-and-undefined.
 */
const omitUndefined = <T extends Record<string, unknown>>(
  value: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } => {
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) out[key] = entry;
  }
  return out as { [K in keyof T]?: Exclude<T[K], undefined> };
};

const callApi = async (fn: () => Promise<unknown>): Promise<ToolCallResult> => {
  try {
    return asTextContentResult(await fn());
  } catch (error) {
    if (error instanceof ToolInputError || error instanceof APIError || error instanceof Error) {
      return asErrorResult(error.message);
    }
    return asErrorResult(String(error));
  }
};

const handler =
  (fn: (reqContext: McpRequestContext, args: Record<string, unknown>) => Promise<unknown>) =>
  async ({
    reqContext,
    args,
  }: {
    reqContext: McpRequestContext;
    args: Record<string, unknown> | undefined;
  }): Promise<ToolCallResult> =>
    callApi(() => fn(reqContext, args ?? {}));

const defineTool = (
  name: string,
  title: string,
  description: string,
  inputSchema: JsonSchema,
  annotations: Tool['annotations'],
  metadata: Metadata,
  fn: (reqContext: McpRequestContext, args: Record<string, unknown>) => Promise<unknown>,
): McpTool => ({
  metadata,
  tool: {
    name,
    title,
    description,
    inputSchema,
    annotations,
  },
  handler: handler(fn),
});

const endpointSchema = {
  type: 'object' as const,
  description: 'An agent endpoint Roark dials or connects to.',
  properties: {
    id: { type: 'string' as const, description: 'Agent endpoint id from list_agent_endpoints.' },
  },
  required: ['id'],
};

const metricRefSchema = {
  type: 'object' as const,
  description: 'A metric to score, by id or by slug.',
  properties: {
    id: { type: 'string' as const, description: 'Metric definition id.' },
    slug: { type: 'string' as const, description: 'Metric slug, such as call_outcome.' },
  },
};

const flowAttachmentSchema = {
  type: 'object' as const,
  description:
    'A customer flow to include. Set happyPath, edgeCases, or both. id comes from list_customer_flows.',
  properties: {
    id: { type: 'string' as const, description: 'Customer flow id.' },
    slug: { type: 'string' as const, description: 'Roark-curated flow slug, used instead of id.' },
    happyPath: { type: 'boolean' as const, description: 'Whether to run the flow happy path.' },
    edgeCases: {
      description: 'ALL runs every edge case. An array runs only the named edge case ids.',
    },
    personaOverrideId: { type: 'string' as const, description: 'Persona id to use for this attachment.' },
  },
};

const buildRunBody = (args: Record<string, unknown>): SimulationRunParams => {
  const hasPlanId = args['planId'] !== undefined;
  const hasPlan = args['plan'] !== undefined;
  const hasTemplate = args['template'] !== undefined;
  const selected = [hasPlanId, hasPlan, hasTemplate].filter(Boolean).length;
  if (selected !== 1) {
    throw new ToolInputError('Pass exactly one of planId, plan, or template.');
  }
  if (args['saveAsPlan'] !== undefined && typeof args['saveAsPlan'] !== 'boolean') {
    throw new ToolInputError('saveAsPlan must be a boolean.');
  }
  if (args['saveAsPlan'] !== undefined && !hasPlan) {
    throw new ToolInputError('saveAsPlan applies only when plan is set.');
  }
  if (args['variables'] !== undefined && !isRecord(args['variables']) && !Array.isArray(args['variables'])) {
    throw new ToolInputError('variables must be an object or an array.');
  }

  if (hasPlanId) {
    const planId = requireString(args, 'planId');
    const body: SimulationRunParams.RunSimulationFromPlanID = { planId };
    if (args['variables'] !== undefined) {
      body.variables = args['variables'] as NonNullable<
        SimulationRunParams.RunSimulationFromPlanID['variables']
      >;
    }
    return body;
  }

  if (hasTemplate) {
    const template = requireString(args, 'template');
    if (!Array.isArray(args['agentEndpoints']) || args['agentEndpoints'].length === 0) {
      throw new ToolInputError('A template run requires agentEndpoints, a non-empty array of { id }.');
    }
    const direction = requireEnum(args, 'direction', DIRECTIONS);
    const body: SimulationRunParams.RunSimulationFromTemplate = {
      template,
      direction,
      agentEndpoints: args[
        'agentEndpoints'
      ] as SimulationRunParams.RunSimulationFromTemplate['agentEndpoints'],
    };
    if (args['flows'] !== undefined) {
      if (!Array.isArray(args['flows'])) throw new ToolInputError('flows must be an array.');
      body.flows = args['flows'] as NonNullable<SimulationRunParams.RunSimulationFromTemplate['flows']>;
    }
    const iterationCount = optionalNumber(args, 'iterationCount');
    if (iterationCount !== undefined) body.iterationCount = iterationCount;
    const maxSimulationDurationSeconds = optionalNumber(args, 'maxSimulationDurationSeconds');
    if (maxSimulationDurationSeconds !== undefined)
      body.maxSimulationDurationSeconds = maxSimulationDurationSeconds;
    return body;
  }

  const plan = requireRecord(args, 'plan');
  if (!Array.isArray(plan['agentEndpoints']) || plan['agentEndpoints'].length === 0) {
    throw new ToolInputError('plan.agentEndpoints must be a non-empty array of { id }.');
  }
  if (plan['direction'] !== 'INBOUND' && plan['direction'] !== 'OUTBOUND') {
    throw new ToolInputError('plan.direction must be INBOUND or OUTBOUND.');
  }
  if (
    typeof plan['maxSimulationDurationSeconds'] !== 'number' ||
    !Number.isFinite(plan['maxSimulationDurationSeconds'])
  ) {
    throw new ToolInputError('plan.maxSimulationDurationSeconds must be a number of seconds.');
  }
  const body: SimulationRunParams.RunSimulationFromConfig = {
    plan: plan as unknown as SimulationRunParams.RunSimulationFromConfig['plan'],
  };
  if (typeof args['saveAsPlan'] === 'boolean') body.saveAsPlan = args['saveAsPlan'];
  if (args['variables'] !== undefined) {
    body.variables = args['variables'] as NonNullable<
      SimulationRunParams.RunSimulationFromConfig['variables']
    >;
  }
  return body;
};

const buildPersonaBody = (args: Record<string, unknown>): SimulationPersonaCreateParams => {
  const body: SimulationPersonaCreateParams = {
    name: requireString(args, 'name'),
    language: requireEnum(args, 'language', LANGUAGES),
    accent: requireEnum(args, 'accent', ACCENTS),
    gender: requireEnum(args, 'gender', GENDERS),
  };
  const age = optionalEnum(args, 'age', AGES);
  if (age) body.age = age;
  const baseEmotion = optionalEnum(args, 'baseEmotion', EMOTIONS);
  if (baseEmotion) body.baseEmotion = baseEmotion;
  const backstoryPrompt = optionalString(args, 'backstoryPrompt');
  if (backstoryPrompt) body.backstoryPrompt = backstoryPrompt;
  const description = optionalString(args, 'description');
  if (description) body.description = description;
  return body;
};

const buildFlowBody = (args: Record<string, unknown>): CustomerFlowCreateParams => {
  const happyPath = requireRecord(args, 'happyPath');
  const prompt = optionalString(happyPath, 'prompt');
  const description = optionalString(args, 'description');
  const body: CustomerFlowCreateParams = {
    type: 'IMPROV',
    title: requireString(args, 'title'),
    agentIds: requireStringArray(args, 'agentIds'),
    happyPath: {
      title: requireString(happyPath, 'title'),
      personaOverrideId: requireString(happyPath, 'personaOverrideId'),
      environmentId: requireString(happyPath, 'environmentId'),
      ...(prompt ? { prompt } : {}),
    },
    ...(description ? { description } : {}),
  };
  if (args['edgeCases'] !== undefined) {
    if (!Array.isArray(args['edgeCases'])) {
      throw new ToolInputError('edgeCases must be an array.');
    }
    body.edgeCases = args['edgeCases'].map((entry, index) => {
      if (!isRecord(entry)) throw new ToolInputError(`edgeCases[${index}] must be an object.`);
      const edgePrompt = optionalString(entry, 'prompt');
      const personaOverrideId = optionalString(entry, 'personaOverrideId');
      const environmentId = optionalString(entry, 'environmentId');
      return {
        title: requireString(entry, 'title'),
        ...(edgePrompt ? { prompt: edgePrompt } : {}),
        ...(personaOverrideId ? { personaOverrideId } : {}),
        ...(environmentId ? { environmentId } : {}),
      };
    });
  }
  return body;
};

const buildEndpointBody = (args: Record<string, unknown>): AgentEndpointCreateParams => {
  const outboundDialType = optionalEnum(args, 'outboundDialType', ['NONE', 'HTTP_REQUEST'] as const);
  const outboundDialHttpRequestDefinitionId = optionalString(args, 'outboundDialHttpRequestDefinitionId');
  if (outboundDialType === 'HTTP_REQUEST' && !outboundDialHttpRequestDefinitionId) {
    throw new ToolInputError(
      'outboundDialHttpRequestDefinitionId is required when outboundDialType is HTTP_REQUEST.',
    );
  }
  const value = requireString(args, 'value');
  if (!value.startsWith('+')) {
    throw new ToolInputError('value must be a phone number in E.164 format, starting with +.');
  }
  const environment = optionalString(args, 'environment');
  return {
    agentId: requireString(args, 'agentId'),
    direction: requireEnum(args, 'direction', ENDPOINT_DIRECTIONS),
    value,
    ...(environment ? { environment } : {}),
    ...(outboundDialType ? { outboundDialType } : {}),
    ...(outboundDialHttpRequestDefinitionId ? { outboundDialHttpRequestDefinitionId } : {}),
  };
};

/**
 * Tools exposed on the directory surface. Order is the core loop: find the
 * project, read what is already there, then the writes that change it.
 */
export function directoryTools(): McpTool[] {
  return [
    defineTool(
      'list_projects',
      'List projects',
      'Lists the Roark projects this credential can use, with the permissions it holds in each. Returns each project id, name, slug, and organization.',
      objectSchema({}),
      readAnnotations('List projects'),
      readMeta('project', '/v1/projects'),
      async (reqContext) => reqContext.client.project.list(),
    ),
    defineTool(
      'list_agents',
      'List agents',
      'Lists voice and chat agents in a Roark project. Returns each agent id, name, custom id, and description.',
      objectSchema({
        project: projectProperty,
        searchText: { type: 'string', description: 'Match against agent name or description.' },
        ...pagingProperties,
      }),
      readAnnotations('List agents'),
      readMeta('agent', '/v1/agent'),
      async (reqContext, args) =>
        scopedClient(reqContext, args).agent.list(
          omitUndefined({
            searchText: optionalString(args, 'searchText'),
            after: optionalString(args, 'after'),
            limit: optionalLimit(args),
          }),
        ),
    ),
    defineTool(
      'list_agent_endpoints',
      'List agent endpoints',
      'Lists the endpoints Roark uses to reach agents in a project. Returns each endpoint id, agent id, direction, type, and address. A simulation runs against an endpoint id.',
      objectSchema({
        project: projectProperty,
        agentId: { type: 'string', description: 'Return endpoints for this agent only.' },
        searchText: { type: 'string', description: 'Match against endpoint address or environment name.' },
        ...pagingProperties,
      }),
      readAnnotations('List agent endpoints'),
      readMeta('agentEndpoint', '/v1/agent/endpoint'),
      async (reqContext, args) =>
        scopedClient(reqContext, args).agentEndpoint.list(
          omitUndefined({
            agentId: optionalString(args, 'agentId'),
            searchText: optionalString(args, 'searchText'),
            after: optionalString(args, 'after'),
            limit: optionalLimit(args),
          }),
        ),
    ),
    defineTool(
      'list_calls',
      'List calls',
      'Lists calls in a Roark project, including simulated and live calls. Returns call ids, status, direction, and timestamps. Does not include transcripts.',
      objectSchema({
        project: projectProperty,
        searchText: { type: 'string', description: 'Match against call title, summary, or transcript text.' },
        status: { type: 'string', enum: [...CALL_STATUSES], description: 'Call status filter.' },
        simulationRunPlanJobId: {
          type: 'string',
          description: 'Return calls from this simulation run only.',
        },
        ...pagingProperties,
      }),
      readAnnotations('List calls'),
      readMeta('call', '/v1/call'),
      async (reqContext, args) =>
        scopedClient(reqContext, args).call.list(
          omitUndefined({
            searchText: optionalString(args, 'searchText'),
            status: optionalEnum(args, 'status', CALL_STATUSES),
            simulationRunPlanJobId: optionalString(args, 'simulationRunPlanJobId'),
            after: optionalString(args, 'after'),
            limit: optionalLimit(args),
          }),
        ),
    ),
    defineTool(
      'get_call',
      'Get call',
      'Returns one call in a Roark project by its id, including status, direction, timestamps, and summary. Does not include the transcript.',
      objectSchema(
        {
          project: projectProperty,
          callId: { type: 'string', description: 'Call id.' },
        },
        ['callId'],
      ),
      readAnnotations('Get call'),
      readMeta('call', '/v1/call/{callId}'),
      async (reqContext, args) => scopedClient(reqContext, args).call.getByID(requireString(args, 'callId')),
    ),
    defineTool(
      'get_call_transcript',
      'Get call transcript',
      'Returns the transcript of one call in a Roark project: participants and the text of each turn, with timing.',
      objectSchema(
        {
          project: projectProperty,
          callId: { type: 'string', description: 'Call id.' },
          source: {
            type: 'string',
            enum: [...TRANSCRIPT_SOURCES],
            description:
              'Transcription source. When omitted, the API uses the best source it has for the call.',
          },
        },
        ['callId'],
      ),
      readAnnotations('Get call transcript'),
      readMeta('call', '/v1/call/{callId}/transcript'),
      async (reqContext, args) =>
        scopedClient(reqContext, args).call.getTranscript(
          requireString(args, 'callId'),
          omitUndefined({ source: optionalEnum(args, 'source', TRANSCRIPT_SOURCES) }),
        ),
    ),
    defineTool(
      'list_call_metrics',
      'List call metrics',
      'Returns the metric scores recorded for one call in a Roark project. status success returns computed scores only. status all also returns rows that have no value. flatten true returns one row per score; when omitted, scores are grouped by metric.',
      objectSchema(
        {
          project: projectProperty,
          callId: { type: 'string', description: 'Call id.' },
          flatten: {
            type: 'string',
            description:
              'true returns one row per score. Any other value, or omitting it, groups scores by metric.',
          },
          status: {
            type: 'string',
            enum: ['success', 'all'],
            description: 'success returns computed scores. all also returns rows with no value.',
          },
        },
        ['callId'],
      ),
      readAnnotations('List call metrics'),
      readMeta('call', '/v1/call/{callId}/metrics'),
      async (reqContext, args) =>
        scopedClient(reqContext, args).call.listMetrics(
          requireString(args, 'callId'),
          omitUndefined({
            flatten: optionalString(args, 'flatten'),
            status: optionalEnum(args, 'status', ['success', 'all'] as const),
          }),
        ),
    ),
    defineTool(
      'list_metric_definitions',
      'List metric definitions',
      'Lists the metrics a Roark project can score, including built-in and custom metrics. Returns each metric id, slug, name, and type.',
      objectSchema({ project: projectProperty, ...pagingProperties }),
      readAnnotations('List metric definitions'),
      readMeta('metric', '/v1/metric/definitions'),
      async (reqContext, args) =>
        scopedClient(reqContext, args).metric.listDefinitions(
          omitUndefined({ after: optionalString(args, 'after'), limit: optionalLimit(args) }),
        ),
    ),
    defineTool(
      'get_simulation_results',
      'Get simulation results',
      'Returns the results of one simulation run in a Roark project: run status, score, pass or fail verdict, per-metric aggregates, and the checks on each simulated call. Counts include calls that have finished so far. The verdict is absent until the run ends.',
      objectSchema(
        {
          project: projectProperty,
          jobId: {
            type: 'string',
            description: 'Simulation run id (simulationRunPlanJobId), returned by run_simulation.',
          },
          compareToJobId: {
            type: 'string',
            description:
              'Another simulation run id to compare against. When omitted, the API compares with the previous settled run of the same plan.',
          },
        },
        ['jobId'],
      ),
      readAnnotations('Get simulation results'),
      readMeta('simulationRunPlanJob', '/v1/simulation/plan/job/{jobId}/results'),
      async (reqContext, args) =>
        scopedClient(reqContext, args).simulationRunPlanJob.getResults(
          requireString(args, 'jobId'),
          omitUndefined({ compareToJobId: optionalString(args, 'compareToJobId') }),
        ),
    ),
    defineTool(
      'list_personas',
      'List personas',
      'Lists simulated caller personas in a Roark project. Returns each persona id, name, language, accent, and gender.',
      objectSchema({
        project: projectProperty,
        searchText: { type: 'string', description: 'Match against persona name or description.' },
        ...pagingProperties,
      }),
      readAnnotations('List personas'),
      readMeta('simulationPersona', '/v1/persona'),
      async (reqContext, args) =>
        scopedClient(reqContext, args).simulationPersona.list(
          omitUndefined({
            searchText: optionalString(args, 'searchText'),
            after: optionalString(args, 'after'),
            limit: optionalLimit(args),
          }),
        ),
    ),
    defineTool(
      'list_customer_flows',
      'List customer flows',
      'Lists customer flows in a Roark project. A customer flow is the conversation scenario a simulated caller follows. Returns each flow id, title, and type. The step graph of a scripted flow is not included.',
      objectSchema({
        project: projectProperty,
        searchText: { type: 'string', description: 'Match against flow title.' },
        type: { type: 'string', enum: [...FLOW_TYPES], description: 'Flow type filter.' },
        includeSystem: {
          type: 'string',
          enum: ['true', 'false'],
          description: 'true includes flows Roark provides. false returns only flows in the project.',
        },
        ...pagingProperties,
      }),
      readAnnotations('List customer flows'),
      readMeta('customerFlow', '/v1/customer-flow'),
      async (reqContext, args) =>
        scopedClient(reqContext, args).customerFlow.list(
          omitUndefined({
            searchText: optionalString(args, 'searchText'),
            type: optionalEnum(args, 'type', FLOW_TYPES),
            includeSystem: optionalEnum(args, 'includeSystem', ['true', 'false'] as const),
            after: optionalString(args, 'after'),
            limit: optionalLimit(args),
          }),
        ),
    ),
    defineTool(
      'list_simulation_environments',
      'List simulation environments',
      'Lists call environments in a Roark project, including environments Roark provides. Returns each environment id, name, and background noise. Creating a customer flow requires an environment id.',
      objectSchema({ project: projectProperty, ...pagingProperties }),
      readAnnotations('List simulation environments'),
      readMeta('simulationEnvironment', '/v1/simulation/environment'),
      async (reqContext, args) =>
        scopedClient(reqContext, args).simulationEnvironment.list(
          omitUndefined({ after: optionalString(args, 'after'), limit: optionalLimit(args) }),
        ),
    ),
    defineTool(
      'create_agent',
      'Create agent',
      'Creates an agent in a Roark project. Requires a name. Returns the created agent, including its id. Does not create an endpoint.',
      objectSchema(
        {
          project: projectProperty,
          name: { type: 'string', description: 'Agent name.' },
          description: { type: 'string', description: 'What the agent does.' },
          customId: { type: 'string', description: 'Caller-chosen id, unique in the project.' },
        },
        ['name'],
      ),
      writeAnnotations('Create agent'),
      writeMeta('agent', '/v1/agent'),
      async (reqContext, args) =>
        scopedClient(reqContext, args).agent.create({
          name: requireString(args, 'name'),
          ...omitUndefined({
            description: optionalString(args, 'description'),
            customId: optionalString(args, 'customId'),
          }),
        }),
    ),
    defineTool(
      'create_agent_endpoint',
      'Create agent endpoint',
      'Creates a phone endpoint for an agent in a Roark project. Roark places simulated calls to this number. Requires an agent id, an E.164 phone number, and a direction of INCOMING, OUTGOING, or INCOMING_AND_OUTGOING. Phone is the only endpoint type this tool creates.',
      objectSchema(
        {
          project: projectProperty,
          agentId: { type: 'string', description: 'Agent id from list_agents or create_agent.' },
          value: { type: 'string', description: 'Phone number in E.164 format, starting with +.' },
          direction: {
            type: 'string',
            enum: [...ENDPOINT_DIRECTIONS],
            description: 'Which way calls can travel on this number.',
          },
          environment: { type: 'string', description: 'Environment name. The API default is production.' },
          outboundDialType: {
            type: 'string',
            enum: ['NONE', 'HTTP_REQUEST'],
            description: 'How Roark places an outbound call. The API default is NONE.',
          },
          outboundDialHttpRequestDefinitionId: {
            type: 'string',
            description: 'HTTP request definition id. Required when outboundDialType is HTTP_REQUEST.',
          },
        },
        ['agentId', 'value', 'direction'],
      ),
      writeAnnotations('Create agent endpoint'),
      writeMeta('agentEndpoint', '/v1/agent/endpoint'),
      async (reqContext, args) =>
        scopedClient(reqContext, args).agentEndpoint.create(buildEndpointBody(args)),
    ),
    defineTool(
      'create_persona',
      'Create persona',
      'Creates a simulated caller persona in a Roark project. Requires a name, language, accent, and gender. Returns the created persona, including its id.',
      objectSchema(
        {
          project: projectProperty,
          name: { type: 'string', description: 'Name the caller uses in conversation.' },
          language: { type: 'string', enum: [...LANGUAGES], description: 'Primary spoken language.' },
          accent: { type: 'string', enum: [...ACCENTS], description: 'Accent the persona is voiced with.' },
          gender: { type: 'string', enum: [...GENDERS], description: 'Gender the persona is voiced with.' },
          age: {
            type: 'string',
            enum: [...AGES],
            description: 'How old the caller sounds. The API default is ADULT.',
          },
          baseEmotion: {
            type: 'string',
            enum: [...EMOTIONS],
            description: 'Emotional baseline. The API default is NEUTRAL.',
          },
          backstoryPrompt: {
            type: 'string',
            description: 'Background and behavior the simulated caller plays.',
          },
          description: { type: 'string', description: 'Short label for the persona.' },
        },
        ['name', 'language', 'accent', 'gender'],
      ),
      writeAnnotations('Create persona'),
      writeMeta('simulationPersona', '/v1/persona'),
      async (reqContext, args) =>
        scopedClient(reqContext, args).simulationPersona.create(buildPersonaBody(args)),
    ),
    defineTool(
      'create_customer_flow',
      'Create customer flow',
      'Creates an improv customer flow in a Roark project. A customer flow is the conversation scenario a simulated caller follows. Requires a title, at least one agent id, and a happy path with a title, a persona id, and an environment id. Returns the created flow, including its id. Scripted step graphs are not created by this tool.',
      objectSchema(
        {
          project: projectProperty,
          title: { type: 'string', description: 'Flow title.' },
          description: { type: 'string', description: 'What the conversation covers.' },
          agentIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Agents this flow exercises. At least one.',
          },
          happyPath: {
            type: 'object',
            description: 'The way the conversation is meant to go.',
            properties: {
              title: { type: 'string', description: 'Happy path title.' },
              prompt: { type: 'string', description: 'What the simulated caller is trying to do.' },
              personaOverrideId: {
                type: 'string',
                description: 'Persona id from list_personas or create_persona.',
              },
              environmentId: {
                type: 'string',
                description: 'Environment id from list_simulation_environments.',
              },
            },
            required: ['title', 'personaOverrideId', 'environmentId'],
          },
          edgeCases: {
            type: 'array',
            description:
              'Other ways of running the flow. Each inherits the happy path persona and environment when those are omitted.',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                prompt: { type: 'string' },
                personaOverrideId: { type: 'string' },
                environmentId: { type: 'string' },
              },
              required: ['title'],
            },
          },
        },
        ['title', 'agentIds', 'happyPath'],
      ),
      writeAnnotations('Create customer flow'),
      writeMeta('customerFlow', '/v1/customer-flow'),
      async (reqContext, args) => scopedClient(reqContext, args).customerFlow.create(buildFlowBody(args)),
    ),
    defineTool(
      'run_simulation',
      'Run simulation',
      'Starts a simulation run in a Roark project and places simulated calls. Pass exactly one of planId (an existing plan), plan (an inline plan), or template (a built-in template name, with agentEndpoints and direction). Returns the run id and how many calls the run places. This spends simulation usage on the account.',
      objectSchema({
        project: projectProperty,
        planId: { type: 'string', description: 'Id of a saved simulation plan to run.' },
        plan: {
          type: 'object',
          description:
            'Inline plan to run once. Requires agentEndpoints, direction, and maxSimulationDurationSeconds.',
          properties: {
            name: { type: 'string', description: 'Plan name. Required when saveAsPlan is true.' },
            description: { type: 'string' },
            direction: { type: 'string', enum: [...DIRECTIONS] },
            agentEndpoints: { type: 'array', items: endpointSchema },
            metrics: {
              type: 'array',
              items: metricRefSchema,
              description: 'Metrics to score, by id or slug.',
            },
            flows: { type: 'array', items: flowAttachmentSchema },
            maxSimulationDurationSeconds: { type: 'number', description: 'Per-call cap, in seconds.' },
            iterationCount: {
              type: 'number',
              description: 'Repeats of each test case. The API default is 1.',
            },
            maxConcurrentJobs: {
              type: 'number',
              description: 'How many calls run at once. The API default is 5.',
            },
            executionMode: {
              type: 'string',
              enum: ['PARALLEL', 'SEQUENTIAL_SAME_RUN_PLAN', 'SEQUENTIAL_PROJECT'],
            },
          },
          required: ['agentEndpoints', 'direction', 'maxSimulationDurationSeconds'],
        },
        template: {
          type: 'string',
          description: 'Built-in template name, as listed by the simulation template API.',
        },
        agentEndpoints: {
          type: 'array',
          items: endpointSchema,
          description: 'Required with template. The endpoints the template calls.',
        },
        direction: { type: 'string', enum: [...DIRECTIONS], description: 'Required with template.' },
        flows: {
          type: 'array',
          items: flowAttachmentSchema,
          description: 'Flows for a template that does not supply its own.',
        },
        iterationCount: { type: 'number' },
        maxSimulationDurationSeconds: { type: 'number' },
        saveAsPlan: {
          type: 'boolean',
          description:
            'When plan is set, true keeps the plan so it can be run again by planId. Requires plan.name.',
        },
        variables: {
          description:
            'Placeholder values for the run. An object applies to the whole run. An array applies per flow.',
        },
      }),
      writeAnnotations('Run simulation'),
      writeMeta('simulation', '/v1/simulation/run'),
      async (reqContext, args) => scopedClient(reqContext, args).simulation.run(buildRunBody(args)),
    ),
  ];
}
