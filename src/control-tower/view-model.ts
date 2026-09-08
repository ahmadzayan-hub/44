import type { ReportPackage } from '../reporting/contracts.ts';

export interface ControlTowerViewModel {
  reportId: string;
  status: ReportPackage['status'];
  kpiCount: number;
  withinTarget: number;
  watch: number;
  breach: number;
  criticalExceptions: number;
  highExceptions: number;
  attentionRequired: number;
}

export function toControlTowerViewModel(report: ReportPackage): ControlTowerViewModel {
  const withinTarget = report.kpis.filter((kpi) => kpi.status === 'within_target').length;
  const watch = report.kpis.filter((kpi) => kpi.status === 'watch').length;
  const breach = report.kpis.filter((kpi) => kpi.status === 'breach').length;
  const criticalExceptions = report.exceptions.filter((item) => item.severity === 'critical').length;
  const highExceptions = report.exceptions.filter((item) => item.severity === 'high').length;
  return {
    reportId: report.reportId,
    status: report.status,
    kpiCount: report.kpis.length,
    withinTarget,
    watch,
    breach,
    criticalExceptions,
    highExceptions,
    attentionRequired: report.exceptions.length,
  };
}
