import { describe, expect, it } from 'vitest';

import { AGENT_CATALOG } from '../src/agent-os/catalog.js';
import type { AgentTask, GroundedAgentOutput } from '../src/agent-os/contracts.js';
import { createExecutionPlan } from '../src/agent-os/kernel.js';
import {
  evaluateExecutionPolicy,
  hasApprovedHumanReview,
  hasDecisionGradeEvidence,
  isOutputReleaseReady,
} from '../src/agent-os/policy.js';

function task(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    taskId: 'T-001',
    actorId: 'engineer-1',
    goal: 'Explain the monthly maintenance KPI exception',
    capability: 'maintenance-kpi',
    riskClass: 'operational',
    actionMode: 'analyse',
    requestedAt: '2026-09-09T00:00:00Z',
    ...overrides,
  };
}

function evidencedOutput(
  overrides: Partial<GroundedAgentOutput<string>> = {},
): GroundedAgentOutput<string> {
  return {
    taskId: 'T-001',
    agentId: 'maintenance-kpi',
    value: 'Availability is below target.',
    evidence: [
      {
        sourceSystem: 'maximo',
        entityType: 'work-order',
        entityId: 'WO-42',
        observedAt: '2026-09-08T10:00:00Z',
      },
    ],
    assumptions: [],
    generatedAt: '2026-09-09T00:01:00Z',
    ...overrides,
  };
}

describe('RailMind Agent OS foundation', () => {
  it('routes a known capability deterministically', () => {
    const result = createExecutionPlan(task(), AGENT_CATALOG);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.agent.id).toBe('maintenance-kpi');
      expect(result.plan.policy.allowed).toBe(true);
    }
  });

  it('does not let a model invent an unregistered capability', () => {
    const result = createExecutionPlan(task({ capability: 'unknown-capability' }), AGENT_CATALOG);
    expect(result).toMatchObject({ ok: false, reason: 'capability_not_found' });
  });

  it('blocks autonomous external writes in P0', () => {
    const result = evaluateExecutionPolicy(task({ actionMode: 'execute_write' }));
    expect(result.allowed).toBe(false);
  });

  it('blocks rail control actions', () => {
    const result = evaluateExecutionPolicy(task({ actionMode: 'control', riskClass: 'safety_critical' }));
    expect(result.allowed).toBe(false);
  });

  it('requires human approval for contractual outputs', () => {
    const result = evaluateExecutionPolicy(task({ riskClass: 'contractual', actionMode: 'draft' }));
    expect(result.allowed).toBe(true);
    expect(result.approvalRequired).toBe(true);
  });

  it('rejects decision-grade output with no evidence', () => {
    const output: GroundedAgentOutput<string> = {
      taskId: 'T-001',
      agentId: 'maintenance-kpi',
      value: 'Availability is below target.',
      evidence: [],
      assumptions: [],
      generatedAt: '2026-09-09T00:01:00Z',
    };
    expect(hasDecisionGradeEvidence(output)).toBe(false);
  });

  it('accepts output with valid provenance', () => {
    const output = evidencedOutput();
    expect(hasDecisionGradeEvidence(output)).toBe(true);
  });

  it('does not release a contractual output without named approval', () => {
    expect(isOutputReleaseReady(task({ riskClass: 'contractual' }), evidencedOutput())).toBe(false);
  });

  it('does not release a rejected contractual output', () => {
    const output = evidencedOutput({
      humanApproval: {
        reviewerId: 'reviewer-1',
        reviewerRole: 'Contract Manager',
        decision: 'rejected',
        at: '2026-09-09T00:10:00Z',
      },
    });

    expect(hasApprovedHumanReview(output)).toBe(false);
    expect(isOutputReleaseReady(task({ riskClass: 'contractual' }), output)).toBe(false);
  });

  it('releases a high-impact output only after valid named approval', () => {
    const output = evidencedOutput({
      humanApproval: {
        reviewerId: 'reviewer-1',
        reviewerRole: 'Contract Manager',
        decision: 'approved',
        at: '2026-09-09T00:10:00Z',
      },
    });

    expect(hasApprovedHumanReview(output)).toBe(true);
    expect(isOutputReleaseReady(task({ riskClass: 'contractual' }), output)).toBe(true);
  });
});
