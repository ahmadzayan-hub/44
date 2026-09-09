import type { EvidenceRef } from '../agent-os/contracts.ts';
import type { ContractKpiSet } from '../connectors/contract/port.ts';
import type { MaximoWorkOrderRecord } from '../connectors/maximo/port.ts';
import type { ProvidedRecord, ProviderMode } from '../providers/contracts.ts';
import { assessReadiness, type ReadinessAssessment } from '../readiness/gate.ts';
import type { KpiObservation } from '../reporting/contracts.ts';
import { computeKpiObservation } from './engine.ts';

/**
 * Governed KPI computation: the readiness gate runs first, every observation
 * carries its readiness and evidence, and BLOCKED observations are marked not
 * decision-grade. This is the single path used by the Control Tower service,
 * the agents and the static data pack.
 */
export interface GovernedKpiInput {
  kpiSet: ProvidedRecord<ContractKpiSet> | null;
  workOrders: readonly ProvidedRecord<MaximoWorkOrderRecord>[];
  periodStart: string;
  periodEnd: string;
  asOf: string;
  mode: ProviderMode;
  /** Planned service minutes; defaults to the contract rule for the period. */
  plannedServiceMinutes?: number;
}

export interface GovernedKpiResult {
  readiness: ReadinessAssessment;
  observations: readonly KpiObservation[];
  evidence: readonly EvidenceRef[];
}

export function evidenceFrom(records: readonly ProvidedRecord<unknown>[]): EvidenceRef[] {
  return records.map((record) => ({
    sourceSystem: record.provenance.sourceSystem,
    entityType: record.provenance.sourceEntityType,
    entityId: record.provenance.sourceRecordId,
    observedAt: record.provenance.observedAt,
    sourceUri: record.provenance.sourceUri,
    snapshotHash: record.provenance.snapshotHash,
  }));
}

export function computeGovernedKpis(input: GovernedKpiInput): GovernedKpiResult {
  const readiness = assessReadiness({ workOrders: input.workOrders, kpiSet: input.kpiSet, periodStart: input.periodStart, periodEnd: input.periodEnd, asOf: input.asOf, mode: input.mode });
  const evidence: EvidenceRef[] = [...(input.kpiSet ? evidenceFrom([input.kpiSet]) : []), ...evidenceFrom(input.workOrders)];
  if (!input.kpiSet) return { readiness, observations: [], evidence };
  const usable = input.workOrders.filter((record) => record.provenance.qualityState !== 'rejected').map((record) => record.value);
  const planned = input.plannedServiceMinutes ?? input.kpiSet.value.plannedServiceMinutesPerPeriod(input.periodStart, input.periodEnd);
  const observations = input.kpiSet.value.definitions.map((definition) => {
    const observation = computeKpiObservation(definition, { periodStart: input.periodStart, periodEnd: input.periodEnd, plannedServiceMinutes: planned, workOrders: usable }, evidence);
    const gate = readiness.perKpi[definition.id] ?? { state: readiness.state, issues: readiness.issues };
    return { ...observation, readiness: { state: gate.state, reasons: gate.issues.map((issue) => issue.detail) }, decisionGrade: gate.state !== 'BLOCKED' };
  });
  return { readiness, observations, evidence };
}
