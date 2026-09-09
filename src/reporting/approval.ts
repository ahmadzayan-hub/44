import type { HumanApproval } from '../agent-os/contracts.ts';
import { hasDecisionGradeEvidence } from '../agent-os/policy.ts';
import type { AuditEventInput } from '../audit/log.ts';
import type { ReportPackage, ReportStatus } from './contracts.ts';

/**
 * Report approval state machine.
 *
 *   draft -> under_review -> approved -> locked
 *             |  reject
 *             v
 *           draft
 *
 * Transitions are pure: they return a new package plus the audit event that
 * records the outcome. A refused transition never mutates the package.
 */
export type ReportTransition =
  | { type: 'submit_for_review'; actorId: string; actorRole?: string; at: string }
  | { type: 'approve'; approval: HumanApproval }
  | { type: 'reject'; approval: HumanApproval }
  | { type: 'lock'; actorId: string; actorRole?: string; at: string };

export interface ReportTransitionResult {
  ok: boolean;
  report: ReportPackage;
  blockers: readonly string[];
  audit: AuditEventInput;
}

export interface ReportReadiness {
  status: ReportStatus;
  nextTransitions: readonly ReportTransition['type'][];
  blockers: readonly string[];
}

const NEXT: Readonly<Record<ReportStatus, readonly ReportTransition['type'][]>> = {
  draft: ['submit_for_review'],
  under_review: ['approve', 'reject'],
  approved: ['lock'],
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
    const grounded = hasDecisionGradeEvidence({
      taskId: report.reportId,
      agentId: 'reporting',
      value: kpi.value,
      evidence: kpi.evidence,
      assumptions: [],
      generatedAt: report.periodEnd,
    });
    if (!grounded) blockers.push(`KPI ${kpi.definition.id} has no decision-grade evidence.`);
    if (!kpi.definition.formulaVersion.trim()) blockers.push(`KPI ${kpi.definition.id} has no formula version.`);
  }
  return blockers;
}

function approvalBlockers(report: ReportPackage, approval: HumanApproval): readonly string[] {
  const blockers = [...namedReview(approval)];
  if (approval.decision !== 'approved') blockers.push('Approval decision must be "approved".');
  const critical = report.exceptions.filter((exception) => exception.severity === 'critical');
  if (critical.length > 0 && !(approval.note && approval.note.trim().length > 0)) {
    blockers.push(`${critical.length} critical exception(s) require an approval note recording the reviewed mitigation.`);
  }
  return blockers;
}

function lockBlockers(report: ReportPackage, at: string): readonly string[] {
  const blockers: string[] = [];
  if (!validDate(at)) blockers.push('Lock timestamp is invalid.');
  else if (Date.parse(at) < Date.parse(report.periodEnd)) blockers.push('A report cannot be locked before its period has ended.');
  if (!report.approval || report.approval.decision !== 'approved') blockers.push('Lock requires a recorded approval.');
  return blockers;
}

export function reportReadiness(report: ReportPackage): ReportReadiness {
  const next = NEXT[report.status];
  let blockers: readonly string[] = [];
  if (report.status === 'draft') blockers = submissionBlockers(report);
  if (report.status === 'approved') blockers = lockBlockers(report, report.periodEnd);
  return { status: report.status, nextTransitions: next, blockers };
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

export function transitionReport(report: ReportPackage, transition: ReportTransition): ReportTransitionResult {
  if (!NEXT[report.status].includes(transition.type)) {
    return refused(report, transition, [`${transition.type} is not allowed from state ${report.status}.`]);
  }

  switch (transition.type) {
    case 'submit_for_review': {
      const blockers = [...submissionBlockers(report)];
      if (!transition.actorId.trim()) blockers.push('Submitting actor is required.');
      if (!validDate(transition.at)) blockers.push('Submission timestamp is invalid.');
      if (blockers.length > 0) return refused(report, transition, blockers);
      const next: ReportPackage = { ...report, status: 'under_review', reviewRequestedAt: transition.at, approval: undefined };
      return {
        ok: true,
        report: next,
        blockers: [],
        audit: {
          action: 'report.submitted_for_review',
          actorId: transition.actorId,
          actorRole: transition.actorRole,
          subjectType: 'report',
          subjectId: report.reportId,
          at: transition.at,
          fromState: 'draft',
          toState: 'under_review',
          evidence: report.kpis.flatMap((kpi) => kpi.evidence),
        },
      };
    }
    case 'approve': {
      const blockers = approvalBlockers(report, transition.approval);
      if (blockers.length > 0) return refused(report, transition, blockers);
      const next: ReportPackage = { ...report, status: 'approved', approval: transition.approval };
      return {
        ok: true,
        report: next,
        blockers: [],
        audit: {
          action: 'report.approved',
          actorId: transition.approval.reviewerId,
          actorRole: transition.approval.reviewerRole,
          subjectType: 'report',
          subjectId: report.reportId,
          at: transition.approval.at,
          fromState: 'under_review',
          toState: 'approved',
          reason: transition.approval.note,
        },
      };
    }
    case 'reject': {
      const blockers = [...namedReview(transition.approval)];
      if (transition.approval.decision !== 'rejected') blockers.push('Rejection decision must be "rejected".');
      if (!(transition.approval.note && transition.approval.note.trim().length > 0)) blockers.push('Rejection requires a reason note.');
      if (blockers.length > 0) return refused(report, transition, blockers);
      const next: ReportPackage = { ...report, status: 'draft', approval: transition.approval, reviewRequestedAt: undefined };
      return {
        ok: true,
        report: next,
        blockers: [],
        audit: {
          action: 'report.rejected',
          actorId: transition.approval.reviewerId,
          actorRole: transition.approval.reviewerRole,
          subjectType: 'report',
          subjectId: report.reportId,
          at: transition.approval.at,
          fromState: 'under_review',
          toState: 'draft',
          reason: transition.approval.note,
        },
      };
    }
    case 'lock': {
      const blockers = [...lockBlockers(report, transition.at)];
      if (!transition.actorId.trim()) blockers.push('Locking actor is required.');
      if (blockers.length > 0) return refused(report, transition, blockers);
      const next: ReportPackage = { ...report, status: 'locked', lockedAt: transition.at };
      return {
        ok: true,
        report: next,
        blockers: [],
        audit: {
          action: 'report.locked',
          actorId: transition.actorId,
          actorRole: transition.actorRole,
          subjectType: 'report',
          subjectId: report.reportId,
          at: transition.at,
          fromState: 'approved',
          toState: 'locked',
        },
      };
    }
  }
}
