import { AGENT_CATALOG } from '../agent-os/catalog.ts';
import type { EvidenceRef } from '../agent-os/contracts.ts';
import type { MaximoWorkOrderRecord } from '../connectors/maximo/port.ts';
import { toControlTowerViewModel, type ControlTowerViewModel } from '../control-tower/view-model.ts';
import { DEMO_REPORT, DEMO_SUMMARY, DEMO_WORK_ORDERS, DEMO_PERIOD } from '../demo.ts';
import { DEMO_KPI_DEFINITIONS } from '../kpi/demo-definitions.ts';
import { computeKpiObservation } from '../kpi/engine.ts';
import { reportReadiness, type ReportReadiness } from '../reporting/approval.ts';
import type { KpiObservation, ReportException, ReportPackage } from '../reporting/contracts.ts';

/**
 * Browser data pack for the static Control Tower preview.
 *
 * The preview has no bundler and no runtime dependency, so it cannot execute
 * the TypeScript engine directly. Instead this module projects the engine's
 * deterministic outputs into a plain JSON structure. `scripts/build-web-data.mjs`
 * writes it to `web/data/demo-pack.js` and `scripts/check-web-data.mjs` fails
 * verification when the committed file drifts from the engine.
 *
 * Every number shown in the preview must originate here. Presentation-only
 * text (bilingual labels, routing defaults) stays in the browser layer.
 */
export interface PackEvidence {
  sourceSystem: EvidenceRef['sourceSystem'];
  entityType: string;
  entityId: string;
  observedAt: string;
}

export interface PackKpi {
  id: string;
  name: string;
  unit: string;
  value: number;
  threshold: number | null;
  direction: 'higher_is_better' | 'lower_is_better' | 'target' | null;
  formulaVersion: string;
  status: KpiObservation['status'];
  exceptionId: string | null;
  severity: ReportException['severity'] | null;
  evidence: readonly PackEvidence[];
}

export interface PackException {
  id: string;
  kpiId: string;
  severity: ReportException['severity'];
  title: string;
  whyItMatters: string;
  decisionRequired: string | null;
  evidence: readonly PackEvidence[];
}

export interface PackAsset {
  assetId: string;
  openWorkOrders: number;
  failureWorkOrders: number;
  downtimeMinutes: number;
  lastReportedAt: string | null;
}

export interface PackTimelineSnapshot {
  asOf: string;
  trigger: string;
  workOrdersSeen: number;
  kpis: readonly { id: string; value: number; status: KpiObservation['status'] }[];
}

export interface PackWorkOrder {
  workOrderId: string;
  assetId: string;
  workType: string | null;
  status: string;
  reportedAt: string | null;
  completedAt: string | null;
  downtimeMinutes: number;
  failureCode: string | null;
}

export interface DemoPack {
  provenance: {
    dataModule: string;
    engineModule: string;
    formulaVersion: string;
    synthetic: true;
  };
  report: {
    reportId: string;
    cadence: ReportPackage['cadence'];
    contractId: string;
    periodStart: string;
    periodEnd: string;
    status: ReportPackage['status'];
  };
  summary: string;
  controlTower: ControlTowerViewModel;
  approvalGate: ReportReadiness;
  kpis: readonly PackKpi[];
  exceptions: readonly PackException[];
  assets: readonly PackAsset[];
  workOrders: readonly PackWorkOrder[];
  timeline: readonly PackTimelineSnapshot[];
  agents: readonly { id: string; name: string; mayUseModel: boolean; allowedActionModes: readonly string[] }[];
}

const CLOSED_STATUSES = new Set(['COMP', 'CLOSE', 'CAN']);
const FAILURE_TYPES = new Set(['CM', 'CORRECTIVE', 'EM']);

function packEvidence(refs: readonly EvidenceRef[]): readonly PackEvidence[] {
  return refs.map((ref) => ({
    sourceSystem: ref.sourceSystem,
    entityType: ref.entityType,
    entityId: ref.entityId,
    observedAt: ref.observedAt,
  }));
}

function kpiIdOf(exception: ReportException, report: ReportPackage): string {
  const found = report.kpis.find((kpi) => exception.id === `${report.contractId}:${kpi.definition.id}:${kpi.periodEnd}`);
  return found?.definition.id ?? 'unknown';
}

function assetsFrom(workOrders: readonly MaximoWorkOrderRecord[]): readonly PackAsset[] {
  const byAsset = new Map<string, PackAsset>();
  for (const wo of workOrders) {
    const current = byAsset.get(wo.assetId) ?? { assetId: wo.assetId, openWorkOrders: 0, failureWorkOrders: 0, downtimeMinutes: 0, lastReportedAt: null };
    const isFailure = wo.workType ? FAILURE_TYPES.has(wo.workType.toUpperCase()) : Boolean(wo.failureCode);
    const open = !CLOSED_STATUSES.has(wo.status.toUpperCase());
    const reportedAt = wo.reportedAt ?? null;
    byAsset.set(wo.assetId, {
      assetId: wo.assetId,
      openWorkOrders: current.openWorkOrders + (open ? 1 : 0),
      failureWorkOrders: current.failureWorkOrders + (isFailure ? 1 : 0),
      downtimeMinutes: current.downtimeMinutes + (isFailure ? (wo.downtimeMinutes ?? 0) : 0),
      lastReportedAt: reportedAt && (!current.lastReportedAt || reportedAt > current.lastReportedAt) ? reportedAt : current.lastReportedAt,
    });
  }
  return [...byAsset.values()].sort((a, b) => a.assetId.localeCompare(b.assetId));
}

/**
 * Period-to-date replay. Each snapshot recomputes every KPI with the engine
 * using only the work orders reported up to that instant and the service
 * minutes elapsed so far. The final snapshot equals the month-end report.
 */
function timelineFrom(workOrders: readonly MaximoWorkOrderRecord[], periodStart: string, periodEnd: string): readonly PackTimelineSnapshot[] {
  const ordered = [...workOrders].filter((wo) => wo.reportedAt).sort((a, b) => (a.reportedAt ?? '').localeCompare(b.reportedAt ?? ''));
  const points: { asOf: string; trigger: string }[] = ordered.map((wo) => ({ asOf: wo.reportedAt ?? periodStart, trigger: wo.workOrderId }));
  points.push({ asOf: periodEnd, trigger: 'PERIOD-CLOSE' });

  return points.map((point) => {
    const seen = workOrders.filter((wo) => wo.reportedAt && wo.reportedAt <= point.asOf);
    const elapsedMinutes = Math.max(1, Math.round((Date.parse(point.asOf) - Date.parse(periodStart)) / 60_000));
    const kpis = DEMO_KPI_DEFINITIONS.map((definition) => {
      const observation = computeKpiObservation(definition, {
        periodStart,
        periodEnd: point.asOf,
        plannedServiceMinutes: elapsedMinutes,
        workOrders: seen,
      }, []);
      return { id: definition.id, value: observation.value, status: observation.status };
    });
    return { asOf: point.asOf, trigger: point.trigger, workOrdersSeen: seen.length, kpis };
  });
}

export function buildDemoPack(): DemoPack {
  const report = DEMO_REPORT;
  const severityRank: Readonly<Record<ReportException['severity'], number>> = { critical: 0, high: 1, watch: 2 };
  const exceptions: PackException[] = report.exceptions
    .map((exception) => ({
      id: exception.id,
      kpiId: kpiIdOf(exception, report),
      severity: exception.severity,
      title: exception.title,
      whyItMatters: exception.whyItMatters,
      decisionRequired: exception.decisionRequired ?? null,
      evidence: packEvidence(exception.evidence),
    }))
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.id.localeCompare(b.id));

  const kpis: PackKpi[] = report.kpis.map((kpi) => {
    const exception = exceptions.find((item) => item.kpiId === kpi.definition.id) ?? null;
    return {
      id: kpi.definition.id,
      name: kpi.definition.name,
      unit: kpi.definition.unit,
      value: kpi.value,
      threshold: kpi.definition.threshold ?? null,
      direction: kpi.definition.direction ?? null,
      formulaVersion: kpi.definition.formulaVersion,
      status: kpi.status,
      exceptionId: exception?.id ?? null,
      severity: exception?.severity ?? null,
      evidence: packEvidence(kpi.evidence),
    };
  });

  return {
    provenance: {
      dataModule: 'src/demo.ts',
      engineModule: 'src/kpi/engine.ts',
      formulaVersion: DEMO_KPI_DEFINITIONS[0]?.formulaVersion ?? 'unknown',
      synthetic: true,
    },
    report: {
      reportId: report.reportId,
      cadence: report.cadence,
      contractId: report.contractId,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      status: report.status,
    },
    summary: DEMO_SUMMARY,
    controlTower: toControlTowerViewModel(report),
    approvalGate: reportReadiness(report),
    kpis,
    exceptions,
    assets: assetsFrom(DEMO_WORK_ORDERS),
    workOrders: DEMO_WORK_ORDERS.map((wo) => ({
      workOrderId: wo.workOrderId,
      assetId: wo.assetId,
      workType: wo.workType ?? null,
      status: wo.status,
      reportedAt: wo.reportedAt ?? null,
      completedAt: wo.completedAt ?? null,
      downtimeMinutes: wo.downtimeMinutes ?? 0,
      failureCode: wo.failureCode ?? null,
    })),
    timeline: timelineFrom(DEMO_WORK_ORDERS, DEMO_PERIOD.start, DEMO_PERIOD.end),
    agents: AGENT_CATALOG.map((agent) => ({
      id: agent.id,
      name: agent.name,
      mayUseModel: agent.mayUseModel,
      allowedActionModes: agent.allowedActionModes,
    })),
  };
}

/** Stable serialisation so regeneration is byte-identical for identical inputs. */
export function renderDemoPackModule(pack: DemoPack = buildDemoPack()): string {
  return [
    '// GENERATED FILE. Do not edit by hand.',
    '// Source: src/web/demo-pack.ts via `npm run build:web-data`. Verified by `npm run check:web-data`.',
    '// Every number here is produced by the deterministic engine in src/. Synthetic demo data only.',
    `export const DEMO_PACK = ${JSON.stringify(pack, null, 2)};`,
    '',
  ].join('\n');
}
