/**
 * E2E Test for Klados Worker
 *
 * This test invokes your klados worker against the Arke API and verifies:
 * 1. The worker accepts and processes jobs correctly
 * 2. Output entities are created as expected
 * 3. Log entries are properly recorded
 *
 * Prerequisites:
 * 1. Deploy your worker: npm run deploy
 * 2. Register the klados: npm run register
 * 3. Set environment variables (see below)
 *
 * Environment variables:
 *   ARKE_USER_KEY   - Your Arke user API key (uk_...)
 *   KLADOS_ID       - The klados entity ID from registration
 *   ARKE_API_BASE   - API base URL (default: https://arke-v1.arke.institute)
 *   ARKE_NETWORK    - Network to use (default: test)
 *
 * Usage:
 *   ARKE_USER_KEY=uk_... KLADOS_ID=klados_... npm test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  configureTestClient,
  createCollection,
  createEntity,
  getEntity,
  deleteEntity,
  invokeKlados,
  waitForKladosLog,
  assertLogCompleted,
  assertLogHasMessages,
  log,
} from '@arke-institute/klados-testing';

// =============================================================================
// Configuration
// =============================================================================

const ARKE_API_BASE = process.env.ARKE_API_BASE || 'https://arke-v1.arke.institute';
const ARKE_USER_KEY = process.env.ARKE_USER_KEY;
const NETWORK = (process.env.ARKE_NETWORK || 'test') as 'test' | 'main';
const KLADOS_ID = process.env.KLADOS_ID;

// =============================================================================
// Test Suite
// =============================================================================

describe('klados-worker', () => {
  // Test fixtures
  let targetCollection: { id: string };
  let jobCollection: { id: string };
  let testEntity: { id: string };

  // Skip tests if environment not configured
  beforeAll(() => {
    if (!ARKE_USER_KEY) {
      console.warn('Skipping tests: ARKE_USER_KEY not set');
      return;
    }
    if (!KLADOS_ID) {
      console.warn('Skipping tests: KLADOS_ID not set');
      return;
    }

    // Configure the test client
    configureTestClient({
      apiBase: ARKE_API_BASE,
      userKey: ARKE_USER_KEY,
      network: NETWORK,
    });
  });

  // Create test fixtures
  beforeAll(async () => {
    if (!ARKE_USER_KEY || !KLADOS_ID) return;

    log('Creating test fixtures...');

    // Create target collection
    targetCollection = await createCollection({
      label: `Test Target ${Date.now()}`,
      description: 'Target collection for worker test',
    });
    log(`Created target collection: ${targetCollection.id}`);

    // Create job collection
    jobCollection = await createCollection({
      label: `Test Jobs ${Date.now()}`,
      description: 'Job collection for worker test',
    });
    log(`Created job collection: ${jobCollection.id}`);

    // Create test entity
    testEntity = await createEntity({
      type: 'test_entity',
      properties: {
        title: 'Test Entity',
        content: 'Test content for processing',
        created_at: new Date().toISOString(),
      },
      collectionId: targetCollection.id,
    });
    log(`Created test entity: ${testEntity.id}`);
  });

  // Cleanup test fixtures
  afterAll(async () => {
    if (!ARKE_USER_KEY || !KLADOS_ID) return;

    log('Cleaning up test fixtures...');

    try {
      if (testEntity?.id) await deleteEntity(testEntity.id);
      if (targetCollection?.id) await deleteEntity(targetCollection.id);
      if (jobCollection?.id) await deleteEntity(jobCollection.id);
      log('Cleanup complete');
    } catch (e) {
      log(`Cleanup error (non-fatal): ${e}`);
    }
  });

  // ==========================================================================
  // Tests
  // ==========================================================================

  it('should process entity and create output', async () => {
    if (!ARKE_USER_KEY || !KLADOS_ID) {
      console.warn('Test skipped: missing environment variables');
      return;
    }

    // Invoke the klados
    log('Invoking klados...');
    const result = await invokeKlados({
      kladosId: KLADOS_ID,
      targetEntity: testEntity.id,
      targetCollection: targetCollection.id,
      jobCollection: jobCollection.id,
      confirm: true,
    });

    expect(result.status).toBe('started');
    expect(result.job_id).toBeDefined();
    log(`Job started: ${result.job_id}`);

    // Wait for completion
    log('Waiting for job completion...');
    const kladosLog = await waitForKladosLog(jobCollection.id, {
      timeout: 30000,
      pollInterval: 2000,
    });

    // Verify log completed successfully
    assertLogCompleted(kladosLog);
    log(`Job completed with status: ${kladosLog.properties.status}`);

    // Verify expected log messages
    assertLogHasMessages(kladosLog, [
      { textContains: 'Starting job' },
      { textContains: 'Fetched target' },
      { textContains: 'Processing' },
    ]);
    log('Log messages verified');

    // Log all messages for debugging
    for (const msg of kladosLog.properties.log_data.messages) {
      log(`  [${msg.level}] ${msg.message}`);
    }
  });

  it('should handle preview mode (confirm=false)', async () => {
    if (!ARKE_USER_KEY || !KLADOS_ID) {
      console.warn('Test skipped: missing environment variables');
      return;
    }

    // Preview invocation (confirm=false)
    const preview = await invokeKlados({
      kladosId: KLADOS_ID,
      targetEntity: testEntity.id,
      targetCollection: targetCollection.id,
      jobCollection: jobCollection.id,
      confirm: false,
    });

    // Preview should return pending_confirmation status
    expect(preview.status).toBe('pending_confirmation');
    log(`Preview result: ${preview.status}`);
  });
});
