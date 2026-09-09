/**
 * Asset intelligence domain, migrated from the legacy RailMind repository
 * (ahmadzayan-hub/RailMind, src/domain/types.ts). Field semantics are kept so
 * the ported tests prove behavioural fidelity. Sources of the inputs are now
 * ports: condition monitoring for health and signals, Maximo for failures,
 * PM and open work orders.
 */
export type AssetClass = 'track' | 'points' | 'signalling' | 'traction_power' | 'rolling_stock' | 'depot' | 'other';

/** Health band. Colour is derived from this, never the other way round. */
export type HealthBand = 'healthy' | 'watch' | 'critical';

export type RiskBand = 'low' | 'medium' | 'high';

export interface ConditionSignal {
  /** What was measured, in the engineer's language. */
  name: string;
  /** Percentage change against this asset's own baseline. */
  changePct: number;
  /** How much this signal contributes to the risk, 0..1. */
  weight: number;
}

/** Everything the risk engine needs for one asset, assembled from the ports. */
export interface AssetRiskInput {
  id: string;
  name: string;
  assetClass: AssetClass;
  /** Line or area the asset belongs to. */
  section: string;
  /** 0..100. Lower is worse. */
  healthIndex: number;
  /** Health index 90 days ago, for trend. */
  healthIndex90dAgo: number;
  /** Failures recorded in the last 12 months. */
  failures12m: number;
  /** Days since the last completed preventive maintenance. */
  daysSinceLastPm: number;
  /** Planned PM interval in days. */
  pmIntervalDays: number;
  /** Open Maximo work orders against this asset. */
  openWorkOrders: number;
  /** Does a failure here stop service? */
  serviceCritical: boolean;
  signals: readonly ConditionSignal[];
}

export interface RiskDriver {
  name: string;
  /** Share of the risk score this driver accounts for, 0..1. */
  contribution: number;
  detail: string;
}

export type ActionKind = 'inspect' | 'schedule_pm' | 'replace_component' | 'monitor';

export interface Recommendation {
  assetId: string;
  action: ActionKind;
  /** Plain instruction an engineer can act on. */
  summary: string;
  /** Hours until the action should start. */
  withinHours: number;
  /** Why: the ranked drivers behind it. */
  drivers: readonly RiskDriver[];
  /** 0..1 confidence in the risk assessment behind this action. */
  confidence: number;
  /** High-risk recommendations may not leave the system without a named engineer's review. */
  requiresEngineerReview: boolean;
}

export interface Assessment {
  asset: AssetRiskInput;
  healthBand: HealthBand;
  /** 0..100. Higher is worse. */
  riskScore: number;
  riskBand: RiskBand;
  /** Positive means health improved over 90 days. */
  trend90d: number;
  drivers: readonly RiskDriver[];
  recommendation: Recommendation;
}
