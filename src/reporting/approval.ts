import type { HumanApproval } from '../agent-os/contracts.ts';
import { hasDecisionGradeEvidence } from '../agent-os/policy.ts';
import type { AuditEventInput } from '../audit/log.ts';
import type { ReportApproval, ReportPackage, ReportStatus } from './contracts.ts';
import { formulaVersionsOf } from './evidence-version.ts';

/**
 * Report approval state machine.
 *
 *   draft -> under_review -> approved -> locked
 *     ^          |   \           \
 *     |       reject  supersede   supersede
 *     |          v       v           v
 *   revise <- rejected  superseded  superseded
 *
 * Transitions are pure: they return a new package plus the audit event that
 * records the outcome. A refused transition never mutates the package.
 * Approval is bound to an evidence version; when the evidence changes the
 * package is superseded and must be revised and reviewed again.
 */
export type ReportTransition =
  | { type: 'submit_for_review'; actorId: string; actorRole?: string; at: string; evidenceVersion: string }
  | { type: 'approve'; approval: HumanApproval; evidenceVersion: string }
  | { type: 'reject'; approval: HumanApproval }
  | { type: 'lock'; actorId: string; actorRole?: string; at: string }
  | { type: 'supersede'; actorId: string; actorRole?: string; at: string; reason: string; newEvidenceVersion: string }
  | { type: 'revise'; actorId: string; actorRole?: string; at: string };

export type TransitionType = ReportTransition['type'];

export interface ReportTransitionResult {
  ok: boolean;
  report: ReportPackage;
  blockers: readonly string[];
  audit: AuditEventInput;
}

export interface ReportReadiness {
  status: ReportStatus;
  nextTransitions: readonly TransitionType[];
  blockers: readonly string[];
  /** Present when an approval exists; false when the evidence has moved on. */
  approvalValid?: boolean;
}

const NEXT: Readonly<Record<ReportStatus, readonly TransitionType[]>> = {
  draft: ['submit_for_review'],
  under_review: ['approve', 'reject', 'supersede'],
  approved: ['lock', 'supersede'],
  rejected: ['revise'],
  superseded: ['revise'],
  locked: [],
};

function validDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function namedReview(review: HumanApproval): readonly string[] {
  const blockers: string[] = [];
  if (review.reviewerId.trim().length === 0) blockers.push('Reviewer id is required.');
  if (review.reviewerRole.trim().length === 0) blockers.push('Reviewer role is required.');
  if (!validDate(review.at)) blockers.push('Review timestamp is invalid.');
  return blockers;
}

/** Evidence and data-quality gate applied before a package may leave draft. */
export function submissionBlockers(report: ReportPackage): readonly string[] {
  const blockers: string[] = [];
  if (report.kpis.length === 0) blockers.push('Report contains no KPI observations.');
  for (const kpi of report.kpis) {
    const grounded = hasDecisionGradeEvidence({ taskId: report.reportId, agentId: 'reporting', value: kpi.value, evidence: kpi.evidence, assumptions: [], generatedAt: report.periodEnd });
    if (!grounded) blockers.push(`KPI ${kpi.definition.id} has no decision-grade evidence.`);
    if (!kpi.definition.formulaVersion.trim()) blockers.push(`KPI ${kpi.definition.id} has no formula version.`);
    if (kpi.decisionGrade === false) blockers.push(`KPI ${kpi.definition.id} is BLOCKED by the data-quality gate.`);
  }
  return blockers;
}

function approvalBlockers(report: ReportPackage, approval: HumanApproval, evidenceVersion: string): readonly string[] {
  const blockers = [...namedReview(approval)];
  if (approval.decision !== 'approved') blockers.push('Approval decision must be "approved".');
  const critical = report.exceptions.filter((exception) => exception.severity === 'critical');
  if (critical.length > 0 && !(approval.note && approval.note.trim().length > 0)) {
    blockers.push(`${critical.length} critical exception(s) require an approval note recording the reviewed mitigation.`);
  }
  if (report.evidenceVersion && evidenceVersion !== report.evidenceVersion) blockers.push('Evidence has changed since submission; the package must be superseded and reviewed again.');
  return blockers;
}

function lockBlockers(report: ReportPackage, at: string): readonly string[] {
  const blockers: string[] = [];
  if (!validDate(at)) blockers.push('Lock timestamp is invalid.');
  else if (Date.parse(at) < Date.parse(report.periodEnd)) blockers.push('A report cannot be locked before its period has ended.');
  if (!report.approval || report.approval.decision !== 'approved') blockers.push('Lock requires a recorded approval.');
  if (report.approval && report.evidenceVersion && report.approval.evidenceVersion !== report.evidenceVersion) blockers.push('The approval does not match the current evidence version.');
  return blockers;
}

export function reportReadiness(report: ReportPackage, currentEvidenceVersion?: string): ReportReadiness {
  const next = NEXT[report.status];
  let blockers: readonly string[] = [];
  if (report.status === 'draft') blockers = submissionBlockers(report);
  if (report.status === 'approved') blockers = lockBlockers(report, report.periodEnd);
  const approvalValid = report.approval && report.approval.decision === 'approved'
    ? report.approval.evidenceVersion === (currentEvidenceVersion ?? report.evidenceVersion ?? report.approval.evidenceVersion)
    : undefined;
  return { status: report.status, nextTransitions: next, blockers, approvalValid };
}

/** True when the stored package's approval or review no longer describes the current evidence. */
export function approvalInvalidated(report: ReportPackage, currentEvidenceVersion: string): boolean {
  if (report.status !== 'approved' && report.status !== 'under_review') return false;
  const baseline = report.status === 'approved' ? report.approval?.evidenceVersion : report.evidenceVersion;
  return baseline !== undefined && baseline !== currentEvidenceVersion;
}

function actorOf(transition: ReportTransition): { actorId: string; actorRole?: string; at: string } {
  if (transition.type === 'approve' || transition.type === 'reject') {
    return { actorId: transition.approval.reviewerId, actorRole: transition.approval.reviewerRole, at: transition.approval.at };
  }
  return { actorId: transition.actorId, actorRole: transition.actorRole, at: transition.at };
}

function refused(report: ReportPackage, transition: ReportTransition, blockers: readonly string[]): ReportTransitionResult {
  const actor = actorOf(transition);
  return {
    ok: false,
    report,
    blockers,
    audit: {
      action: 'report.transition_refused',
      actorId: actor.actorId || 'unknown',
      actorRole: actor.actorRole,
      subjectType: 'report',
      subjectId: report.reportId,
      at: validDate(actor.at) ? actor.at : new Date(0).toISOString(),
      fromState: report.status,
      reason: `${transition.type}: ${blockers.join(' ')}`,
    },
  };
}

function accepted(report: ReportPackage, next: ReportPackage, transition: ReportTransition, action: AuditEventInput['action'], reason?: string, evidence?: AuditEventInput['evidence']): ReportTransitionResult {
  const actor = actorOf(transition);
  return {
    ok: true,
    report: next,
    blockers: [],
    audit: { action, actorId: actor.actorId, actorRole: actor.actorRole, subjectType: 'report', subjectId: report.reportId, at: actor.at, fromState: report.status, toState: next.status, reason, evidence },
  };
}

export function transitionReport(report: ReportPackage, transition: ReportTransition): ReportTransitionResult {
  if (!NEXT[report.status].includes(transition.type)) {
    return refused(report, transition, [`${transition.type} is not allowed from state ${report.status}.`]);
  }

  switch (transition.type) {
    case 'submit_for_review': {
      const blockers = [...submissionBlockers(report)];
      if (!transition.actorId.trim()) blockers.push('Submitting actor is required.');
      if (!validDate(transition.at)) blockers.push('Submission timestamp is invalid.');
      if (!transition.evidenceVersion) blockers.push('Submission requires the evidence version of the package.');
      if (blockers.length > 0) return refused(report, transition, blockers);
      return accepted(report, { ...report, status: 'under_review', reviewRequestedAt: transition.at, approval: undefined, evidenceVersion: transition.evidenceVersion, supersession: undefined }, transition, 'report.submitted_for_review', `evidence ${transition.evidenceVersion.slice(0, 12)}`, report.kpis.flatMap((kpi) => kpi.evidence));
    }
    case 'approve': {
      const blockers = approvalBlockers(report, transition.approval, transition.evidenceVersion);
      if (blockers.length > 0) return refused(report, transition, blockers);
      const approval: ReportApproval = { ...transition.approval, evidenceVersion: transition.evidenceVersion, formulaVersions: formulaVersionsOf(report.kpis) };
      return accepted(report, { ...report, status: 'approved', approval }, transition, 'report.approved', `${transition.approval.note ?? ''} evidence ${transition.evidenceVersion.slice(0, 12)}`.trim());
    }
    case 'reject': {
      const blockers = [...namedReview(transition.approval)];
      if (transition.approval.decision !== 'rejected') blockers.push('Rejection decision must be "rejected".');
      if (!(transition.approval.note && transition.approval.note.trim().length > 0)) blockers.push('Rejection requires a reason note.');
      if (blockers.length > 0) return refused(report, transition, blockers);
      const approval: ReportApproval = { ...transition.approval, evidenceVersion: report.evidenceVersion ?? '', formulaVersions: formulaVersionsOf(report.kpis) };
      return accepted(report, { ...report, status: 'rejected', approval }, transition, 'report.rejected', transition.approval.note);
    }
    case 'lock': {
      const blockers = [...lockBlockers(report, transition.at)];
      if (!transition.actorId.trim()) blockers.push('Locking actor is required.');
      if (blockers.length > 0) return refused(report, transition, blockers);
      return accepted(report, { ...report, status: 'locked', lockedAt: transition.at }, transition, 'report.locked');
    }
    case 'supersede': {
      const blockers: string[] = [];
      if (!transition.actorId.trim()) blockers.push('Superseding actor is required.');
      if (!transition.reason.trim()) blockers.push('Supersession requires a reason.');
      if (!validDate(transition.at)) blockers.push('Supersession timestamp is invalid.');
      if (blockers.length > 0) return refused(report, transition, blockers);
      const supersession = { at: transition.at, reason: transition.reason, previousEvidenceVersion: report.evidenceVersion ?? '', actorId: transition.actorId };
      return accepted(report, { ...report, status: 'superseded', supersession, evidenceVersion: transition.newEvidenceVersion }, transition, 'report.superseded', transition.reason);
    }
    case 'revise': {
      const blockers: string[] = [];
      if (!transition.actorId.trim()) blockers.push('Revising actor is required.');
      if (!validDate(transition.at)) blockers.push('Revision timestamp is invalid.');
      if (blockers.length > 0) return refused(report, transition, blockers);
      return accepted(report, { ...report, status: 'draft', reviewRequestedAt: undefined, approval: undefined, lockedAt: undefined }, transition, 'report.revised');
    }
  }
}
