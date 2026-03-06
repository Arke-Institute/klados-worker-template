/**
 * Type definitions for the klados worker
 */

/**
 * Cloudflare Worker environment bindings
 *
 * Supports dual-network deployment with network-specific agent IDs and keys.
 * Set AGENT_ID_TEST/AGENT_ID_MAIN and corresponding secrets for multi-network.
 */
export interface Env {
  /** Default klados agent ID (fallback if network-specific not set) */
  AGENT_ID: string;

  /** Agent version for logging */
  AGENT_VERSION: string;

  /** Default Arke agent API key (secret, fallback if network-specific not set) */
  ARKE_AGENT_KEY: string;

  /** Test network klados ID (optional, for dual-network deployment) */
  AGENT_ID_TEST?: string;

  /** Main network klados ID (optional, for dual-network deployment) */
  AGENT_ID_MAIN?: string;

  /** Test network agent API key (secret, optional) */
  ARKE_AGENT_KEY_TEST?: string;

  /** Main network agent API key (secret, optional) */
  ARKE_AGENT_KEY_MAIN?: string;

  /** Verification token for endpoint verification (set during registration) */
  VERIFICATION_TOKEN?: string;

  /** Agent ID for verification (used before AGENT_ID is configured) */
  ARKE_VERIFY_AGENT_ID?: string;
}

/**
 * Example: Properties of the target entity being processed
 *
 * Customize this based on what your worker processes.
 */
export interface TargetProperties {
  /** Example: title of the entity */
  title?: string;

  /** Example: content to process */
  content?: string;

  /** Example: URL to fetch */
  url?: string;

  /** Allow any additional properties */
  [key: string]: unknown;
}

/**
 * Example: Properties for output entities created by this worker
 *
 * Customize this based on what your worker produces.
 */
export interface OutputProperties {
  /** Example: processed result */
  result?: string;

  /** Example: extracted data */
  extracted?: Record<string, unknown>;

  /** Reference to source entity */
  source_id?: string;

  /** Processing timestamp */
  processed_at?: string;

  /** Allow any additional properties */
  [key: string]: unknown;
}
