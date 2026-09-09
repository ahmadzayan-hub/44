import type { AgentTask } from '../agent-os/contracts.ts';

/** Analysis scope carried in task.context. Handlers refuse tasks without a resolvable scope. */
export interface AnalysisScope {
  contractId: string;
  periodStart: string;
  periodEnd: string;
  /** Prior breach counts per KPI id from the previous approved periods. */
  priorBreachesByKpi?: Readonly<Record<string, number>>;
}

function stringField(context: Readonly<Record<string, unknown>> | undefined, key: string): string | undefined {
  const value = context?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

export function resolveScope(task: AgentTask, defaults: AnalysisScope): AnalysisScope {
  const context = task.context;
  const priorRaw = context?.priorBreachesByKpi;
  const prior = typeof priorRaw === 'object' && priorRaw !== null && !Array.isArray(priorRaw)
    ? Object.fromEntries(Object.entries(priorRaw as Record<string, unknown>).filter(([, v]) => typeof v === 'number').map(([k, v]) => [k, v as number]))
    : defaults.priorBreachesByKpi;
  const scope: AnalysisScope = {
    contractId: stringField(context, 'contractId') ?? defaults.contractId,
    periodStart: stringField(context, 'periodStart') ?? defaults.periodStart,
    periodEnd: stringField(context, 'periodEnd') ?? defaults.periodEnd,
    priorBreachesByKpi: prior,
  };
  if (Number.isNaN(Date.parse(scope.periodStart)) || Number.isNaN(Date.parse(scope.periodEnd)) || scope.periodStart >= scope.periodEnd) {
    throw new Error('Task scope requires a valid periodStart before periodEnd.');
  }
  return scope;
}
