import path from 'node:path';
import ts from 'typescript';
import { directoryOutputSchemas } from '../src/directory-output-schemas';

// Each output schema against the SDK response type it describes: every declared field must exist
// there, and every type the SDK allows (null included) must be one the schema allows. A client
// that validates structuredContent fails the call on a mismatch, so when an SDK bump changes a
// response (a field turning nullable, say), this fails here rather than in production.

type Schema = { type?: string | string[]; properties?: Record<string, Schema>; items?: Schema };

const sdkResources = path.dirname(require.resolve('@roarkanalytics/sdk/resources/agent.js'));

const responseTypes: Record<keyof typeof directoryOutputSchemas, [string, string]> = {
  listProjects: ['project', 'ProjectListResponse'],
  listAgents: ['agent', 'AgentListResponse'],
  listAgentEndpoints: ['agent-endpoint', 'AgentEndpointListResponse'],
  listCalls: ['call', 'CallListResponse'],
  getCall: ['call', 'CallGetByIDResponse'],
  getCallTranscript: ['call', 'CallGetTranscriptResponse'],
  listCallMetrics: ['call', 'CallListMetricsResponse'],
  listMetricDefinitions: ['metric', 'MetricListDefinitionsResponse'],
  getSimulationResults: ['simulation-run-plan-job', 'SimulationRunPlanJobGetResultsResponse'],
  listPersonas: ['simulation-persona', 'SimulationPersonaListResponse'],
  listCustomerFlows: ['customer-flow', 'CustomerFlowListResponse'],
  listSimulationEnvironments: ['simulation-environment', 'SimulationEnvironmentListResponse'],
  createAgent: ['agent', 'AgentCreateResponse'],
  createAgentEndpoint: ['agent-endpoint', 'AgentEndpointCreateResponse'],
  createPersona: ['simulation-persona', 'SimulationPersonaCreateResponse'],
  createCustomerFlow: ['customer-flow', 'CustomerFlowCreateResponse'],
  runSimulation: ['simulation', 'SimulationRunResponse'],
};

const fileFor = (resource: string) => path.join(sdkResources, `${resource}.d.ts`);

const mismatches = (): string[] => {
  const files = [...new Set(Object.values(responseTypes).map(([resource]) => fileFor(resource)))];
  const program = ts.createProgram(files, { strict: true, noEmit: true });
  const checker = program.getTypeChecker();
  const problems: string[] = [];

  // A field can resolve to several types (one per member of a union response), so the walk
  // carries a list rather than building a union, which the public checker API cannot do.
  const members = (types: ts.Type[]): ts.Type[] =>
    types.flatMap((type) => (type.isUnion() ? type.types : [type]));

  const kinds = (types: ts.Type[]): Set<string> => {
    const out = new Set<string>();
    for (const part of members(types)) {
      if (part.flags & ts.TypeFlags.Undefined) continue;
      if (part.flags & ts.TypeFlags.Null) out.add('null');
      else if (part.flags & ts.TypeFlags.StringLike) out.add('string');
      else if (part.flags & ts.TypeFlags.NumberLike) out.add('number');
      else if (part.flags & ts.TypeFlags.BooleanLike) out.add('boolean');
      else if (checker.isArrayType(part) || checker.isTupleType(part)) out.add('array');
      else out.add('object');
    }
    return out;
  };

  const property = (types: ts.Type[], name: string): ts.Type[] =>
    members(types)
      .filter((part) => !(part.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)))
      .map((part) => checker.getPropertyOfType(part, name))
      .filter((symbol): symbol is ts.Symbol => symbol !== undefined)
      .map((symbol) => checker.getTypeOfSymbol(symbol));

  const elements = (types: ts.Type[]): ts.Type[] =>
    members(types)
      .filter((part) => checker.isArrayType(part))
      .map((part) => checker.getTypeArguments(part as ts.TypeReference)[0])
      .filter((item): item is ts.Type => item !== undefined);

  const walk = (schema: Schema, types: ts.Type[], where: string): void => {
    const allowed = new Set(([] as string[]).concat(schema.type ?? []));
    if (allowed.size > 0) {
      for (const kind of kinds(types)) {
        if (!allowed.has(kind)) problems.push(`${where}: the SDK allows ${kind}, the schema does not`);
      }
    }
    for (const [name, child] of Object.entries(schema.properties ?? {})) {
      const childTypes = property(types, name);
      if (childTypes.length === 0) problems.push(`${where}.${name}: not in the SDK type`);
      else walk(child, childTypes, `${where}.${name}`);
    }
    if (schema.items && Object.keys(schema.items).length > 0) {
      const items = elements(types);
      if (items.length > 0) walk(schema.items, items, `${where}[]`);
    }
  };

  for (const [key, [resource, typeName]] of Object.entries(responseTypes)) {
    const source = program.getSourceFile(fileFor(resource));
    const symbol = source && checker.getSymbolAtLocation(source)?.exports?.get(typeName as ts.__String);
    if (!symbol) {
      problems.push(`${key}: ${typeName} is not exported by the SDK`);
      continue;
    }
    walk(
      directoryOutputSchemas[key as keyof typeof directoryOutputSchemas] as Schema,
      [checker.getDeclaredTypeOfSymbol(symbol)],
      key,
    );
  }
  return problems;
};

describe('directory output schemas', () => {
  it('agree with the SDK response types', () => {
    expect(mismatches()).toEqual([]);
  }, 30_000);
});
