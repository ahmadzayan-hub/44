import test from 'node:test';
import assert from 'node:assert/strict';

import { AGENT_CATALOG } from '../src/agent-os/catalog.ts';
import type { AgentTask, GroundedAgentOutput } from '../src/agent-os/contracts.ts';
import { createExecutionPlan } from '../src/agent-os/kernel.ts';
import { evaluateExecutionPolicy, hasDecisionGradeEvidence } from '../src/agent-os/policy.ts';

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

test('routes a known capability deterministically', () => {
  const result = createExecutionPlan(task(), AGENT_CATALOG);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.plan.agent.id, 'maintenance-kpi');
    assert.equal(result.plan.policy.allowed, true);
  }
});

test('does not let a model invent an unregistered capability', () => {
  const result = createExecutionPlan(task({ capability: 'unknown-capability' }), AGENT_CATALOG);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'capability_not_found');
});

test('blocks autonomous external writes in P0', () => {
  assert.equal(evaluateExecutionPolicy(task({ actionMode: 'execute_write' })).allowed, false);
});

test('blocks rail control actions', () => {
  assert.equal(
    evaluateExecutionPolicy(task({ actionMode: 'control', riskClass: 'safety_critical' })).allowed,
    false,
  );
});

test('requires human approval for contractual outputs', () => {
  const result = evaluateExecutionPolicy(task({ riskClass: 'contractual', actionMode: 'draft' }));
  assert.equal(result.allowed, true);
  assert.equal(result.approvalRequired, true);
});

test('requires evidence for decision-grade output', () => {
  const noEvidence: GroundedAgentOutput<string> = {
    taskId: 'T-001',
    agentId: 'maintenance-kpi',
    value: 'Availability is below target.',
    evidence: [],
    assumptions: [],
    generatedAt: '2026-09-09T00:01:00Z',
  };
  assert.equal(hasDecisionGradeEvidence(noEvidence), false);

  const grounded: GroundedAgentOutput<string> = {
    ...noEvidence,
    evidence: [{
      sourceSystem: 'maximo',
      entityType: 'work-order',
      entityId: 'WO-42',
      observedAt: '2026-09-08T10:00:00Z',
    }],
  };
  assert.equal(hasDecisionGradeEvidence(grounded), true);
});
