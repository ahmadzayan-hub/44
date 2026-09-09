import type { EvidenceRef, HumanApproval } from '../agent-os/contracts.ts';

export type ReportCadence = 'monthly' | 'quarterly' | 'annual';

export interface KpiDefinition {
  id: string;
  name: string;
  unit: string;
  formulaVersion: string;
  threshold?: number;
  direction?: 'higher_is_better' | 'lower_is_better' | 'target';
  contractClauseRef?: string;
}

export interface KpiObservation {
  definition: KpiDefinition;
  periodStart: string;
  periodEnd: string;
  value: number;
  status: 'within_target' | 'watch' | 'breach' | 'not_applicable';
  evidence: readonly EvidenceRef[];
  /** Readiness from the data-quality gate. Absent means not evaluated (legacy callers). */
  readiness?: { state: 'READY' | 'PROVISIONAL' | 'BLOCKED'; reasons: readonly string[] };
  /** True only when readiness is READY or PROVISIONAL; BLOCKED observations are never decision-grade. */
  decisionGrade?: boolean;
}

export interface ReportException {
  id: string;
  severity: 'watch' | 'high' | 'critical';
  title: string;
  whyItMatters: string;
  decisionRequired?: string;
  evidence: readonly EvidenceRef[];
}

export interface ReportPackage {
  reportId: string;
  cadence: ReportCadence;
  contractId: string;
  periodStart: string;
  periodEnd: string;
  kpis: readonly KpiObservation[];
  exceptions: readonly ReportException[];
  /** AI may draft narrative only after KPI observations have been approved. */
  narrativeDraft?: string;
  status: ReportStatus;
  /** Set when the package is submitted for named review. */
  reviewRequestedAt?: string;
  /** Named human decision recorded at approval or rejection, bound to the evidence it was given for. */
  approval?: ReportApproval;
  /** Set when the approved package is locked for the period. */
  lockedAt?: string;
  /** Fingerprint of the KPI values, formula versions and evidence the package currently carries. */
  evidenceVersion?: string;
  /** Why and when the package was superseded; the package then needs revision. */
  supersession?: { at: string; reason: string; previousEvidenceVersion: string; actorId: string };
}

export interface ReportApproval extends HumanApproval {
  /** Evidence version the reviewer saw when deciding. */
  evidenceVersion: string;
  /** KPI id to formula version at decision time. */
  formulaVersions: Readonly<Record<string, string>>;
}

export type ReportStatus = 'draft' | 'under_review' | 'approved' | 'rejected' | 'superseded' | 'locked';
