import type { KpiObservation, ReportException } from '../reporting/contracts.ts';

export interface ExceptionContext {
  contractId: string;
  priorBreachesByKpi?: Readonly<Record<string, number>>;
}

export function exceptionsFromKpis(
  observations: readonly KpiObservation[],
  context: ExceptionContext,
): readonly ReportException[] {
  return observations.flatMap((observation) => {
    if (observation.status !== 'breach' && observation.status !== 'watch') return [];
    const prior = context.priorBreachesByKpi?.[observation.definition.id] ?? 0;
    const severity: ReportException['severity'] =
      observation.status === 'breach' && prior >= 2 ? 'critical' : observation.status === 'breach' ? 'high' : 'watch';

    return [{
      id: `${context.contractId}:${observation.definition.id}:${observation.periodEnd}`,
      severity,
      title: `${observation.definition.name} ${observation.status === 'breach' ? 'breach' : 'watch'}`,
      whyItMatters: `${observation.definition.name} is ${observation.value} ${observation.definition.unit}; approved threshold is ${observation.definition.threshold ?? 'not set'} ${observation.definition.unit}.`,
      decisionRequired: severity === 'critical'
        ? 'Named contract/maintenance owner to review root cause and mitigation before report approval.'
        : 'Review cause, evidence and corrective action during the current reporting cycle.',
      evidence: observation.evidence,
    } satisfies ReportException];
  });
}
