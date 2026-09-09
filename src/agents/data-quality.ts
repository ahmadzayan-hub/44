import type { EvidenceRef } from '../agent-os/contracts.ts';
import type { CapabilityHandler, CapabilityResult } from '../agent-os/handlers.ts';
import type { ContractReadInput, MaximoReadInput } from '../agent-os/standard-tools.ts';
import type { ContractKpiSet } from '../connectors/contract/port.ts';
import type { MaximoWorkOrderRecord } from '../connectors/maximo/port.ts';
import { resolveScope, type AnalysisScope } from './scope.ts';

/**
 * Data Quality Agent. Deterministic checks that must pass before a KPI or
 * report section is treated as more than provisional.
 */
export interface DataQualityFinding {
  code: 'missing_reported_at' | 'missing_downtime' | 'open_beyond_period' | 'duplicate_work_order' | 'completed_before_start' | 'stale_source';
  severity: 'watch' | 'high';
  workOrderId: string | null;
  detail: string;
}

export interface DataQualityValue {
  contractId: string;
  periodStart: string;
  periodEnd: string;
  recordsChecked: number;
  findings: readonly DataQualityFinding[];
  provisional: boolean;
}

export function assessWorkOrders(workOrders: readonly MaximoWorkOrderRecord[], periodEnd: string, asOf: string): readonly DataQualityFinding[] {
  const findings: DataQualityFinding[] = [];
  const seen = new Set<string>();
  let latest = '';
  for (const wo of workOrders) {
    if (seen.has(wo.workOrderId)) findings.push({ code: 'duplicate_work_order', severity: 'high', workOrderId: wo.workOrderId, detail: 'Work order id appears more than once in the source extract.' });
    seen.add(wo.workOrderId);
    if (!wo.reportedAt) findings.push({ code: 'missing_reported_at', severity: 'high', workOrderId: wo.workOrderId, detail: 'No reported timestamp; the record cannot be placed in a period.' });
    else if (wo.reportedAt > latest) latest = wo.reportedAt;
    const isFailure = wo.workType ? ['CM', 'CORRECTIVE', 'EM'].includes(wo.workType.toUpperCase()) : Boolean(wo.failureCode);
    if (isFailure && (wo.downtimeMinutes === undefined || wo.downtimeMinutes === null) && !(wo.actualStartAt && wo.completedAt)) {
      findings.push({ code: 'missing_downtime', severity: 'high', workOrderId: wo.workOrderId, detail: 'Failure work order has neither downtime minutes nor start and completion timestamps; availability and MTTR are provisional.' });
    }
    if (wo.actualStartAt && wo.completedAt && wo.completedAt < wo.actualStartAt) findings.push({ code: 'completed_before_start', severity: 'high', workOrderId: wo.workOrderId, detail: 'Completion precedes actual start.' });
    const closed = ['COMP', 'CLOSE', 'CAN'].includes(wo.status.toUpperCase());
    if (!closed && wo.reportedAt && wo.reportedAt <= periodEnd && asOf > periodEnd) findings.push({ code: 'open_beyond_period', severity: 'watch', workOrderId: wo.workOrderId, detail: 'Still open after period end; repair time may change on closure.' });
  }
  if (workOrders.length > 0 && latest && Date.parse(asOf) - Date.parse(latest) > 45 * 24 * 60 * 60 * 1000) {
    findings.push({ code: 'stale_source', severity: 'watch', workOrderId: null, detail: `Latest source record is dated ${latest}; extract may be stale relative to ${asOf}.` });
  }
  return findings;
}

export function createDataQualityHandler(defaults: AnalysisScope): CapabilityHandler<DataQualityValue> {
  return {
    capability: 'data-quality',
    async execute(context): Promise<CapabilityResult<DataQualityValue>> {
      const scope = resolveScope(context.task, defaults);
      const kpiSet = await context.tools.call<ContractReadInput, ContractKpiSet | null>('contract.read', { contractId: scope.contractId });
      if (!kpiSet) throw new Error(`No approved KPI definition set is available for contract ${scope.contractId}.`);
      const workOrders: MaximoWorkOrderRecord[] = [];
      for (const assetId of kpiSet.assetIds) {
        workOrders.push(...await context.tools.call<MaximoReadInput, readonly MaximoWorkOrderRecord[]>('maximo.read', { kind: 'workOrders', assetId, since: scope.periodStart }));
      }
      const findings = assessWorkOrders(workOrders, scope.periodEnd, context.now());
      const evidence: EvidenceRef[] = [kpiSet.evidence, ...workOrders.map((wo) => ({ sourceSystem: 'maximo' as const, entityType: 'work-order', entityId: wo.workOrderId, observedAt: wo.reportedAt ?? scope.periodEnd }))];
      return {
        value: { contractId: scope.contractId, periodStart: scope.periodStart, periodEnd: scope.periodEnd, recordsChecked: workOrders.length, findings, provisional: findings.some((f) => f.severity === 'high') },
        evidence,
        assumptions: ['Checks cover the work-order extract only; asset master, PM and finance records are not yet assessed.'],
      };
    },
  };
}
