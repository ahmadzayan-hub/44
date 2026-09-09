import type { EvidenceRef } from '../../agent-os/contracts.ts';
import type { ExecutableKpiDefinition } from '../../kpi/engine.ts';

/**
 * Contract context port. Approved contract documents remain authoritative;
 * RailMind reads KPI definitions, reporting duties and evidence rules from an
 * approved repository and never redefines them.
 */
export interface ContractKpiSet {
  contractId: string;
  /** Version of the approved definition set, e.g. a document revision. */
  definitionVersion: string;
  definitions: readonly ExecutableKpiDefinition[];
  /** Planned service minutes per reporting period, as defined by the contract. */
  plannedServiceMinutesPerPeriod: (periodStart: string, periodEnd: string) => number;
  /** In-scope asset ids for KPI calculation. */
  assetIds: readonly string[];
  evidence: EvidenceRef;
}

export interface ContractReadPort {
  getKpiSet(contractId: string): Promise<ContractKpiSet | null>;
}

export class InMemoryContractReadPort implements ContractReadPort {
  readonly #sets: Map<string, ContractKpiSet>;

  constructor(sets: readonly ContractKpiSet[]) {
    this.#sets = new Map(sets.map((set) => [set.contractId, set]));
  }

  async getKpiSet(contractId: string): Promise<ContractKpiSet | null> {
    return this.#sets.get(contractId) ?? null;
  }
}
