import type {
  AgentDefinition,
  AgentExecutionPlan,
  AgentTask,
} from './contracts.ts';
import { evaluateExecutionPolicy } from './policy.ts';

export type PlanningResult =
  | { ok: true; plan: AgentExecutionPlan }
  | { ok: false; reason: 'capability_not_found' | 'action_not_supported' | 'policy_blocked'; detail: string };

/**
 * Deterministic routing comes before LLM planning. This keeps security and
 * capability boundaries testable and prevents a model from inventing tools.
 */
export function createExecutionPlan(
  task: AgentTask,
  catalog: readonly AgentDefinition[],
): PlanningResult {
  const agent = catalog.find((candidate) => candidate.capabilities.includes(task.capability));

  if (!agent) {
    return {
      ok: false,
      reason: 'capability_not_found',
      detail: `No registered agent owns capability: ${task.capability}`,
    };
  }

  if (!agent.allowedActionModes.includes(task.actionMode)) {
    return {
      ok: false,
      reason: 'action_not_supported',
      detail: `${agent.id} does not support action mode: ${task.actionMode}`,
    };
  }

  const policy = evaluateExecutionPolicy(task);
  if (!policy.allowed) {
    return { ok: false, reason: 'policy_blocked', detail: policy.reason };
  }

  return {
    ok: true,
    plan: {
      task,
      agent,
      policy,
      toolIds: agent.allowedToolIds,
    },
  };
}
