import type { ReportPackage } from './contracts.ts';

/** RailMind-owned report state. Source systems are never written. */
export interface ReportStore {
  get(reportId: string): Promise<ReportPackage | null>;
  save(report: ReportPackage): Promise<void>;
  list(): Promise<readonly ReportPackage[]>;
}

export class InMemoryReportStore implements ReportStore {
  readonly #reports = new Map<string, ReportPackage>();

  async get(reportId: string): Promise<ReportPackage | null> {
    return this.#reports.get(reportId) ?? null;
  }

  async save(report: ReportPackage): Promise<void> {
    this.#reports.set(report.reportId, report);
  }

  async list(): Promise<readonly ReportPackage[]> {
    return [...this.#reports.values()];
  }
}
