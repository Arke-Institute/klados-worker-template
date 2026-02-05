/**
 * Job Processing Logic
 *
 * This file contains the main business logic for processing jobs.
 * Customize the processJob function to implement your worker's behavior.
 */

import type { KladosJob } from '@arke-institute/rhiza';
import type { TargetProperties, OutputProperties } from './types';

/**
 * Process a job and return output entity IDs
 *
 * This is where you implement your worker's core logic:
 * 1. Fetch and validate the target entity
 * 2. Process the entity (AI calls, transformations, etc.)
 * 3. Create output entities
 * 4. Return the output entity IDs
 *
 * The KladosJob handles logging, error handling, and workflow handoff.
 *
 * @param job - The KladosJob instance (provides client, logger, request info)
 * @returns Array of output entity IDs
 */
export async function processJob(job: KladosJob): Promise<string[]> {
  job.log.info('Starting job processing', {
    target: job.request.target_entity,
    isWorkflow: job.isWorkflow,
  });

  // =========================================================================
  // Step 1: Fetch the target entity
  // =========================================================================

  const target = await job.fetchTarget<TargetProperties>();
  job.log.info('Fetched target entity', {
    id: target.id,
    type: target.type,
    title: target.properties.title,
  });

  // =========================================================================
  // Step 2: Validate the target (optional but recommended)
  // =========================================================================

  // Example validation - customize for your use case
  // if (!target.properties.content) {
  //   throw createKladosError(
  //     KladosErrorCode.INVALID_INPUT,
  //     'Target entity must have content property'
  //   );
  // }

  // =========================================================================
  // Step 3: Process the entity
  // =========================================================================

  // Replace this with your actual processing logic:
  // - AI/LLM calls
  // - Data transformation
  // - External API calls
  // - etc.

  job.log.info('Processing entity...');

  const result = await processEntity(target.id, target.properties);

  job.log.info('Processing complete', {
    resultLength: result.length,
  });

  // =========================================================================
  // Step 4: Create output entity (if needed)
  // =========================================================================

  const outputProperties: OutputProperties = {
    result,
    source_id: target.id,
    processed_at: new Date().toISOString(),
  };

  const { data: output, error } = await job.client.api.POST('/entities', {
    body: {
      type: 'processed_output', // Customize the output type
      collection: job.request.job_collection,
      properties: outputProperties as Record<string, unknown>,
      relationships: [
        {
          predicate: 'derived_from',
          peer: target.id,
          peer_type: target.type,
        },
      ],
    },
  });

  if (error || !output) {
    throw new Error(`Failed to create output entity: ${JSON.stringify(error)}`);
  }

  job.log.success('Created output entity', { outputId: output.id });

  // =========================================================================
  // Step 5: Return output IDs for workflow handoff
  // =========================================================================

  // The KladosJob will use these IDs for the next step in the workflow
  // (pass, scatter, or gather depending on your rhiza flow definition)
  return [output.id];
}

/**
 * Example processing function - replace with your actual logic
 *
 * @param entityId - The entity ID being processed
 * @param properties - The entity properties
 * @returns Processed result
 */
async function processEntity(
  entityId: string,
  properties: TargetProperties
): Promise<string> {
  // Example: Simple echo processing
  // Replace this with your actual processing logic

  // Simulate some processing time
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Return a processed result
  return `Processed entity ${entityId}: ${properties.title || 'untitled'}`;
}
