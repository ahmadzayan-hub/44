import type { EvidenceRef } from './agent-os/contracts.ts';
import type { MaximoWorkOrderRecord } from './connectors/maximo/port.ts';
import { DEMO_KPI_DEFINITIONS } from './kpi/demo-definitions.ts';
import { computeKpiObservation } from './kpi/engine.ts';
import { buildReportPackage, deterministicExecutiveSummary } from './reporting/generator.ts';

const periodStart = '2026-08-01T00:00:00Z';
const periodEnd = '2026-08-31T23:59:59Z';

export const DEMO_WORK_ORDERS: readonly MaximoWorkOrderRecord[] = [
  { workOrderId: 'WO-1001', assetId: 'ATC-ZC-01', workType: 'CM', status: 'COMP', reportedAt: '2026-08-03T08:00:00Z', actualStartAt: '2026-08-03T08:20:00Z', completedAt: '2026-08-03T10:20:00Z', downtimeMinutes: 120, failureCode: 'COMM' },
  { workOrderId: 'WO-1002', assetId: 'ATC-ZC-02', workType: 'CM', status: 'COMP', reportedAt: '2026-08-10T10:00:00Z', actualStartAt: '2026-08-10T10:10:00Z', completedAt: '2026-08-10T13:10:00Z', downtimeMinutes: 180, failureCode: 'HW' },
  { workOrderId: 'WO-1003', assetId: 'ATC-ZC-02', workType: 'CM', status: 'COMP', reportedAt: '2026-08-17T09:00:00Z', actualStartAt: '2026-08-17T09:05:00Z', completedAt: '2026-08-17T11:35:00Z', downtimeMinutes: 150, failureCode: 'HW' },
  { workOrderId: 'WO-1004', assetId: 'TRAM-APS-03', workType: 'CM', status: 'INPRG', reportedAt: '2026-08-25T06:00:00Z', actualStartAt: '2026-08-25T06:30:00Z', downtimeMinutes: 210, failureCode: 'POWER' },
  { workOrderId: 'WO-1005', assetId: 'ATC-ZC-01', workType: 'PM', status: 'WAPPR', reportedAt: '2026-08-29T07:00:00Z', downtimeMinutes: 0 },
  { workOrderId: 'WO-1006', assetId: 'TRAM-APS-03', workType: 'PM', status: 'WAPPR', reportedAt: '2026-08-30T07:00:00Z', downtimeMinutes: 0 },
];

const evidence: readonly EvidenceRef[] = DEMO_WORK_ORDERS.map((wo) => ({
  sourceSystem: 'maximo',
  entityType: 'work-order',
  entityId: wo.workOrderId,
  observedAt: wo.reportedAt ?? periodEnd,
}));

const kpis = DEMO_KPI_DEFINITIONS.map((definition) => computeKpiObservation(definition, {
  periodStart,
  periodEnd,
  plannedServiceMinutes: 31 * 24 * 60,
  workOrders: DEMO_WORK_ORDERS,
}, evidence));

export const DEMO_REPORT = buildReportPackage({
  reportId: 'DEMO-2026-08',
  cadence: 'monthly',
  contractId: 'DEMO-CONTRACT',
  periodStart,
  periodEnd,
  kpis,
  priorBreachesByKpi: { mttr: 2 },
});

export const DEMO_SUMMARY = deterministicExecutiveSummary(DEMO_REPORT);
