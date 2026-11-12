// Output schemas for the directory tools. Not generated.
//
// Each tool returns the customer-api response body as structuredContent, so each
// schema describes that body: `data`, plus `pagination` on list endpoints. The
// field types follow the published SDK response types.
//
// The schemas name the fields a caller acts on, not every field. They declare no
// enums and do not close objects with additionalProperties: false. Clients such
// as the MCP TypeScript SDK validate structuredContent against outputSchema and
// fail the call on a mismatch, so a new enum value or field added to the API must
// not turn a working tool call into an error.

import { Tool } from '@modelcontextprotocol/sdk/types.js';

type OutputSchema = NonNullable<Tool['outputSchema']>;
type Field = Record<string, unknown>;

const string = (description: string): Field => ({ type: 'string', description });
const nullableString = (description: string): Field => ({ type: ['string', 'null'], description });
const number = (description: string): Field => ({ type: 'number', description });
const boolean = (description: string): Field => ({ type: 'boolean', description });
const object = (description: string, properties: Record<string, Field> = {}): Field => ({
  type: 'object',
  description,
  properties,
});
const nullableObject = (description: string, properties: Record<string, Field> = {}): Field => ({
  type: ['object', 'null'],
  description,
  properties,
});
const nullableNumber = (description: string): Field => ({ type: ['number', 'null'], description });
const nullableBoolean = (description: string): Field => ({ type: ['boolean', 'null'], description });
const array = (description: string, items: Field): Field => ({ type: 'array', description, items });

const timestamps = {
  createdAt: string('When it was created, ISO 8601.'),
  updatedAt: string('When it last changed, ISO 8601.'),
};

const paginationWithTotal = object('Paging state for this list.', {
  hasMore: boolean('Whether more rows follow this page.'),
  nextCursor: nullableString('Pass as after to get the next page. null on the last page.'),
  total: number('Rows matching the request across all pages.'),
});

const paginationWithLimit = object('Paging state for this list.', {
  hasMore: boolean('Whether more rows follow this page.'),
  nextCursor: nullableString('Pass as after to get the next page. null on the last page.'),
  limit: number('The page size used for this response.'),
});

const single = (item: Field): OutputSchema => ({
  type: 'object',
  properties: { data: item },
  required: ['data'],
});

const list = (description: string, item: Field, pagination: Field): OutputSchema => ({
  type: 'object',
  properties: { data: array(description, item), pagination },
  required: ['data'],
});

const agent = object('An agent.', {
  id: string('Agent id.'),
  name: string('Agent name.'),
  description: nullableString('What the agent does.'),
  customId: nullableString('Caller-chosen id, unique in the project.'),
  ...timestamps,
});

const agentEndpoint = object('An agent endpoint.', {
  id: string('Agent endpoint id. run_simulation takes it in agentEndpoints.'),
  agentId: string('The agent this endpoint reaches.'),
  type: string('Transport, such as PHONE.'),
  direction: string('INCOMING, OUTGOING, or INCOMING_AND_OUTGOING.'),
  value: nullableString(
    'The address Roark connects to, such as an E.164 phone number. null for an outbound phone endpoint with no fixed calling number.',
  ),
  environment: string('Environment name, such as production.'),
  outboundDialType: string('How Roark starts an outbound call: NONE or HTTP_REQUEST.'),
  outboundDialHttpRequestDefinitionId: nullableString(
    'The HTTP request definition used when outboundDialType is HTTP_REQUEST.',
  ),
  ...timestamps,
});

const call = object('A call.', {
  id: string('Call id. get_call, get_call_transcript, and list_call_metrics take it as callId.'),
  projectId: string('Project the call belongs to.'),
  title: nullableString('Call title.'),
  status: nullableString('RINGING, IN_PROGRESS, or ENDED.'),
  callDirection: string('INBOUND or OUTBOUND.'),
  startedAt: string('When the call started, ISO 8601.'),
  endedAt: nullableString('When the call ended, ISO 8601. null while it is in progress.'),
  durationMs: { type: ['number', 'null'], description: 'Call length in milliseconds.' },
  summary: nullableString('Generated summary of the call.'),
  simulationJobId: nullableString('The simulated call that produced it. null for a live call.'),
});

const persona = object('A simulated caller persona.', {
  id: string('Persona id. create_customer_flow takes it as personaOverrideId.'),
  name: string('Name the caller uses in conversation.'),
  language: string('Primary spoken language.'),
  accent: string('Accent the persona is voiced with.'),
  gender: string('Gender the persona is voiced with.'),
  age: string('How old the caller sounds.'),
  baseEmotion: string('Emotional baseline.'),
  backstoryPrompt: nullableString('Background and behavior the simulated caller plays.'),
  description: nullableString('Short label for the persona.'),
  ...timestamps,
});

const customerFlow = object('A customer flow.', {
  id: string('Customer flow id. run_simulation takes it in flows.'),
  title: string('Flow title.'),
  type: string('SCRIPTED, IMPROV, or VOICEMAIL.'),
  source: string('CUSTOM for flows made in the project, SYSTEM for flows Roark provides.'),
  description: nullableString('What the conversation covers.'),
  agents: array('Agents the flow exercises.', object('An agent the flow exercises.')),
  happyPath: nullableObject('The way the conversation is meant to go.'),
  edgeCases: array('Other ways of running the flow.', object('An edge case.')),
  ...timestamps,
});

const environment = object('A call environment.', {
  id: string('Environment id. create_customer_flow takes it as environmentId.'),
  name: string('Environment name.'),
  description: nullableString('What the environment simulates.'),
  backgroundNoise: string('Background noise played into the call, or NONE.'),
  backgroundNoiseVolume: number('Background noise volume.'),
  ...timestamps,
});

const metricDefinition = object('A metric the project can score.', {
  id: string('Metric definition id.'),
  metricId: string('Same value as slug, kept for backwards compatibility.'),
  slug: string('Metric slug. run_simulation takes it in plan.metrics.'),
  name: string('Metric name.'),
  description: string('What the metric measures.'),
  type: string('Value type, such as BOOLEAN, NUMERIC, or SCALE.'),
  calculationType: string('How the value is computed, such as LLM_JUDGE or FORMULA.'),
  scope: string('GLOBAL for the whole call, PER_PARTICIPANT for each participant.'),
});

const callMetric = object(
  'A metric scored on the call. Grouped rows carry a values array. With flatten true, each row is one score and carries value, captureStatus, and the other value fields directly.',
  {
    metricDefinitionId: string('Metric definition id.'),
    metricId: string('Same value as slug, kept for backwards compatibility.'),
    slug: string('Metric slug.'),
    name: string('Metric name.'),
    description: string('What the metric measures.'),
    type: string('Value type, such as BOOLEAN, NUMERIC, or SCALE.'),
    scope: string('GLOBAL for the whole call, PER_PARTICIPANT for each participant.'),
  },
);

export const directoryOutputSchemas = {
  listProjects: single(
    object('Projects this credential can use.', {
      projects: array(
        'One entry per project.',
        object('A project.', {
          id: string('Project id. Other tools take it as project.'),
          name: string('Project name.'),
          slug: string('Project slug.'),
          grantedPermissions: array(
            'Permissions this credential holds in the project.',
            string('A permission.'),
          ),
          organization: object('The organization that owns the project.', {
            id: string('Organization id.'),
            name: string('Organization name.'),
          }),
        }),
      ),
    }),
  ),
  listAgents: list('Agents on this page.', agent, paginationWithTotal),
  listAgentEndpoints: list('Agent endpoints on this page.', agentEndpoint, paginationWithTotal),
  listCalls: list('Calls on this page.', call, paginationWithTotal),
  getCall: single(call),
  getCallTranscript: single(
    object('The transcript.', {
      transcriptionSource: nullableString('Which transcription this is.'),
      participants: array(
        'Who spoke on the call.',
        object('A participant.', {
          id: string('Participant id. Transcript entries refer to it as participantId.'),
          type: string('AGENT, CUSTOMER, SIMULATED_CUSTOMER, or BACKGROUND_SPEAKER.'),
        }),
      ),
      entries: array(
        'Turns in the order they were spoken.',
        object('One turn.', {
          participantId: nullableString('The participant who spoke.'),
          role: nullableString('AGENT or CUSTOMER.'),
          text: string('What was said.'),
          startOffsetMs: number('Start of the turn, in milliseconds from the start of the call.'),
          endOffsetMs: number('End of the turn, in milliseconds from the start of the call.'),
        }),
      ),
    }),
  ),
  listCallMetrics: single(array('Metric scores for the call.', callMetric)),
  listMetricDefinitions: list('Metric definitions on this page.', metricDefinition, paginationWithLimit),
  getSimulationResults: single(
    object('Results of the simulation run.', {
      run: object('The run itself.', {
        simulationRunPlanJobId: string('Run id.'),
        simulationRunPlanId: string('The plan the run executes.'),
        simulationRunPlanName: nullableString('The plan name. null when the plan has since been deleted.'),
        runNumber: nullableNumber('Per-project run number, shown as SR-42 in the app.'),
        status: string('Run status, such as RUNNING_SIMULATIONS, COMPLETED, or FAILED.'),
        triggeredBy: string('What started the run, such as TRIGGERED_FROM_API or SCHEDULED.'),
        createdAt: string('When the run was created, ISO 8601.'),
        startedAt: nullableString('When the run started, ISO 8601.'),
        endedAt: nullableString('When the run ended, ISO 8601. null until it ends.'),
        durationMs: nullableNumber('Wall-clock run time in milliseconds. null until the run ends.'),
      }),
      summary: object('Totals over the simulated calls finished so far.', {
        score: nullableNumber(
          "The run score, 0-100: the mean of each check's pass rate. null when nothing was evaluated.",
        ),
        callPassRate: nullableNumber('passedCalls / evaluatedCalls, 0-100. null when nothing was evaluated.'),
        checkPassRate: nullableNumber(
          'Every check verdict on every call pooled, 0-100. null when nothing was evaluated.',
        ),
        totalCalls: number('Every simulated call of the run, retries included.'),
        countedCalls: number('Calls whose results count: all but invalidated ones.'),
        completedCalls: number('Counted calls that connected and produced a conversation.'),
        evaluatedCalls: number('Counted calls at least one check graded.'),
        passedCalls: number('Evaluated calls that passed every check.'),
        failedCalls: number('Evaluated calls that failed at least one check.'),
      }),
      verdict: nullableObject(
        'Pass or fail for the run, judged against the success criteria pinned on the plan. null until the run ends.',
        {
          passed: boolean(
            'Whether every check cleared its own minimum pass rate. Not derived from score: a high score can still fail.',
          ),
          score: nullableNumber('The same score as summary.score, for reporting only.'),
          checks: array(
            'Every check the run was judged on, with its pass rate and the minimum it needed.',
            object('One check.'),
          ),
          failures: array('Every criterion the run missed. Empty when it passed.', object('One failure.')),
        },
      ),
      metrics: array(
        'Aggregate for each metric, checks first.',
        object('One metric aggregate.', {
          metricDefinitionId: string('Metric definition id.'),
          metricId: string('Metric slug.'),
          name: string('Metric name.'),
          outputType: string('Value type, such as BOOLEAN, NUMERIC, or SCALE.'),
          isCheck: boolean('Whether this metric is one of the checks the run is judged on.'),
          check: nullableObject("The check's tally. null for a metric that is not a check."),
          evaluatedCalls: number('Counted calls with at least one value.'),
          sampleSize: number('Values across those calls. A per-turn metric has several per call.'),
          numeric: nullableObject('Summary statistics for numeric metrics. null when nothing was captured.'),
          distribution: {
            type: ['array', 'null'],
            description: 'How many values took each reading, for BOOLEAN, SCALE, and CLASSIFICATION metrics.',
            items: object('One reading and its count.'),
          },
          unitSymbol: nullableString('Unit of numeric, such as ms.'),
        }),
      ),
      calls: array(
        'The simulated calls and their checks.',
        object('One simulated call.', {
          simulationJobId: string('Simulated call id.'),
          callId: nullableString('Call id. get_call and get_call_transcript take it as callId.'),
          status: string('Call status, such as COMPLETED, ERROR, or INVALIDATED.'),
          counted: boolean('false for an invalidated call: listed, never scored.'),
          passed: nullableBoolean('Whether it passed every check that graded it. null when no check did.'),
          personaName: nullableString('The persona that placed or took the call.'),
          agentName: nullableString('The agent under test.'),
          durationMs: nullableNumber('Call length in milliseconds.'),
          attemptNumber: number('1 for the first attempt; higher for a retry.'),
          checks: array('Each check on this call and its result.', object('One check result.')),
          values: array("Call-level values of the run's other metrics.", object('One metric value.')),
        }),
      ),
      comparison: nullableObject('Comparison with an earlier run of the plan. null when there is none.'),
      attemptSummary: object(
        'Simulations placed against test cases. Differs from the call count only when the plan retried calls the agent never spoke on.',
      ),
      breakdowns: object('Pass rates and scores grouped by agent and by persona.'),
      debrief: nullableObject(
        'Executive summary, failure themes, and recommendations. Generated when a run with graded calls settles.',
      ),
      sweepAttribution: nullableObject(
        'For a run that swept a property, such as accent or background noise: which check failures that property caused.',
      ),
    }),
  ),
  listPersonas: list('Personas on this page.', persona, paginationWithTotal),
  listCustomerFlows: list('Customer flows on this page.', customerFlow, paginationWithTotal),
  listSimulationEnvironments: list('Environments on this page.', environment, paginationWithTotal),
  createAgent: single(agent),
  createAgentEndpoint: single(agentEndpoint),
  createPersona: single(persona),
  createCustomerFlow: single(customerFlow),
  runSimulation: single(
    object('The started run.', {
      simulationRunPlanJobId: string('Run id. get_simulation_results takes it as jobId.'),
      simulationRunPlanId: string('The plan the run executes.'),
      status: string('Run status, such as PENDING or RUNNING_SIMULATIONS.'),
      simulationJobCount: number('How many simulated calls this run places.'),
      savedAsPlan: boolean('Whether the plan was kept so it can be run again by planId.'),
      createdAt: string('When the run was created, ISO 8601.'),
    }),
  ),
};
