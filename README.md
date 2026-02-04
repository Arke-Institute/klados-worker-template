# Klados Worker Template

A lightweight Cloudflare Worker template for building klados agents that integrate with Arke rhiza workflows.

## Overview

This template provides a minimal klados worker that:
- Accepts job requests from Arke
- Processes a target entity
- Creates output entities
- Hands off to the next step in the workflow

Uses `KladosJob` from `@arke-institute/rhiza` which handles all the boilerplate:
- Log entry creation and finalization
- Error handling (both log and batch slot updates)
- Workflow handoff via `interpretThen`

## Quick Start

### 1. Generate from template

```bash
wrangler generate my-klados-worker arke-institute/klados-worker-template
cd my-klados-worker
npm install
```

### 2. Configure agent.json

Edit `agent.json` with your klados configuration:
```json
{
  "label": "My Klados Worker",
  "description": "Description of what this worker does",
  "endpoint": "https://my-klados-worker.username.workers.dev",
  "actions_required": ["entity:view", "entity:update"],
  "accepts": {
    "types": ["*"],
    "cardinality": "one"
  },
  "produces": {
    "types": ["*"],
    "cardinality": "one"
  }
}
```

Update the `name` in `wrangler.jsonc` to match your worker name.

### 3. Implement your processing logic

Edit `src/job.ts`:
```typescript
export async function processJob(job: KladosJob): Promise<string[]> {
  // 1. Fetch the target entity
  const target = await job.fetchTarget<YourTargetType>();

  // 2. Process it (AI calls, transformations, etc.)
  const result = await yourProcessingLogic(target);

  // 3. Create output entity
  const { data: output } = await job.client.api.POST('/entities', {
    body: {
      type: 'your_output_type',
      collection: job.request.job_collection,
      properties: { result },
    },
  });

  // 4. Return output IDs for workflow handoff
  return [output.id];
}
```

### 4. Register with Arke

The registration script handles everything automatically:
1. Creates a collection for your klados
2. Creates the klados entity
3. Verifies endpoint ownership
4. Deploys the worker
5. Activates the klados
6. Creates and configures the API key

```bash
# Test network (default)
ARKE_USER_KEY=uk_... npm run register

# Production network
ARKE_USER_KEY=uk_... npm run register:prod
```

The script will:
- Push secrets to Cloudflare automatically
- Update `wrangler.jsonc` with your AGENT_ID
- Deploy the worker
- Save state to `.klados-state.json`

### 5. Deploy updates

After the initial registration, deploy updates with:
```bash
npm run deploy
```

To update the klados configuration (label, description, etc.), edit `agent.json` and run:
```bash
ARKE_USER_KEY=uk_... npm run register
```

## Project Structure

```
klados-worker-template/
├── src/
│   ├── index.ts    # Hono router + fetch handler
│   ├── job.ts      # Your processing logic
│   └── types.ts    # Type definitions
├── test/
│   └── worker.test.ts  # E2E tests
├── scripts/
│   └── register.ts # Automated registration script
├── agent.json      # Klados configuration
├── wrangler.jsonc  # Cloudflare Worker config
├── package.json
├── tsconfig.json
└── README.md
```

## Key Concepts

### Endpoints

The worker exposes these endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/.well-known/arke-verification` | GET | Endpoint verification for registration |
| `/process` | POST | Main job processing (called by Arke API) |

### KladosJob Lifecycle

```typescript
// In src/index.ts
const job = KladosJob.accept(req, config);

ctx.waitUntil(job.run(async () => {
  // Your code runs here
  // KladosJob handles:
  // 1. Writing initial log entry (status: running)
  // 2. Catching errors → update log + batch slot
  // 3. On success → execute handoff, update log (status: done)
  return outputIds;
}));

return Response.json(job.acceptResponse);
```

### Available on KladosJob

```typescript
job.client          // ArkeClient - pre-configured for this job
job.log             // Logger - job.log.info(), .warning(), .error(), .success()
job.request         // Original KladosRequest
job.isWorkflow      // true if part of a rhiza workflow
job.batchContext    // { id, index, total } if in scatter/gather
job.acceptResponse  // Response to return immediately
```

### Target Parameters

The klados receives these target parameters:
- `target_entity`: Single entity ID (when `cardinality: 'one'`)
- `target_entities`: Array of entity IDs (when `cardinality: 'many'`)
- `target_collection`: Collection ID for permission scope

### Error Handling

Errors thrown in `processJob` are automatically:
1. Classified (network error, validation error, etc.)
2. Logged to the job log
3. Recorded in batch slot (if in scatter/gather)

For explicit error codes:
```typescript
import { createKladosError, KladosErrorCode } from '@arke-institute/rhiza';

if (!isValid(input)) {
  throw createKladosError(
    KladosErrorCode.VALIDATION_ERROR,
    'Input must contain a valid URL'
  );
}
```

## Limits

This lightweight template is designed for:
- Processing that completes in < 30s CPU time
- < 1000 sub-requests (API calls) per job
- Jobs that don't need persistent state

For jobs that exceed these limits, use the DO-based template which provides:
- Batched dispatch for > 100 items
- Alarm-based processing for long-running jobs
- SQLite storage for large state

## Development

```bash
# Run locally
npm run dev

# Type check
npm run type-check

# Deploy
npm run deploy

# Register (test network)
ARKE_USER_KEY=uk_... npm run register

# Register (production)
ARKE_USER_KEY=uk_... npm run register:prod
```

## Testing

The template includes E2E test support using `@arke-institute/klados-testing`.

### Running Tests

```bash
# Run E2E tests
ARKE_USER_KEY=uk_... KLADOS_ID=klados_... npm test

# Watch mode
ARKE_USER_KEY=uk_... KLADOS_ID=klados_... npm run test:watch
```

### Test Environment Variables

| Variable | Description |
|----------|-------------|
| `ARKE_USER_KEY` | Your Arke user API key (uk_...) |
| `KLADOS_ID` | The klados entity ID from registration |
| `ARKE_API_BASE` | API base URL (default: https://arke-v1.arke.institute) |
| `ARKE_NETWORK` | Network to use: 'test' or 'main' (default: test) |

### Writing Tests

See `test/worker.test.ts` for a complete example. The testing library provides:

```typescript
import {
  configureTestClient,
  createCollection,
  createEntity,
  deleteEntity,
  invokeKlados,
  waitForKladosLog,
  assertLogCompleted,
  assertLogHasMessages,
} from '@arke-institute/klados-testing';

// Configure once in beforeAll
configureTestClient({
  apiBase: process.env.ARKE_API_BASE!,
  userKey: process.env.ARKE_USER_KEY!,
  network: 'test',
});

// Invoke and verify
const result = await invokeKlados({ ... });
const log = await waitForKladosLog(jobCollectionId);
assertLogCompleted(log);
```

## Environment Variables

| Variable | Type | Description |
|----------|------|-------------|
| `AGENT_ID` | var | Your klados agent ID (set by registration) |
| `AGENT_VERSION` | var | Version string for logging |
| `ARKE_AGENT_KEY` | secret | Agent API key (set by registration) |
| `VERIFICATION_TOKEN` | secret | Temporary, used during registration |
| `ARKE_VERIFY_AGENT_ID` | secret | Temporary, used during registration |

## Files

| File | Description |
|------|-------------|
| `agent.json` | Klados configuration (label, endpoint, actions, etc.) |
| `wrangler.jsonc` | Cloudflare Worker config |
| `.klados-state.json` | Registration state (gitignored) |
| `.dev.vars` | Local development secrets (gitignored) |

## License

MIT
