import type { CapabilityHandler } from '../agent-os/handlers.ts';
import { createDataQualityHandler } from './data-quality.ts';
import { createExceptionAnalysisHandler, createMaintenanceKpiHandler } from './maintenance-kpi.ts';
import { createExecutiveBriefingHandler, createReportingHandler } from './reporting.ts';
import type { AnalysisScope } from './scope.ts';

/** Executable handlers for the P0 capabilities. Catalog capabilities without a handler fail closed at run time. */
export function createStandardHandlers(defaults: AnalysisScope): readonly CapabilityHandler[] {
  return [
    createDataQualityHandler(defaults),
    createMaintenanceKpiHandler(defaults),
    createExceptionAnalysisHandler(defaults),
    createReportingHandler('monthly', defaults),
    createReportingHandler('quarterly', defaults),
    createReportingHandler('annual', defaults),
    createExecutiveBriefingHandler(defaults),
  ];
}

export * from './data-quality.ts';
export * from './maintenance-kpi.ts';
export * from './reporting.ts';
export * from './scope.ts';
