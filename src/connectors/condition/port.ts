import type { EvidenceRef } from '../../agent-os/contracts.ts';
import type { ConditionSignal } from '../../asset-intelligence/types.ts';

/**
 * Condition-monitoring port. Health index and condition signals come from
 * condition systems (or inspections); RailMind reads them and never writes.
 */
export interface AssetConditionProfile {
  assetId: string;
  /** 0..100. Lower is worse. */
  healthIndex: number;
  healthIndex90dAgo: number;
  signals: readonly ConditionSignal[];
  serviceCritical: boolean;
  section: string;
  observedAt: string;
  evidence: EvidenceRef;
}

export interface ConditionReadPort {
  getProfile(assetId: string): Promise<AssetConditionProfile | null>;
  listAssetIds(): Promise<readonly string[]>;
}

export class InMemoryConditionReadPort implements ConditionReadPort {
  readonly #profiles: Map<string, AssetConditionProfile>;

  constructor(profiles: readonly AssetConditionProfile[]) {
    this.#profiles = new Map(profiles.map((profile) => [profile.assetId, profile]));
  }

  async getProfile(assetId: string): Promise<AssetConditionProfile | null> {
    return this.#profiles.get(assetId) ?? null;
  }

  async listAssetIds(): Promise<readonly string[]> {
    return [...this.#profiles.keys()];
  }
}
