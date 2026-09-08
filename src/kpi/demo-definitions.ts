import type { ExecutableKpiDefinition } from './engine.ts';

/**
 * DEMO ONLY. These are not RTA contractual formulas or thresholds.
 * A production deployment must replace them with approved, versioned contract definitions.
 */
export const DEMO_KPI_DEFINITIONS: readonly ExecutableKpiDefinition[] = [
  {
    id: 'availability',
    name: 'Availability',
    unit: '%',
    formulaVersion: 'demo-v1',
    formulaKind: 'availability_percent',
    threshold: 99.5,
    direction: 'higher_is_better',
  },
  {
    id: 'failures',
    name: 'Failures',
    unit: 'count',
    formulaVersion: 'demo-v1',
    formulaKind: 'failure_count',
    threshold: 4,
    direction: 'lower_is_better',
  },
  {
    id: 'mtbf',
    name: 'MTBF',
    unit: 'hours',
    formulaVersion: 'demo-v1',
    formulaKind: 'mtbf_hours',
    threshold: 120,
    direction: 'higher_is_better',
  },
  {
    id: 'mttr',
    name: 'MTTR',
    unit: 'hours',
    formulaVersion: 'demo-v1',
    formulaKind: 'mttr_hours',
    threshold: 2,
    direction: 'lower_is_better',
  },
  {
    id: 'backlog',
    name: 'Maintenance Backlog',
    unit: 'work orders',
    formulaVersion: 'demo-v1',
    formulaKind: 'backlog_count',
    threshold: 5,
    direction: 'lower_is_better',
  },
];
