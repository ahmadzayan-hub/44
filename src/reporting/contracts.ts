import type { EvidenceRef } from '../agent-os/contracts.js';

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
  status: 'draft' | 'under_review' | 'approved' | 'locked';
}
