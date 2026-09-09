import type { EvidenceRef } from '../agent-os/contracts.ts';
import type { CapabilityContext, CapabilityHandler, CapabilityResult } from '../agent-os/handlers.ts';
import type { ContractReadInput, MaximoReadInput } from '../agent-os/standard-tools.ts';
import type { ContractKpiSet } from '../connectors/contract/port.ts';
import type { MaximoWorkOrderRecord } from '../connectors/maximo/port.ts';
import { exceptionsFromKpis } from '../exceptions/engine.ts';
import { computeGovernedKpis } from '../kpi/governed.ts';
import type { ProvidedRecord } from '../providers/contracts.ts';
import type { ReadinessAssessment } from '../readiness/gate.ts';
import type { KpiObservation, ReportException } from '../reporting/contracts.ts';
import { resolveScope, type AnalysisScope } from './scope.ts';

/**
 * Maintenance KPI Agent. Deterministic: reads approved definitions through
 * contract.read, reads work orders through maximo.read, and computes every KPI
 * with the versioned engine. No model is consulted for any number.
 */
export interface KpiEvidencePack {
  scope: AnalysisScope;
  definitionVersion: string;
  workOrders: readonly MaximoWorkOrderRecord[];
  evidence: readonly EvidenceRef[];
  observations: readonly KpiObservation[];
  readiness: ReadinessAssessment;
}

export async function gatherKpiEvidence(context: CapabilityContext, defaults: AnalysisScope): Promise<KpiEvidencePack> {
  const scope = resolveScope(context.task, defaults);
  const kpiSet = await context.tools.call<ContractReadInput, ContractKpiSet | null>('contract.read', { contractId: scope.contractId });
  if (!kpiSet) throw new Error(`No approved KPI definition set is available for contract ${scope.contractId}.`);
  const workOrders: MaximoWorkOrderRecord[] = [];
  for (const assetId of kpiSet.assetIds) {
    const rows = await context.tools.call<MaximoReadInput, readonly MaximoWorkOrderRecord[]>('maximo.read', { kind: 'workOrders', assetId, since: scope.periodStart });
    workOrders.push(...rows);
  }
  const asOf = context.now();
  const records: ProvidedRecord<MaximoWorkOrderRecord>[] = workOrders.map((wo) => ({ value: wo, provenance: { sourceSystem: 'maximo', sourceEntityType: 'work-order', sourceRecordId: wo.workOrderId, observedAt: wo.reportedAt ?? scope.periodEnd, ingestedAt: asOf, qualityState: wo.reportedAt ? 'verified' : 'provisional' } }));
  const kpiRecord: ProvidedRecord<ContractKpiSet> = { value: kpiSet, provenance: { sourceSystem: kpiSet.evidence.sourceSystem, sourceEntityType: kpiSet.evidence.entityType, sourceRecordId: kpiSet.evidence.entityId, observedAt: kpiSet.evidence.observedAt, ingestedAt: asOf, qualityState: 'verified' } };
  const governed = computeGovernedKpis({ kpiSet: kpiRecord, workOrders: records, periodStart: scope.periodStart, periodEnd: scope.periodEnd, asOf, mode: 'synthetic' });
  return { scope, definitionVersion: kpiSet.definitionVersion, workOrders, evidence: governed.evidence, observations: governed.observations, readiness: governed.readiness };
}

export interface MaintenanceKpiValue {
  contractId: string;
  periodStart: string;
  periodEnd: string;
  definitionVersion: string;
  kpis: readonly { id: string; name: string; value: number; unit: string; threshold: number | null; status: KpiObservation['status']; formulaVersion: string; readiness: 'READY' | 'PROVISIONAL' | 'BLOCKED'; decisionGrade: boolean }[];
  workOrderCount: number;
  readiness: ReadinessAssessment['state'];
}

export function createMaintenanceKpiHandler(defaults: AnalysisScope): CapabilityHandler<MaintenanceKpiValue> {
  return {
    capability: 'maintenance-kpi',
    async execute(context): Promise<CapabilityResult<MaintenanceKpiValue>> {
      const pack = await gatherKpiEvidence(context, defaults);
      return {
        value: {
          contractId: pack.scope.contractId,
          periodStart: pack.scope.periodStart,
          periodEnd: pack.scope.periodEnd,
          definitionVersion: pack.definitionVersion,
          kpis: pack.observations.map((o) => ({ id: o.definition.id, name: o.definition.name, value: o.value, unit: o.definition.unit, threshold: o.definition.threshold ?? null, status: o.status, formulaVersion: o.definition.formulaVersion, readiness: o.readiness?.state ?? 'READY', decisionGrade: o.decisionGrade ?? true })),
          workOrderCount: pack.workOrders.length,
          readiness: pack.readiness.state,
        },
        evidence: pack.evidence,
        assumptions: [
          `KPI definitions taken from set ${pack.definitionVersion} (${pack.readiness.issues.some((i) => i.code === 'demo_kpi_definition') ? 'DEMO ONLY, not contractually approved' : 'approved'}).`,
          `Data readiness: ${pack.readiness.state}. ${pack.readiness.issues.map((i) => i.detail).join(' ') || 'No data-quality issues.'}`,
          'Work orders outside the period or without a reported timestamp are excluded.',
        ],
      };
    },
  };
}

export interface ExceptionAnalysisValue {
  contractId: string;
  periodEnd: string;
  exceptions: readonly ReportException[];
}

export function createExceptionAnalysisHandler(defaults: AnalysisScope): CapabilityHandler<ExceptionAnalysisValue> {
  return {
    capability: 'exception-analysis',
    async execute(context): Promise<CapabilityResult<ExceptionAnalysisValue>> {
      const pack = await gatherKpiEvidence(context, defaults);
      const exceptions = exceptionsFromKpis(pack.observations.filter((o) => o.decisionGrade !== false), { contractId: pack.scope.contractId, priorBreachesByKpi: pack.scope.priorBreachesByKpi });
      return {
        value: { contractId: pack.scope.contractId, periodEnd: pack.scope.periodEnd, exceptions },
        evidence: pack.evidence,
        assumptions: [
          `Prior breach counts: ${JSON.stringify(pack.scope.priorBreachesByKpi ?? {})}. A breach with two or more prior breaches escalates to critical.`,
          `BLOCKED KPIs are excluded from exceptions. Data readiness: ${pack.readiness.state}.`,
        ],
      };
    },
  };
}
