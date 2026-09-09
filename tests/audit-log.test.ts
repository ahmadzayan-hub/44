import test from 'node:test';
import assert from 'node:assert/strict';

import { GENESIS_HASH, InMemoryAuditLog, computeAuditHash } from '../src/audit/log.ts';
import { DEMO_REPORT } from '../src/demo.ts';
import { transitionReport } from '../src/reporting/approval.ts';

test('audit events are hash-chained from genesis and verifiable', async () => {
  const log = new InMemoryAuditLog();
  const first = await log.append({ action: 'agent.run_planned', actorId: 'engineer-1', subjectType: 'task', subjectId: 'T-1', at: '2026-09-01T08:00:00Z' });
  const second = await log.append({ action: 'proposal.created', actorId: 'engineer-1', subjectType: 'proposal', subjectId: 'P-1', at: '2026-09-01T08:05:00Z' });
  assert.equal(first.sequence, 1);
  assert.equal(first.previousHash, GENESIS_HASH);
  assert.equal(second.previousHash, first.hash);
  assert.match(second.hash, /^[0-9a-f]{64}$/);
  assert.deepEqual(await log.verifyChain(), { valid: true });
});

test('audit hash is deterministic for identical content', async () => {
  const input = { action: 'report.approved' as const, actorId: 'mgr-1', subjectType: 'report' as const, subjectId: 'R-1', at: '2026-09-02T09:00:00Z' };
  assert.equal(await computeAuditHash(input, 1, GENESIS_HASH), await computeAuditHash({ ...input }, 1, GENESIS_HASH));
  assert.notEqual(await computeAuditHash(input, 1, GENESIS_HASH), await computeAuditHash({ ...input, actorId: 'mgr-2' }, 1, GENESIS_HASH));
});

test('tampering with a recorded event breaks chain verification', async () => {
  const log = new InMemoryAuditLog();
  const event = await log.append({ action: 'report.approved', actorId: 'mgr-1', subjectType: 'report', subjectId: 'R-1', at: '2026-09-02T09:00:00Z' });
  await log.append({ action: 'report.locked', actorId: 'engineer-1', subjectType: 'report', subjectId: 'R-1', at: '2026-09-03T09:00:00Z' });
  (event as { actorId: string }).actorId = 'someone-else';
  const result = await log.verifyChain();
  assert.equal(result.valid, false);
  assert.equal(result.brokenAtSequence, 1);
});

test('audit log rejects anonymous or undated events', async () => {
  const log = new InMemoryAuditLog();
  await assert.rejects(() => log.append({ action: 'report.locked', actorId: '', subjectType: 'report', subjectId: 'R-1', at: '2026-09-03T09:00:00Z' }), /named actor/);
  await assert.rejects(() => log.append({ action: 'report.locked', actorId: 'x', subjectType: 'report', subjectId: 'R-1', at: 'never' }), /valid timestamp/);
});

test('report transitions produce audit events that reconstruct the decision trail', async () => {
  const log = new InMemoryAuditLog();
  const submitted = transitionReport(DEMO_REPORT, { type: 'submit_for_review', actorId: 'engineer-1', actorRole: 'Reliability Engineer', at: '2026-09-01T08:00:00Z', evidenceVersion: 'ev-1' });
  await log.append(submitted.audit);
  const refused = transitionReport(submitted.report, { type: 'approve', approval: { reviewerId: 'mgr-1', reviewerRole: 'Manager', decision: 'approved', at: '2026-09-02T09:00:00Z' }, evidenceVersion: 'ev-1' });
  await log.append(refused.audit);
  const approved = transitionReport(submitted.report, { type: 'approve', approval: { reviewerId: 'mgr-1', reviewerRole: 'Manager', decision: 'approved', at: '2026-09-02T09:30:00Z', note: 'Mitigation reviewed.' }, evidenceVersion: 'ev-1' });
  await log.append(approved.audit);

  const trail = await log.bySubject('report', DEMO_REPORT.reportId);
  assert.deepEqual(trail.map((event) => event.action), ['report.submitted_for_review', 'report.transition_refused', 'report.approved']);
  assert.equal(trail[2]?.actorId, 'mgr-1');
  assert.equal(trail[2]?.toState, 'approved');
  assert.deepEqual(await log.verifyChain(), { valid: true });
});
