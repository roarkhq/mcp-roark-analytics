# Create bodies by provider

Every body has `provider` and `name` (3 to 120 characters). Fields not listed for
a provider are rejected. `client.agentConnection.listProviders()` is the live
source of truth; this page explains the fields.

## Pulled on a schedule

### Retell, Vapi, ElevenLabs, Bland

| Field | Required | Notes |
| --- | --- | --- |
| `apiKey` | yes | Checked by listing agents first. |
| `agentScope` | no | `ALL` (default) or `SELECTED`. |
| `agentIds` | with `SELECTED` | Platform ids from `discoverAgents`. |
| `agentNames` | no | Agents to create by name when the platform does not list them. |
| `capabilities` | no | `PULL_AGENTS`, `PULL_CALLS`, `PUSH_AGENT_CONFIG` (not on Bland). |
| `autoSetUpAgents` | no | Default `false`. |
| `samplingRate` | no | 0 to 1, default 1. |
| `outboundRequestBodyTemplate` | Vapi only | Assistant overrides merged into outbound test calls, as an object. |

### Leaping

`apiKey` and `agentIds` (at least one; Leaping cannot list agents). Optional
`samplingRate`. Calls only.

## Sent by the platform

### LiveKit Cloud (`LIVEKIT`)

| Field | Required | Notes |
| --- | --- | --- |
| `url` | yes | `wss://<project>.livekit.cloud` |
| `apiKey`, `apiSecret` | yes | LiveKit API key pair. |
| `agentScope`, `agentNames` | no | `SELECTED` needs at least one name: the agent name the worker dispatches as. `ALL` creates one default agent. |
| `metadataFilteringEnabled` | no | Only import rooms marked for Roark. |
| `metadataEgressStrategy` | no | `DEFERRED` (default) or `EAGER`; needs filtering on. |
| `autoSetUpAgents`, `samplingRate` | no | |
| `endpoint` | no | Create a test endpoint per agent. `{ autoCreateRoom: true, autoCreateRoomMetadata? }` or `{ autoCreateRoom: false, roomCreationUrl }`. Exactly one of the two modes. |

The only platform a project may connect several times (separate accounts, or one
account split by agent names).

## Reported by your code (returns `observerApiKey`)

### LiveKit Agents SDK (`LIVEKIT_SELF_HOSTED`)

Only `name`. Optional `samplingRate`, `observerApiKeyName`. The worker reports
through the Roark LiveKit plugin using `observerApiKey`.

### Pipecat self-hosted (`PIPECAT_SELF_HOSTED_INTEGRATION`)

| Field | Notes |
| --- | --- |
| `baseSignalingUrl` | SmallWebRTC signaling URL, for Roark to place test calls. Omit for call import only. |
| `authToken` | Bearer token Roark sends to it. |
| `appendAgentId` | Append the agent name to the URL (default `true`), for one server with several bots. |

### Pipecat Cloud (`PIPECAT_CLOUD_INTEGRATION`)

| Field | Notes |
| --- | --- |
| `pccPublicKey` | Pipecat Cloud public key, for Roark to place test calls. Omit for call import only. |
| `pccStartBody` | Object sent when starting a session. |
| `pccRoomProperties` | Daily room properties, as an object. |

Both Pipecat providers also take `samplingRate` and `observerApiKeyName`. The bot
reports calls through the Roark Pipecat observer using `observerApiKey`.

## Testing only (no call import)

### Kore AI (`KORE`)

`apiKey`, `appId`, `envName`, optional `baseUrl`. Creates one agent with a Kore
endpoint, ready to simulate against.

### Google CES (`GOOGLE_CES`)

`wifConfig` (the Workload Identity Federation JSON file, as an object, exactly as
Google generates it), `location` (for example `us`), `appId`, `deploymentId`,
optional `versionId`. Creates one agent with a CES endpoint.

## Responses

A connection never carries a credential. Provider settings come back under
`livekit`, `vapi`, `pipecat`, `kore` or `googleCes` (the others are `null`).
Pipecat secrets are reported only as `hasAuthToken` / `hasPccPublicKey`.
