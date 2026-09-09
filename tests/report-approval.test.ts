import test from 'node:test';
import assert from 'node:assert/strict';

import { DEMO_REPORT } from '../src/demo.ts';
import { approvalInvalidated, reportReadiness, transitionReport } from '../src/reporting/approval.ts';
import { computeEvidenceVersion } from '../src/reporting/evidence-version.ts';
import type { ReportPackage } from '../src/reporting/contracts.ts';

const reviewer = { reviewerId: 'mgr-1', reviewerRole: 'Rail Maintenance Manager' };
const EV = 'ev-' + 'a'.repeat(61);
const submit = (report: ReportPackage, evidenceVersion = EV) => transitionReport(report, { type: 'submit_for_review', actorId: 'engineer-1', actorRole: 'Reliability Engineer', at: '2026-09-01T08:00:00Z', evidenceVersion });

test('demo report starts as a draft that is ready for submission', () => {
  const readiness = reportReadiness(DEMO_REPORT);
  assert.equal(readiness.status, 'draft');
  assert.deepEqual(readiness.nextTransitions, ['submit_for_review']);
  assert.deepEqual(readiness.blockers, []);
});

test('a KPI without evidence blocks submission and leaves the package unchanged', () => {
  const stripped: ReportPackage = { ...DEMO_REPORT, kpis: DEMO_REPORT.kpis.map((kpi, index) => index === 0 ? { ...kpi, evidence: [] } : kpi) };
  const result = submit(stripped);
  assert.equal(result.ok, false);
  assert.equal(result.report.status, 'draft');
  assert.match(result.blockers.join(' '), /availability has no decision-grade evidence/);
  assert.equal(result.audit.action, 'report.transition_refused');
});

test('approval cannot be granted from draft, and requires a note when a critical exception exists', () => {
  const early = transitionReport(DEMO_REPORT, { type: 'approve', approval: { ...reviewer, decision: 'approved', at: '2026-09-02T09:00:00Z' }, evidenceVersion: EV });
  assert.equal(early.ok, false);
  assert.match(early.blockers[0] ?? '', /not allowed from state draft/);

  const submitted = submit(DEMO_REPORT);
  assert.equal(submitted.ok, true);
  assert.equal(submitted.report.status, 'under_review');
  assert.equal(submitted.report.evidenceVersion, EV);
  assert.ok((submitted.audit.evidence ?? []).length > 0);

  const noNote = transitionReport(submitted.report, { type: 'approve', approval: { ...reviewer, decision: 'approved', at: '2026-09-02T09:00:00Z' }, evidenceVersion: EV });
  assert.equal(noNote.ok, false);
  assert.match(noNote.blockers.join(' '), /critical exception/);
});

test('full lifecycle draft -> under_review -> approved -> locked with named accountability', () => {
  const submitted = submit(DEMO_REPORT);
  const approved = transitionReport(submitted.report, { type: 'approve', approval: { ...reviewer, decision: 'approved', at: '2026-09-02T09:00:00Z', note: 'MTTR root cause reviewed; contractor mitigation plan accepted.' }, evidenceVersion: EV });
  assert.equal(approved.ok, true);
  assert.equal(approved.report.status, 'approved');
  assert.equal(approved.report.approval?.reviewerId, 'mgr-1');
  assert.equal(approved.report.approval?.evidenceVersion, EV);
  assert.equal(approved.report.approval?.formulaVersions.mttr, 'demo-v1');

  const tooEarly = transitionReport(approved.report, { type: 'lock', actorId: 'engineer-1', at: '2026-08-15T00:00:00Z' });
  assert.equal(tooEarly.ok, false);
  assert.match(tooEarly.blockers.join(' '), /before its period has ended/);

  const locked = transitionReport(approved.report, { type: 'lock', actorId: 'engineer-1', at: '2026-09-03T00:00:00Z' });
  assert.equal(locked.ok, true);
  assert.equal(locked.report.status, 'locked');
  assert.equal(locked.report.lockedAt, '2026-09-03T00:00:00Z');
  assert.deepEqual(reportReadiness(locked.report).nextTransitions, []);

  const afterLock = submit(locked.report);
  assert.equal(afterLock.ok, false);
});

test('approval is bound to the evidence version: a changed evidence set cannot be approved and invalidates an existing approval', async () => {
  const submitted = submit(DEMO_REPORT);
  const stale = transitionReport(submitted.report, { type: 'approve', approval: { ...reviewer, decision: 'approved', at: '2026-09-02T09:00:00Z', note: 'ok' }, evidenceVersion: 'ev-different' });
  assert.equal(stale.ok, false);
  assert.match(stale.blockers.join(' '), /Evidence has changed since submission/);

  const approved = transitionReport(submitted.report, { type: 'approve', approval: { ...reviewer, decision: 'approved', at: '2026-09-02T09:00:00Z', note: 'ok' }, evidenceVersion: EV });
  assert.equal(approvalInvalidated(approved.report, EV), false);
  assert.equal(approvalInvalidated(approved.report, 'ev-new'), true);
  assert.equal(reportReadiness(approved.report, 'ev-new').approvalValid, false);

  const superseded = transitionReport(approved.report, { type: 'supersede', actorId: 'system.evidence-monitor', at: '2026-09-03T00:00:00Z', reason: 'WO-1004 closed with revised downtime.', newEvidenceVersion: 'ev-new' });
  assert.equal(superseded.ok, true);
  assert.equal(superseded.report.status, 'superseded');
  assert.equal(superseded.report.supersession?.previousEvidenceVersion, EV);
  assert.equal(superseded.audit.action, 'report.superseded');
  const lockAfter = transitionReport(superseded.report, { type: 'lock', actorId: 'engineer-1', at: '2026-09-04T00:00:00Z' });
  assert.equal(lockAfter.ok, false);
  const revised = transitionReport(superseded.report, { type: 'revise', actorId: 'engineer-1', at: '2026-09-04T00:00:00Z' });
  assert.equal(revised.report.status, 'draft');
  assert.equal(revised.report.approval, undefined);
});

test('evidence version is deterministic and changes when a value, formula version or evidence record changes', async () => {
  const base = await computeEvidenceVersion(DEMO_REPORT.kpis);
  assert.equal(base, await computeEvidenceVersion([...DEMO_REPORT.kpis].reverse()));
  const changedValue = DEMO_REPORT.kpis.map((k, i) => (i === 0 ? { ...k, value: k.value + 0.001 } : k));
  assert.notEqual(base, await computeEvidenceVersion(changedValue));
  const changedFormula = DEMO_REPORT.kpis.map((k, i) => (i === 0 ? { ...k, definition: { ...k.definition, formulaVersion: 'demo-v2' } } : k));
  assert.notEqual(base, await computeEvidenceVersion(changedFormula));
  const fewerEvidence = DEMO_REPORT.kpis.map((k, i) => (i === 0 ? { ...k, evidence: k.evidence.slice(1) } : k));
  assert.notEqual(base, await computeEvidenceVersion(fewerEvidence));
});

test('rejection records a rejected state with a reason; revision returns it to draft', () => {
  const submitted = submit(DEMO_REPORT);
  const silent = transitionReport(submitted.report, { type: 'reject', approval: { ...reviewer, decision: 'rejected', at: '2026-09-02T09:00:00Z' } });
  assert.equal(silent.ok, false);
  const rejected = transitionReport(submitted.report, { type: 'reject', approval: { ...reviewer, decision: 'rejected', at: '2026-09-02T09:00:00Z', note: 'Downtime classification for WO-1004 is unverified.' } });
  assert.equal(rejected.ok, true);
  assert.equal(rejected.report.status, 'rejected');
  assert.equal(rejected.report.approval?.decision, 'rejected');
  assert.equal(rejected.audit.action, 'report.rejected');
  assert.deepEqual(reportReadiness(rejected.report).nextTransitions, ['revise']);
  const revised = transitionReport(rejected.report, { type: 'revise', actorId: 'engineer-1', at: '2026-09-03T08:00:00Z' });
  assert.equal(revised.report.status, 'draft');
});

test('a BLOCKED KPI blocks submission', () => {
  const blocked: ReportPackage = { ...DEMO_REPORT, kpis: DEMO_REPORT.kpis.map((kpi, index) => (index === 3 ? { ...kpi, decisionGrade: false, readiness: { state: 'BLOCKED', reasons: ['missing downtime'] } } : kpi)) };
  const result = submit(blocked);
  assert.equal(result.ok, false);
  assert.match(result.blockers.join(' '), /mttr is BLOCKED/);
});
