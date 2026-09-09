import test from 'node:test';
import assert from 'node:assert/strict';

import { DEMO_REPORT } from '../src/demo.ts';
import { reportReadiness, transitionReport } from '../src/reporting/approval.ts';
import type { ReportPackage } from '../src/reporting/contracts.ts';

const reviewer = { reviewerId: 'mgr-1', reviewerRole: 'Rail Maintenance Manager' };

test('demo report starts as a draft that is ready for submission', () => {
  const readiness = reportReadiness(DEMO_REPORT);
  assert.equal(readiness.status, 'draft');
  assert.deepEqual(readiness.nextTransitions, ['submit_for_review']);
  assert.deepEqual(readiness.blockers, []);
});

test('a KPI without evidence blocks submission and leaves the package unchanged', () => {
  const stripped: ReportPackage = { ...DEMO_REPORT, kpis: DEMO_REPORT.kpis.map((kpi, index) => index === 0 ? { ...kpi, evidence: [] } : kpi) };
  const result = transitionReport(stripped, { type: 'submit_for_review', actorId: 'engineer-1', at: '2026-09-01T08:00:00Z' });
  assert.equal(result.ok, false);
  assert.equal(result.report.status, 'draft');
  assert.match(result.blockers.join(' '), /availability has no decision-grade evidence/);
  assert.equal(result.audit.action, 'report.transition_refused');
});

test('approval cannot be granted from draft, and requires a note when a critical exception exists', () => {
  const early = transitionReport(DEMO_REPORT, { type: 'approve', approval: { ...reviewer, decision: 'approved', at: '2026-09-02T09:00:00Z' } });
  assert.equal(early.ok, false);
  assert.match(early.blockers[0] ?? '', /not allowed from state draft/);

  const submitted = transitionReport(DEMO_REPORT, { type: 'submit_for_review', actorId: 'engineer-1', at: '2026-09-01T08:00:00Z' });
  assert.equal(submitted.ok, true);
  assert.equal(submitted.report.status, 'under_review');
  assert.ok((submitted.audit.evidence ?? []).length > 0);

  const noNote = transitionReport(submitted.report, { type: 'approve', approval: { ...reviewer, decision: 'approved', at: '2026-09-02T09:00:00Z' } });
  assert.equal(noNote.ok, false);
  assert.match(noNote.blockers.join(' '), /critical exception/);
});

test('full lifecycle draft -> under_review -> approved -> locked with named accountability', () => {
  const submitted = transitionReport(DEMO_REPORT, { type: 'submit_for_review', actorId: 'engineer-1', actorRole: 'Reliability Engineer', at: '2026-09-01T08:00:00Z' });
  const approved = transitionReport(submitted.report, { type: 'approve', approval: { ...reviewer, decision: 'approved', at: '2026-09-02T09:00:00Z', note: 'MTTR root cause reviewed; contractor mitigation plan accepted.' } });
  assert.equal(approved.ok, true);
  assert.equal(approved.report.status, 'approved');
  assert.equal(approved.report.approval?.reviewerId, 'mgr-1');

  const tooEarly = transitionReport(approved.report, { type: 'lock', actorId: 'engineer-1', at: '2026-08-15T00:00:00Z' });
  assert.equal(tooEarly.ok, false);
  assert.match(tooEarly.blockers.join(' '), /before its period has ended/);

  const locked = transitionReport(approved.report, { type: 'lock', actorId: 'engineer-1', at: '2026-09-03T00:00:00Z' });
  assert.equal(locked.ok, true);
  assert.equal(locked.report.status, 'locked');
  assert.equal(locked.report.lockedAt, '2026-09-03T00:00:00Z');
  assert.deepEqual(reportReadiness(locked.report).nextTransitions, []);

  const afterLock = transitionReport(locked.report, { type: 'submit_for_review', actorId: 'engineer-1', at: '2026-09-04T00:00:00Z' });
  assert.equal(afterLock.ok, false);
});

test('rejection returns the package to draft and requires a reason', () => {
  const submitted = transitionReport(DEMO_REPORT, { type: 'submit_for_review', actorId: 'engineer-1', at: '2026-09-01T08:00:00Z' });
  const silent = transitionReport(submitted.report, { type: 'reject', approval: { ...reviewer, decision: 'rejected', at: '2026-09-02T09:00:00Z' } });
  assert.equal(silent.ok, false);
  const rejected = transitionReport(submitted.report, { type: 'reject', approval: { ...reviewer, decision: 'rejected', at: '2026-09-02T09:00:00Z', note: 'Downtime classification for WO-1004 is unverified.' } });
  assert.equal(rejected.ok, true);
  assert.equal(rejected.report.status, 'draft');
  assert.equal(rejected.report.reviewRequestedAt, undefined);
  assert.equal(rejected.audit.action, 'report.rejected');
});
