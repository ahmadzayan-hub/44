import type {
  AgentDefinition,
  AgentExecutionPlan,
  AgentTask,
  RiskClass,
} from './contracts.ts';
import { evaluateExecutionPolicy } from './policy.ts';

const RISK_ORDER: readonly RiskClass[] = ['routine', 'operational', 'contractual', 'financial', 'safety_critical'];

/** Returns the higher of two risk classes. */
export function escalateRisk(a: RiskClass, b: RiskClass): RiskClass {
  return RISK_ORDER.indexOf(a) >= RISK_ORDER.indexOf(b) ? a : b;
}

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

  const minimum = agent.minimumRiskClass?.[task.capability];
  const effectiveTask: AgentTask = minimum ? { ...task, riskClass: escalateRisk(task.riskClass, minimum) } : task;

  const policy = evaluateExecutionPolicy(effectiveTask);
  if (!policy.allowed) {
    return { ok: false, reason: 'policy_blocked', detail: policy.reason };
  }

  return {
    ok: true,
    plan: {
      task: effectiveTask,
      agent,
      policy,
      toolIds: agent.allowedToolIds,
    },
  };
}
