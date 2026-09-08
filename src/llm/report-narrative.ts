import type { ModelGateway } from '../agent-os/contracts.ts';
import type { ReportPackage } from '../reporting/contracts.ts';

export async function draftGroundedReportNarrative(
  report: ReportPackage,
  model: ModelGateway,
): Promise<string> {
  const facts = report.kpis.map((kpi) => ({
    id: kpi.definition.id,
    name: kpi.definition.name,
    value: kpi.value,
    unit: kpi.definition.unit,
    threshold: kpi.definition.threshold,
    status: kpi.status,
    formulaVersion: kpi.definition.formulaVersion,
    evidence: kpi.evidence,
  }));
  const exceptions = report.exceptions.map((exception) => ({
    severity: exception.severity,
    title: exception.title,
    whyItMatters: exception.whyItMatters,
    decisionRequired: exception.decisionRequired,
  }));

  const result = await model.generate({
    temperature: 0,
    maxTokens: 800,
    messages: [
      {
        role: 'system',
        content: 'You are RailMind Reporting Agent. Use only supplied facts. Do not calculate new KPI values, invent causes, contractual clauses, dates or amounts. Clearly label any interpretation as interpretation. If evidence is insufficient, say so.',
      },
      {
        role: 'user',
        content: `Draft a concise management narrative for this approved report data:\n${JSON.stringify({ reportId: report.reportId, cadence: report.cadence, periodStart: report.periodStart, periodEnd: report.periodEnd, facts, exceptions })}`,
      },
    ],
  });
  return result.text;
}
