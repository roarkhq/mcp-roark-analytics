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
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  McpRequestContext,
  McpTool,
  Metadata,
  ToolCallResult,
  asErrorResult,
  asTextContentResult,
} from './types';
import { directoryOutputSchemas } from './directory-output-schemas';

/**
 * Request types for the SDK methods these tools call.
 *
 * Taken from the client, not from `@roarkanalytics/sdk/resources/...`. The
 * published package lays those files out where `moduleResolution: node` can
 * see them. The package the codegen gate links does not: declarations live
 * under `dist/*.d.mts` and the subpaths are only in the exports map, which
 * this tsconfig does not follow. The package root resolves in both layouts,
 * because `types` points at `index.d.ts` or `dist/index.d.ts`.
 *
 * `SimulationRunParams` is a union. The SDK also publishes its members as a
 * namespace on that name. A parameter type does not carry the namespace, so
 * each member is named here by the field this file already branches on.
 */
type CallListParams = NonNullable<Parameters<Roark['call']['list']>[0]>;
type SimulationRunParams = NonNullable<Parameters<Roark['simulation']['run']>[0]>;
type RunSimulationFromPlanID = Extract<SimulationRunParams, { planId: string }>;
type RunSimulationFromTemplate = Extract<SimulationRunParams, { template: string }>;
type RunSimulationFromConfig = Extract<SimulationRunParams, { plan: object }>;
type SimulationPersonaCreateParams = NonNullable<Parameters<Roark['simulationPersona']['create']>[0]>;
type CustomerFlowCreateParams = NonNullable<Parameters<Roark['customerFlow']['create']>[0]>;
type AgentEndpointCreateParams = NonNullable<Parameters<Roark['agentEndpoint']['create']>[0]>;

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
const CALL_SORT_FIELDS = ['createdAt', 'startedAt', 'endedAt', 'duration', 'title', 'status'] as const;
const SORT_DIRECTIONS = ['asc', 'desc'] as const;
/** GET /v1/call rejects a non-UUID in `agentId` and in `properties[agent_id][eq]`. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The same rule `optionalAgentIds` enforces, as a JSON Schema pattern: 1 to 100 comma-separated UUIDs. */
const UUID_SOURCE = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const AGENT_IDS_PATTERN = `^${UUID_SOURCE}(,${UUID_SOURCE}){0,99}$`;
const MAX_AGENT_IDS = 100;
const MAX_PROPERTY_FILTERS = 20;
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

// Every tool talks only to the Roark API, so openWorldHint is false, except
// run_simulation, which places phone calls to the agent under test.
const readAnnotations = (title: string) => ({
  title,
  readOnlyHint: true as const,
  destructiveHint: false as const,
  idempotentHint: true as const,
  openWorldHint: false as const,
});

// Each write creates a new record, so repeating a call is not idempotent.
const writeAnnotations = (title: string, { openWorld = false }: { openWorld?: boolean } = {}) => ({
  title,
  readOnlyHint: false as const,
  destructiveHint: true as const,
  idempotentHint: false as const,
  openWorldHint: openWorld,
});

const projectProperty = {
  type: 'string' as const,
  description:
    'Roark project id. Required when this connection is not already pinned to one project. list_projects returns the ids this credential can use.',
};

/** `after` and `limit`, with the page size the endpoint uses when `limit` is omitted. */
const paging = (defaultLimit: number) => ({
  after: {
    type: 'string' as const,
    description:
      'Paging cursor: pass pagination.nextCursor from the previous response to get the next page. Omit for the first page.',
  },
  limit: {
    type: 'number' as const,
    description: `Page size: the most rows one response returns. When omitted, the API returns up to ${defaultLimit}.`,
  },
});

const pagingProperties = paging(20);

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

/**
 * `agentId` on GET /v1/call: one UUID, or several comma-separated with no spaces, at most 100.
 * A non-UUID list is a 400 from the API, so reject it before the request.
 */
const optionalAgentIds = (args: Record<string, unknown>): string | undefined => {
  const value = optionalString(args, 'agentId');
  if (value === undefined) return undefined;
  if (/\s/.test(value)) {
    throw new ToolInputError('agentId is one UUID, or several comma-separated UUIDs with no spaces.');
  }
  const ids = value.split(',');
  if (ids.length > MAX_AGENT_IDS) {
    throw new ToolInputError(`agentId accepts at most ${MAX_AGENT_IDS} UUIDs.`);
  }
  if (ids.some((id) => !UUID_PATTERN.test(id))) {
    throw new ToolInputError('agentId must be one UUID, or several comma-separated UUIDs.');
  }
  return value;
};

type CallPropertyFilter = { eq: string } | { exists: boolean };

/**
 * `properties[<name>][eq]` and `properties[<name>][exists]` on GET /v1/call.
 * One operator per property. `agent_id` eq is a single UUID; every other name,
 * including the `agent_name` / `agentName` built-in, is passed through as a string.
 */
const optionalCallProperties = (
  args: Record<string, unknown>,
): Record<string, CallPropertyFilter> | undefined => {
  if (args['properties'] === undefined) return undefined;
  const value = args['properties'];
  if (!isRecord(value)) {
    throw new ToolInputError('properties must be an object keyed by property name.');
  }
  const names = Object.keys(value);
  if (names.length === 0) return undefined;
  if (names.length > MAX_PROPERTY_FILTERS) {
    throw new ToolInputError(`properties accepts at most ${MAX_PROPERTY_FILTERS} entries.`);
  }
  const out: Record<string, CallPropertyFilter> = {};
  for (const name of names) {
    if (name.length === 0) {
      throw new ToolInputError('properties names must be non-empty.');
    }
    const entry = value[name];
    if (!isRecord(entry)) {
      throw new ToolInputError(`properties.${name} must be an object with eq or exists.`);
    }
    const operators = Object.keys(entry);
    const operator = operators[0];
    if (operators.length !== 1 || (operator !== 'eq' && operator !== 'exists')) {
      throw new ToolInputError(`properties.${name} must set exactly one of eq or exists.`);
    }
    if (operator === 'eq') {
      const eq = entry['eq'];
      if (typeof eq !== 'string') {
        throw new ToolInputError(`properties.${name}.eq must be a string.`);
      }
      if (name === 'agent_id' && !UUID_PATTERN.test(eq)) {
        throw new ToolInputError('properties.agent_id.eq must be one UUID.');
      }
      out[name] = { eq };
    } else {
      const exists = entry['exists'];
      if (typeof exists !== 'boolean') {
        throw new ToolInputError(`properties.${name}.exists must be a boolean.`);
      }
      out[name] = { exists };
    }
  }
  return out;
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

/**
 * Query for GET /v1/call.
 *
 * The published SDK type knows `sortBy`, `sortDirection`, and `properties.exists`.
 * `agentId` and `properties.<name>.eq` are on the same endpoint (app-roark-analytics#3795)
 * and are not in that type yet. `call.list` forwards the query object and the SDK
 * stringifies every key, so the value still leaves as `agentId` and
 * `properties[<name>][eq]`. The cast only satisfies the current type. Drop it when
 * `CallListParams` declares those fields.
 */
const callListQuery = (args: Record<string, unknown>): CallListParams =>
  omitUndefined({
    searchText: optionalString(args, 'searchText'),
    status: optionalEnum(args, 'status', CALL_STATUSES),
    simulationRunPlanJobId: optionalString(args, 'simulationRunPlanJobId'),
    agentId: optionalAgentIds(args),
    properties: optionalCallProperties(args),
    sortBy: optionalEnum(args, 'sortBy', CALL_SORT_FIELDS),
    sortDirection: optionalEnum(args, 'sortDirection', SORT_DIRECTIONS),
    after: optionalString(args, 'after'),
    limit: optionalLimit(args),
  }) as CallListParams;

// Every tool declares an outputSchema, so the response body is also returned as
// structuredContent. The JSON text stays for clients that read only content.
const callApi = async (fn: () => Promise<unknown>): Promise<ToolCallResult> => {
  try {
    const result = await fn();
    // A tool with an outputSchema must return structuredContent, which is an object. The API
    // always answers with { data, ... }; anything else is reported rather than sent unstructured.
    if (!isRecord(result)) {
      return asErrorResult(`Unexpected response from the Roark API: ${JSON.stringify(result) ?? 'empty'}`);
    }
    return { ...asTextContentResult(result), structuredContent: result };
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
  outputSchema: NonNullable<Tool['outputSchema']>,
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
    outputSchema,
    annotations,
  },
  handler: handler(fn),
});

const endpointSchema = {
  type: 'object' as const,
  description: 'An agent endpoint the run tests.',
  properties: {
    id: {
      type: 'string' as const,
      description: 'Agent endpoint id, from list_agent_endpoints or create_agent_endpoint.',
    },
  },
  required: ['id'],
};

const metricRefSchema = {
  type: 'object' as const,
  description: 'A metric to score, by id or by slug.',
  properties: {
    id: { type: 'string' as const, description: 'Metric definition id, from list_metric_definitions.' },
    slug: {
      type: 'string' as const,
      description: 'Metric slug, from list_metric_definitions. Use instead of id.',
    },
  },
};

// A {{variable}} name to value map. The API takes string values only.
const stringMapSchema = (description: string) => ({
  type: 'object' as const,
  description,
  additionalProperties: { type: 'string' as const },
});

const flowAttachmentSchema = {
  type: 'object' as const,
  description: 'A customer flow to include. Name it by id or slug, and set happyPath, edgeCases, or both.',
  properties: {
    id: {
      type: 'string' as const,
      description: 'Customer flow id, from list_customer_flows or create_customer_flow.',
    },
    slug: {
      type: 'string' as const,
      description:
        'Stable slug of a flow Roark provides, used instead of id. GET /v1/simulation/template lists them. Flows made in the project have no slug.',
    },
    happyPath: {
      type: 'boolean' as const,
      description:
        "true runs the flow's happy path, the conversation going as intended. It is resolved when the run starts, so it follows the flow as it is then.",
    },
    edgeCases: {
      type: ['string', 'array'] as const,
      description:
        'The string ALL runs every edge case the flow has when the run starts. An array runs only the listed edge cases, each named by id or slug.',
      items: {
        type: 'object' as const,
        properties: {
          id: {
            type: 'string' as const,
            description: "Edge case id, from the flow's edgeCases in list_customer_flows.",
          },
          slug: {
            type: 'string' as const,
            description:
              'Stable slug of an edge case Roark provides, matched within this flow. Used instead of id.',
          },
          personaOverrideId: {
            type: 'string' as const,
            description:
              'Persona id, from list_personas, to run this edge case as instead of its own persona.',
          },
          variables: stringMapSchema(
            'Values for the {{variables}} in this edge case only, as variable name to string value.',
          ),
        },
      },
    },
    personaOverrideId: {
      type: 'string' as const,
      description:
        'Persona id, from list_personas, to run everything in this flow as instead of its own persona.',
    },
  },
};

const callIdDescription = 'Roark call id, from list_calls.';

const directionDescription =
  'INBOUND: the simulated caller phones the agent. OUTBOUND: the agent places the call to the simulated caller.';

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
    const body: RunSimulationFromPlanID = { planId };
    if (args['variables'] !== undefined) {
      body.variables = args['variables'] as NonNullable<RunSimulationFromPlanID['variables']>;
    }
    return body;
  }

  if (hasTemplate) {
    const template = requireString(args, 'template');
    if (!Array.isArray(args['agentEndpoints']) || args['agentEndpoints'].length === 0) {
      throw new ToolInputError('A template run requires agentEndpoints, a non-empty array of { id }.');
    }
    const direction = requireEnum(args, 'direction', DIRECTIONS);
    const body: RunSimulationFromTemplate = {
      template,
      direction,
      agentEndpoints: args['agentEndpoints'] as RunSimulationFromTemplate['agentEndpoints'],
    };
    if (args['flows'] !== undefined) {
      if (!Array.isArray(args['flows'])) throw new ToolInputError('flows must be an array.');
      body.flows = args['flows'] as NonNullable<RunSimulationFromTemplate['flows']>;
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
  const body: RunSimulationFromConfig = {
    plan: plan as unknown as RunSimulationFromConfig['plan'],
  };
  if (typeof args['saveAsPlan'] === 'boolean') body.saveAsPlan = args['saveAsPlan'];
  if (args['variables'] !== undefined) {
    body.variables = args['variables'] as NonNullable<RunSimulationFromConfig['variables']>;
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
      directoryOutputSchemas.listProjects,
      readAnnotations('List projects'),
      readMeta('project', '/v1/projects'),
      async (reqContext) => reqContext.client.project.list(),
    ),
    defineTool(
      'list_agents',
      'List agents',
      'Lists voice and chat agents in a Roark project, every agent unless searchText narrows it. Returns each agent id, name, custom id, and description, one page at a time.',
      objectSchema({
        project: projectProperty,
        searchText: {
          type: 'string',
          description:
            'Text to match against agent names and descriptions. When omitted, every agent is listed.',
        },
        ...pagingProperties,
      }),
      directoryOutputSchemas.listAgents,
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
      'Lists the endpoints Roark uses to reach agents in a project: phone numbers and other transports. Returns each endpoint id, agent id, direction, type, and address. A simulation runs against an endpoint id.',
      objectSchema({
        project: projectProperty,
        agentId: {
          type: 'string',
          description:
            "Agent id, from list_agents, to list only that agent's endpoints. When omitted, endpoints for every agent are listed.",
        },
        searchText: {
          type: 'string',
          description:
            'Text to match against the endpoint address, such as a phone number, or its environment name.',
        },
        ...pagingProperties,
      }),
      directoryOutputSchemas.listAgentEndpoints,
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
      'Lists calls in a Roark project, simulated and live. Returns call ids, status, direction, and timestamps, without transcripts. Every filter and the sort apply together.',
      objectSchema({
        project: projectProperty,
        searchText: {
          type: 'string',
          description: 'Text to match against call titles, summaries, and transcripts.',
        },
        status: {
          type: 'string',
          enum: [...CALL_STATUSES],
          description:
            'Where the calls are in their lifecycle: RINGING has not connected yet, IN_PROGRESS is live, ENDED has finished. When omitted, calls in every state are listed.',
        },
        agentId: {
          type: 'string',
          pattern: AGENT_IDS_PATTERN,
          description:
            'Agents whose calls to list, by id from list_agents. A call matches when any of them took part. Separate several ids with commas.',
        },
        properties: {
          type: 'object',
          description:
            "Call property filters, keyed by property name, at most 20. Each entry sets eq or exists, not both. eq matches a value, ignoring case, and exists checks whether the property is set. The built-in agent_name, also accepted as agentName, matches any participating agent's current name, and agent_id matches one agent id. Any other name is a custom property set on the call.",
          additionalProperties: {
            type: 'object',
            description: 'One filter: eq or exists.',
            properties: {
              eq: { type: 'string', description: 'Value the property must equal, ignoring case.' },
              exists: {
                type: 'boolean',
                description: 'true lists calls that have the property set. false lists calls that do not.',
              },
            },
          },
        },
        sortBy: {
          type: 'string',
          enum: [...CALL_SORT_FIELDS],
          default: 'createdAt',
          description:
            'What orders the results: when the call was created, started, or ended, how long it lasted, its title, or its status.',
        },
        sortDirection: {
          type: 'string',
          enum: [...SORT_DIRECTIONS],
          default: 'desc',
          description: 'asc puts the earliest or smallest first, desc the latest or largest.',
        },
        simulationRunPlanJobId: {
          type: 'string',
          description:
            'Simulation run id, the simulationRunPlanJobId that run_simulation returns, to list only the calls that run placed.',
        },
        ...pagingProperties,
      }),
      directoryOutputSchemas.listCalls,
      readAnnotations('List calls'),
      readMeta('call', '/v1/call'),
      async (reqContext, args) => scopedClient(reqContext, args).call.list(callListQuery(args)),
    ),
    defineTool(
      'get_call',
      'Get call',
      'Returns one call in a Roark project by its id, including status, direction, timestamps, and summary. Does not include the transcript.',
      objectSchema(
        {
          project: projectProperty,
          callId: { type: 'string', description: callIdDescription },
        },
        ['callId'],
      ),
      directoryOutputSchemas.getCall,
      readAnnotations('Get call'),
      readMeta('call', '/v1/call/{callId}'),
      async (reqContext, args) => scopedClient(reqContext, args).call.getByID(requireString(args, 'callId')),
    ),
    defineTool(
      'get_call_transcript',
      'Get call transcript',
      'Returns the transcript of one call in a Roark project: who took part, and the text of each turn with its timing.',
      objectSchema(
        {
          project: projectProperty,
          callId: { type: 'string', description: callIdDescription },
          source: {
            type: 'string',
            enum: [...TRANSCRIPT_SOURCES],
            description:
              'Which transcription to return: Roark post-call transcription, or the one the simulated caller or your agent captured live. When omitted, the first available of CUSTOMER_AGENT_REALTIME, SIMULATION_AGENT_REALTIME, then ROARK_POST_CALL.',
          },
        },
        ['callId'],
      ),
      directoryOutputSchemas.getCallTranscript,
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
      'Returns the metric scores recorded for one call in a Roark project, grouped by metric unless flatten is true.',
      objectSchema(
        {
          project: projectProperty,
          callId: { type: 'string', description: callIdDescription },
          flatten: {
            type: 'string',
            description:
              'true returns one row per score. Any other value, or omitting it, groups scores by metric.',
          },
          status: {
            type: 'string',
            enum: ['success', 'all'],
            description:
              'success returns computed scores only. all also returns metrics with no value (not applicable, missing data, or an error), so a caller can tell a finished metric from one still computing. When omitted, success.',
          },
        },
        ['callId'],
      ),
      directoryOutputSchemas.listCallMetrics,
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
      objectSchema({ project: projectProperty, ...paging(500) }),
      directoryOutputSchemas.listMetricDefinitions,
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
      directoryOutputSchemas.getSimulationResults,
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
      'Lists simulated caller personas in a Roark project, every persona unless searchText narrows it. Returns each persona id, name, language, accent, and gender, one page at a time.',
      objectSchema({
        project: projectProperty,
        searchText: {
          type: 'string',
          description:
            'Text to match against persona names and descriptions. When omitted, every persona is listed.',
        },
        ...pagingProperties,
      }),
      directoryOutputSchemas.listPersonas,
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
      'Lists customer flows in a Roark project. A customer flow is the conversation scenario a simulated caller follows. Returns each flow id, title, type, happy path, and edge cases. The step graph of a scripted flow is not included.',
      objectSchema({
        project: projectProperty,
        searchText: {
          type: 'string',
          description: 'Text to match against flow titles. When omitted, flows are not filtered by title.',
        },
        type: {
          type: 'string',
          enum: [...FLOW_TYPES],
          description:
            'How the simulated caller behaves. IMPROV gives the caller a goal to improvise around, SCRIPTED follows an exact step graph, and VOICEMAIL plays a voicemail greeting to test the message the agent leaves. When omitted, flows of every type are listed.',
        },
        includeSystem: {
          type: 'string',
          enum: ['true', 'false'],
          description:
            'true also lists flows Roark provides. false, or omitting it, lists only flows made in the project.',
        },
        ...pagingProperties,
      }),
      directoryOutputSchemas.listCustomerFlows,
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
      directoryOutputSchemas.listSimulationEnvironments,
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
      'Creates an agent in a Roark project. Each call adds a new agent. Requires a name. Returns the created agent, including its id. Does not create an endpoint; create_agent_endpoint does.',
      objectSchema(
        {
          project: projectProperty,
          name: {
            type: 'string',
            description: 'Display name for the agent, shown in Roark and returned by list_agents.',
          },
          description: { type: 'string', description: 'What the agent does.' },
          customId: {
            type: 'string',
            description:
              'Your own identifier for the agent, such as its id in your platform. Unique in the project.',
          },
        },
        ['name'],
      ),
      directoryOutputSchemas.createAgent,
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
      'Creates a phone endpoint for an agent in a Roark project. Each call adds a new endpoint; it places no calls itself. Simulations then call the agent on this number, or receive its calls. Phone is the only endpoint type this tool creates.',
      objectSchema(
        {
          project: projectProperty,
          agentId: { type: 'string', description: 'Agent id from list_agents or create_agent.' },
          value: {
            type: 'string',
            description: "The agent's phone number in E.164 form, such as +14155550123.",
          },
          direction: {
            type: 'string',
            enum: [...ENDPOINT_DIRECTIONS],
            description:
              'Which way calls travel on this number: INCOMING when callers reach the agent here, OUTGOING when the agent calls out from it, or both.',
          },
          environment: {
            type: 'string',
            description:
              'Environment label for the endpoint, such as production or staging. When omitted, production.',
          },
          outboundDialType: {
            type: 'string',
            enum: ['NONE', 'HTTP_REQUEST'],
            description:
              'How Roark starts an outbound simulation: HTTP_REQUEST sends an HTTP request to your platform to make the agent dial, NONE sends nothing. When omitted, NONE.',
          },
          outboundDialHttpRequestDefinitionId: {
            type: 'string',
            description:
              'Id of the HTTP request definition Roark sends to make the agent dial, from GET /v1/http-request-definition. Required when outboundDialType is HTTP_REQUEST.',
          },
        },
        ['agentId', 'value', 'direction'],
      ),
      directoryOutputSchemas.createAgentEndpoint,
      writeAnnotations('Create agent endpoint'),
      writeMeta('agentEndpoint', '/v1/agent/endpoint'),
      async (reqContext, args) =>
        scopedClient(reqContext, args).agentEndpoint.create(buildEndpointBody(args)),
    ),
    defineTool(
      'create_persona',
      'Create persona',
      'Creates a simulated caller persona in a Roark project. Each call adds a new persona, so repeating it creates a duplicate. It changes nothing else and places no calls. Returns the created persona; pass its id as personaOverrideId to create_customer_flow to use it.',
      objectSchema(
        {
          project: projectProperty,
          name: { type: 'string', description: 'Name the caller uses in conversation.' },
          language: {
            type: 'string',
            enum: [...LANGUAGES],
            description:
              'The language the simulated caller speaks, as an ISO 639-1 code: EN is English, ES Spanish.',
          },
          accent: { type: 'string', enum: [...ACCENTS], description: 'Accent the caller speaks with.' },
          gender: { type: 'string', enum: [...GENDERS], description: 'Gender the persona is voiced with.' },
          age: {
            type: 'string',
            enum: [...AGES],
            default: 'ADULT',
            description: 'How old the caller sounds.',
          },
          baseEmotion: {
            type: 'string',
            enum: [...EMOTIONS],
            default: 'NEUTRAL',
            description: 'The emotional state the simulated caller brings to the call.',
          },
          backstoryPrompt: {
            type: 'string',
            description: 'Background and behavior the simulated caller plays.',
          },
          description: {
            type: 'string',
            description: 'Short summary of the persona, to tell it apart from others in the project.',
          },
        },
        ['name', 'language', 'accent', 'gender'],
      ),
      directoryOutputSchemas.createPersona,
      writeAnnotations('Create persona'),
      writeMeta('simulationPersona', '/v1/persona'),
      async (reqContext, args) =>
        scopedClient(reqContext, args).simulationPersona.create(buildPersonaBody(args)),
    ),
    defineTool(
      'create_customer_flow',
      'Create customer flow',
      'Creates an improv customer flow in a Roark project. A customer flow is the conversation scenario a simulated caller follows. Each call adds a new flow. Requires a title, at least one agent id, and a happy path with a title, a persona id, and an environment id. Returns the created flow, including its id. Scripted step graphs are not created by this tool.',
      objectSchema(
        {
          project: projectProperty,
          title: {
            type: 'string',
            description: 'Name for the flow, shown in Roark and returned by list_customer_flows.',
          },
          description: { type: 'string', description: 'What the conversation covers.' },
          agentIds: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description: 'Ids of the agents this flow tests, from list_agents or create_agent.',
          },
          happyPath: {
            type: 'object',
            description: 'The way the conversation is meant to go.',
            properties: {
              title: {
                type: 'string',
                description: 'Name for the happy path, the run where the conversation goes as intended.',
              },
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
                title: { type: 'string', description: 'Name for this edge case.' },
                prompt: {
                  type: 'string',
                  description: 'What the simulated caller is trying to do in this edge case.',
                },
                personaOverrideId: {
                  type: 'string',
                  description:
                    'Persona id from list_personas or create_persona. When omitted, the happy path persona.',
                },
                environmentId: {
                  type: 'string',
                  description:
                    'Environment id from list_simulation_environments. When omitted, the happy path environment.',
                },
              },
              required: ['title'],
            },
          },
        },
        ['title', 'agentIds', 'happyPath'],
      ),
      directoryOutputSchemas.createCustomerFlow,
      writeAnnotations('Create customer flow'),
      writeMeta('customerFlow', '/v1/customer-flow'),
      async (reqContext, args) => scopedClient(reqContext, args).customerFlow.create(buildFlowBody(args)),
    ),
    defineTool(
      'run_simulation',
      'Run simulation',
      'Starts a simulation run in a Roark project and places simulated calls to the agent. Pass exactly one of planId (an existing plan), plan (an inline plan), or template (a built-in template name, with agentEndpoints and direction). Returns the run id and how many calls the run places. This spends simulation usage on the account.',
      objectSchema({
        project: projectProperty,
        planId: {
          type: 'string',
          description:
            'A saved run plan to run again, with its own endpoints, flows, and metrics: the simulationRunPlanId of a run started with saveAsPlan true.',
        },
        plan: {
          type: 'object',
          description:
            'Inline plan to run once. Requires agentEndpoints, direction, and maxSimulationDurationSeconds.',
          properties: {
            name: {
              type: 'string',
              description:
                'Name for the plan. When omitted, one is generated from the date. Needed for saveAsPlan.',
            },
            description: { type: 'string', description: 'Note on what the plan tests.' },
            direction: { type: 'string', enum: [...DIRECTIONS], description: directionDescription },
            agentEndpoints: {
              type: 'array',
              items: endpointSchema,
              description: 'The agent endpoints the run tests.',
            },
            metrics: {
              type: 'array',
              items: metricRefSchema,
              description: 'Metrics to score, by id or slug.',
            },
            flows: {
              type: 'array',
              items: flowAttachmentSchema,
              description: 'Customer flows to run, and which of their happy paths and edge cases.',
            },
            maxSimulationDurationSeconds: {
              type: 'number',
              description: 'Longest one simulated call may last, in seconds.',
            },
            iterationCount: {
              type: 'number',
              description: 'Times each test case runs. When omitted, 1.',
            },
            maxConcurrentJobs: {
              type: 'number',
              description: 'How many calls run at once. When omitted, 5.',
            },
            executionMode: {
              type: 'string',
              enum: ['PARALLEL', 'SEQUENTIAL_SAME_RUN_PLAN', 'SEQUENTIAL_PROJECT'],
              description:
                'When the run starts relative to other runs. PARALLEL starts it at once. SEQUENTIAL_SAME_RUN_PLAN queues it while another run of the same plan is active. SEQUENTIAL_PROJECT queues it while any run in the project is active. When omitted, PARALLEL.',
            },
          },
          required: ['agentEndpoints', 'direction', 'maxSimulationDurationSeconds'],
        },
        template: {
          type: 'string',
          description:
            'Name of a built-in Roark template, such as health-check. GET /v1/simulation/template lists them.',
        },
        agentEndpoints: {
          type: 'array',
          items: endpointSchema,
          description: 'For a template run: the agent endpoints it tests. A template run fails without it.',
        },
        direction: {
          type: 'string',
          enum: [...DIRECTIONS],
          description: `For a template run, where it is required. ${directionDescription}`,
        },
        flows: {
          type: 'array',
          items: flowAttachmentSchema,
          description:
            'For a template run: the flows to run. Needed when the template has no flows of its own; otherwise they replace its flows.',
        },
        iterationCount: {
          type: 'number',
          description:
            "For a template run: times each test case runs. When omitted, 1, or the template's own count for a template that sweeps a property.",
        },
        maxSimulationDurationSeconds: {
          type: 'number',
          description:
            "For a template run: longest one simulated call may last, in seconds. When omitted, the template's default.",
        },
        saveAsPlan: {
          type: 'boolean',
          description:
            'When plan is set, true keeps the plan so it can be run again by planId. Requires plan.name.',
        },
        variables: {
          type: ['object', 'array'],
          description:
            'Values for the {{variables}} the run resolves. An object of name to string value applies to the whole run. An array applies values per flow (flowId, optionally narrowed by edgeCaseId or happyPath).',
          additionalProperties: { type: 'string' },
          items: {
            type: 'object',
            properties: {
              flowId: { type: 'string', description: 'Customer flow id the values apply to.' },
              edgeCaseId: { type: 'string', description: 'Narrow to one edge case of that flow.' },
              happyPath: { type: 'boolean', description: "Narrow to the flow's happy path." },
              scenarioId: {
                type: 'string',
                description:
                  'Deprecated. Scenario id the values apply to, for a saved plan built from scenarios rather than flows. Use flowId otherwise. Template runs refuse it.',
              },
              variables: stringMapSchema('The values to apply, as variable name to string value.'),
            },
            required: ['variables'],
          },
        },
      }),
      directoryOutputSchemas.runSimulation,
      writeAnnotations('Run simulation', { openWorld: true }),
      writeMeta('simulation', '/v1/simulation/run'),
      async (reqContext, args) => scopedClient(reqContext, args).simulation.run(buildRunBody(args)),
    ),
  ];
}
