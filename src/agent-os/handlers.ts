import type { AgentExecutionPlan, AgentTask, EvidenceRef, ModelGateway } from './contracts.ts';
import type { MemoryStore } from './memory.ts';
import type { ToolInvoker } from './tools.ts';

/**
 * A capability handler is the executable body of a registered capability.
 * It receives only governed resources: a tool invoker scoped to the plan, an
 * optional model gateway (null when policy or catalog forbids it), and memory.
 * It must return evidence for every conclusion and list its assumptions.
 */
export interface CapabilityContext {
  task: AgentTask;
  plan: AgentExecutionPlan;
  tools: ToolInvoker;
  /** Null when the agent may not use a model or the invocation policy refused. */
  model: ModelGateway | null;
  memory: MemoryStore;
  now: () => string;
}

export interface CapabilityResult<T = unknown> {
  value: T;
  evidence: readonly EvidenceRef[];
  assumptions: readonly string[];
  /** True when a model contributed to the value (narrative only, never facts). */
  modelUsed?: boolean;
}

export interface CapabilityHandler<T = unknown> {
  capability: string;
  execute(context: CapabilityContext): Promise<CapabilityResult<T>>;
}
