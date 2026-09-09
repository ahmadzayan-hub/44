import type { KpiObservation, ReportCadence, ReportPackage } from './contracts.ts';
import { exceptionsFromKpis } from '../exceptions/engine.ts';

export interface ReportBuildInput {
  reportId: string;
  cadence: ReportCadence;
  contractId: string;
  periodStart: string;
  periodEnd: string;
  kpis: readonly KpiObservation[];
  priorBreachesByKpi?: Readonly<Record<string, number>>;
}

export function buildReportPackage(input: ReportBuildInput): ReportPackage {
  const exceptions = exceptionsFromKpis(input.kpis, {
    contractId: input.contractId,
    priorBreachesByKpi: input.priorBreachesByKpi,
  });
  return {
    reportId: input.reportId,
    cadence: input.cadence,
    contractId: input.contractId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    kpis: input.kpis,
    exceptions,
    status: 'draft',
  };
}

export function deterministicExecutiveSummary(report: ReportPackage): string {
  const breaches = report.kpis.filter((kpi) => kpi.status === 'breach');
  const critical = report.exceptions.filter((exception) => exception.severity === 'critical');
  const high = report.exceptions.filter((exception) => exception.severity === 'high');
  const healthy = report.kpis.filter((kpi) => kpi.status === 'within_target');
  const blocked = report.kpis.filter((kpi) => kpi.decisionGrade === false);
  const provisional = report.kpis.filter((kpi) => kpi.decisionGrade !== false && kpi.readiness?.state === 'PROVISIONAL');
  return [
    `${report.cadence[0]?.toUpperCase() ?? ''}${report.cadence.slice(1)} report ${report.reportId}.`,
    `${healthy.length}/${report.kpis.length} KPIs are within target.`,
    `${breaches.length} KPI breach(es); ${critical.length} critical and ${high.length} high exception(s).`,
    ...(blocked.length ? [`${blocked.length} KPI(s) BLOCKED by the data-quality gate: ${blocked.map((kpi) => kpi.definition.id).join(', ')}.`] : []),
    ...(provisional.length ? [`${provisional.length} KPI(s) provisional: ${[...new Set(provisional.flatMap((kpi) => kpi.readiness?.reasons ?? []))].join(' ')}`] : []),
    'This summary is deterministic and contains no LLM-generated facts.',
  ].join(' ');
}
