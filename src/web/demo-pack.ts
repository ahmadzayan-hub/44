import { ControlTowerService, type ControlTowerDto } from '../app/control-tower-service.ts';
import { DEMO_ASSETS, DEMO_CONDITION_PROFILES, DEMO_CONTRACT_KPI_SET, DEMO_PERIOD, DEMO_PM_RECORDS, DEMO_REPORT, DEMO_SCOPE, DEMO_WORK_ORDERS } from '../demo.ts';
import { createSyntheticProviders } from '../providers/synthetic.ts';
import { InMemoryReportStore } from '../reporting/store.ts';

/**
 * Static data pack for the browser preview when no API is reachable (pure
 * static hosting). It is the Control Tower DTO produced by the same
 * application service the API uses, generated at build time from the
 * synthetic provider. `npm run check:web-data` fails when the committed file
 * drifts from the service output.
 */
export type DemoPack = ControlTowerDto;

export const DEMO_PACK_GENERATED_AT = `${DEMO_PERIOD.end.slice(0, 10)}T23:59:59Z`;

export async function buildDemoPack(): Promise<DemoPack> {
  const providers = createSyntheticProviders({ assets: DEMO_ASSETS, workOrders: DEMO_WORK_ORDERS, preventiveMaintenance: DEMO_PM_RECORDS, conditionProfiles: DEMO_CONDITION_PROFILES, kpiSets: [DEMO_CONTRACT_KPI_SET] });
  const service = new ControlTowerService(providers, new InMemoryReportStore(), DEMO_REPORT, () => DEMO_PACK_GENERATED_AT);
  return service.build(DEMO_SCOPE);
}

/** Stable serialisation so regeneration is byte-identical for identical inputs. */
export function renderDemoPackModule(pack: DemoPack): string {
  return [
    '// GENERATED FILE. Do not edit by hand.',
    '// Source: src/web/demo-pack.ts via `npm run build:web-data`. Verified by `npm run check:web-data`.',
    '// Static fallback for hosting without the API. Produced by the Control Tower application service from the synthetic provider.',
    `export const DEMO_PACK = ${JSON.stringify(pack, null, 2)};`,
    '',
  ].join('\n');
}
