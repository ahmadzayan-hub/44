import type { DataClassification } from '../agent-os/contracts.ts';

/**
 * Model invocation policy.
 *
 * Confidential data never reaches a remote inference endpoint unless the
 * deployment has explicitly approved it. Synthetic data may use any endpoint.
 * Internal data may use local endpoints only, unless remote use is approved.
 */
export interface ModelInvocationPolicyConfig {
  /** Base URL of the configured gateway, or null when no model is configured. */
  baseUrl: string | null;
  /** Explicit deployment approval for sending non-synthetic data to a remote endpoint. */
  remoteApprovedForInternal: boolean;
  remoteApprovedForConfidential: boolean;
}

export interface ModelInvocationDecision {
  allowed: boolean;
  reason: string;
  endpoint: 'none' | 'local' | 'remote';
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

export function isLocalEndpoint(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname.replace(/^\[|\]$/g, '');
    if (LOCAL_HOSTS.has(host)) return true;
    if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
    return host.endsWith('.local') || host.endsWith('.internal');
  } catch {
    return false;
  }
}

export function evaluateModelInvocation(
  classification: DataClassification,
  config: ModelInvocationPolicyConfig,
): ModelInvocationDecision {
  if (!config.baseUrl) return { allowed: false, reason: 'No model gateway is configured; deterministic output only.', endpoint: 'none' };
  const endpoint = isLocalEndpoint(config.baseUrl) ? 'local' : 'remote';
  if (classification === 'synthetic') return { allowed: true, reason: 'Synthetic data may use any configured endpoint.', endpoint };
  if (endpoint === 'local') return { allowed: true, reason: `${classification} data may use a local inference endpoint.`, endpoint };
  if (classification === 'internal' && config.remoteApprovedForInternal) return { allowed: true, reason: 'Remote endpoint approved for internal data by deployment configuration.', endpoint };
  if (classification === 'confidential' && config.remoteApprovedForConfidential) return { allowed: true, reason: 'Remote endpoint approved for confidential data by deployment configuration.', endpoint };
  return { allowed: false, reason: `${classification} data must not be sent to a remote inference endpoint without explicit deployment approval.`, endpoint };
}
