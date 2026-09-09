import test from 'node:test';
import assert from 'node:assert/strict';

import type { GroundedAgentOutput } from '../src/agent-os/contracts.ts';
import { evaluateExecutionPolicy, hasApprovedHumanReview, isOutputReleaseReady } from '../src/agent-os/policy.ts';

const grounded: GroundedAgentOutput<string> = {
  taskId: 'T-100',
  agentId: 'reporting',
  value: 'MTTR breached the demo threshold for a third cycle.',
  evidence: [{ sourceSystem: 'maximo', entityType: 'work-order', entityId: 'WO-1001', observedAt: '2026-08-03T08:00:00Z' }],
  assumptions: [],
  generatedAt: '2026-09-01T00:00:00Z',
};

const contractualDraft = evaluateExecutionPolicy({
  taskId: 'T-100', actorId: 'engineer-1', goal: 'Draft contract narrative', capability: 'monthly-report',
  riskClass: 'contractual', actionMode: 'draft', requestedAt: '2026-09-01T00:00:00Z',
});
const routineRead = evaluateExecutionPolicy({
  taskId: 'T-101', actorId: 'engineer-1', goal: 'Read backlog', capability: 'maintenance-kpi',
  riskClass: 'routine', actionMode: 'read', requestedAt: '2026-09-01T00:00:00Z',
});

test('high-impact draft is not release-ready without a named approved review', () => {
  assert.equal(hasApprovedHumanReview(grounded), false);
  assert.equal(isOutputReleaseReady(grounded, contractualDraft), false);
});

test('rejected or anonymous reviews do not unlock release', () => {
  const rejected = { ...grounded, humanApproval: { reviewerId: 'mgr-1', reviewerRole: 'Contract Manager', decision: 'rejected' as const, at: '2026-09-02T09:00:00Z' } };
  const anonymous = { ...grounded, humanApproval: { reviewerId: ' ', reviewerRole: 'Contract Manager', decision: 'approved' as const, at: '2026-09-02T09:00:00Z' } };
  const badDate = { ...grounded, humanApproval: { reviewerId: 'mgr-1', reviewerRole: 'Contract Manager', decision: 'approved' as const, at: 'yesterday' } };
  assert.equal(isOutputReleaseReady(rejected, contractualDraft), false);
  assert.equal(isOutputReleaseReady(anonymous, contractualDraft), false);
  assert.equal(isOutputReleaseReady(badDate, contractualDraft), false);
});

test('valid approved high-impact output is release-ready', () => {
  const approved = { ...grounded, humanApproval: { reviewerId: 'mgr-1', reviewerRole: 'Contract Manager', decision: 'approved' as const, at: '2026-09-02T09:00:00Z' } };
  assert.equal(hasApprovedHumanReview(approved), true);
  assert.equal(isOutputReleaseReady(approved, contractualDraft), true);
});

test('routine output needs evidence but no approval', () => {
  assert.equal(isOutputReleaseReady(grounded, routineRead), true);
  assert.equal(isOutputReleaseReady({ ...grounded, evidence: [] }, routineRead), false);
});

test('blocked policy is never release-ready', () => {
  const blocked = evaluateExecutionPolicy({
    taskId: 'T-102', actorId: 'engineer-1', goal: 'Write to Maximo', capability: 'asset-health',
    riskClass: 'operational', actionMode: 'execute_write', requestedAt: '2026-09-01T00:00:00Z',
  });
  const approved = { ...grounded, humanApproval: { reviewerId: 'mgr-1', reviewerRole: 'Contract Manager', decision: 'approved' as const, at: '2026-09-02T09:00:00Z' } };
  assert.equal(isOutputReleaseReady(approved, blocked), false);
});
