import type {
  ActionMode,
  AgentTask,
  ExecutionPolicyDecision,
  GroundedAgentOutput,
} from './contracts.ts';

const BLOCKED_MODES: readonly ActionMode[] = ['execute_write', 'control'];

/**
 * P0 execution policy.
 *
 * RailMind can read, analyse, draft and create outbound proposals. It cannot
 * autonomously execute an external write and can never perform rail control.
 */
export function evaluateExecutionPolicy(task: AgentTask): ExecutionPolicyDecision {
  if (BLOCKED_MODES.includes(task.actionMode)) {
    return {
      allowed: false,
      approvalRequired: false,
      reason:
        task.actionMode === 'control'
          ? 'RailMind performs no safety-critical rail control action.'
          : 'P0 integrations are read-only; external writes must remain proposals.',
    };
  }

  if (task.actionMode === 'propose_write') {
    return {
      allowed: true,
      approvalRequired: true,
      reason: 'Outbound proposals require named human approval before external use.',
    };
  }

  if (
    task.riskClass === 'safety_critical' ||
    task.riskClass === 'contractual' ||
    task.riskClass === 'financial'
  ) {
    return {
      allowed: true,
      approvalRequired: true,
      reason: 'High-impact output requires named human review and approval.',
    };
  }

  return {
    allowed: true,
    approvalRequired: false,
    reason: 'Task is within the P0 read/analysis boundary.',
  };
}

/** Decision-grade outputs must carry provenance. */
export function hasDecisionGradeEvidence<T>(output: GroundedAgentOutput<T>): boolean {
  return (
    output.evidence.length > 0 &&
    output.evidence.every(
      (ref) =>
        ref.sourceSystem.length > 0 &&
        ref.entityType.trim().length > 0 &&
        ref.entityId.trim().length > 0 &&
        !Number.isNaN(Date.parse(ref.observedAt)),
    )
  );
}
