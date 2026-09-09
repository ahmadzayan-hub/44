import type { EvidenceRef, HumanApproval } from '../agent-os/contracts.ts';
import type { CapabilityContext, CapabilityHandler, CapabilityResult } from '../agent-os/handlers.ts';
import type { ConditionReadInput, MaximoReadInput } from '../agent-os/standard-tools.ts';
import { proposeWorkOrder, type WorkOrderProposal } from '../asset-intelligence/proposal.ts';
import { RISK_ENGINE_VERSION, assessAll, summarise, type NetworkSummary } from '../asset-intelligence/risk.ts';
import type { AssetClass, AssetRiskInput, Assessment } from '../asset-intelligence/types.ts';
import type { AssetConditionProfile } from '../connectors/condition/port.ts';
import type { MaximoAssetRecord, MaximoPmRecord, MaximoWorkOrderRecord } from '../connectors/maximo/port.ts';

/**
 * Asset Intelligence Agent, migrated from the legacy RailMind product.
 *
 * Inputs are assembled from ports, never typed in: condition.read supplies the
 * health index and signals, maximo.read supplies assets, 12-month failures, open
 * work orders and PM status. The legacy engine then scores deterministically.
 */
const CLOSED = new Set(['COMP', 'CLOSE', 'CAN']);
const FAILURE_TYPES = new Set(['CM', 'CORRECTIVE', 'EM']);

function classOf(assetClass: string | undefined): AssetClass {
  const value = (assetClass ?? '').toLowerCase();
  if (value.includes('track')) return 'track';
  if (value.includes('point') || value.includes('switch')) return 'points';
  if (value.includes('signal') || value.includes('atc') || value.includes('interlock')) return 'signalling';
  if (value.includes('traction') || value.includes('power') || value.includes('aps')) return 'traction_power';
  if (value.includes('rolling') || value.includes('emu') || value.includes('train')) return 'rolling_stock';
  if (value.includes('depot')) return 'depot';
  return 'other';
}

function daysBetween(from: string, to: string): number {
  return Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000));
}

function pmIntervalDays(pm: MaximoPmRecord): number {
  const frequency = pm.frequency ?? 0;
  const unit = (pm.frequencyUnit ?? 'DAYS').toUpperCase();
  if (unit.startsWith('WEEK')) return frequency * 7;
  if (unit.startsWith('MONTH')) return frequency * 30;
  if (unit.startsWith('YEAR')) return frequency * 365;
  return frequency;
}

export interface AssembledAsset {
  input: AssetRiskInput;
  evidence: readonly EvidenceRef[];
}

/** Builds the engine input for one asset from the ports through the scoped tool invoker. */
export async function assembleAsset(context: CapabilityContext, assetId: string, asOf: string): Promise<AssembledAsset | null> {
  const profile = await context.tools.call<ConditionReadInput, AssetConditionProfile | null>('condition.read', { kind: 'profile', assetId });
  const asset = await context.tools.call<MaximoReadInput, MaximoAssetRecord | null>('maximo.read', { kind: 'asset', assetId });
  if (!profile || !asset) return null;
  const since = new Date(Date.parse(asOf) - 365 * 86_400_000).toISOString();
  const workOrders = await context.tools.call<MaximoReadInput, readonly MaximoWorkOrderRecord[]>('maximo.read', { kind: 'workOrders', assetId, since });
  const pms = await context.tools.call<MaximoReadInput, readonly MaximoPmRecord[]>('maximo.read', { kind: 'preventiveMaintenance', assetId });
  const failures12m = workOrders.filter((wo) => (wo.workType ? FAILURE_TYPES.has(wo.workType.toUpperCase()) : Boolean(wo.failureCode))).length;
  const openWorkOrders = workOrders.filter((wo) => !CLOSED.has(wo.status.toUpperCase())).length;
  const pm = pms[0];
  const evidence: EvidenceRef[] = [
    profile.evidence,
    { sourceSystem: 'maximo', entityType: 'asset', entityId: asset.assetId, observedAt: asOf },
    ...workOrders.map((wo) => ({ sourceSystem: 'maximo' as const, entityType: 'work-order', entityId: wo.workOrderId, observedAt: wo.reportedAt ?? asOf })),
    ...pms.map((record) => ({ sourceSystem: 'maximo' as const, entityType: 'pm', entityId: record.pmId, observedAt: record.lastCompletedAt ?? asOf })),
  ];
  return {
    input: {
      id: asset.assetId,
      name: asset.name,
      assetClass: classOf(asset.assetClass),
      section: profile.section,
      healthIndex: profile.healthIndex,
      healthIndex90dAgo: profile.healthIndex90dAgo,
      failures12m,
      daysSinceLastPm: pm?.lastCompletedAt ? daysBetween(pm.lastCompletedAt, asOf) : 0,
      pmIntervalDays: pm ? pmIntervalDays(pm) : 0,
      openWorkOrders,
      serviceCritical: profile.serviceCritical || (asset.criticality ?? '').toLowerCase() === 'safety_critical',
      signals: profile.signals,
    },
    evidence,
  };
}

async function assembleScope(context: CapabilityContext): Promise<{ assessments: Assessment[]; evidence: EvidenceRef[]; asOf: string; skipped: string[] }> {
  const asOf = context.now();
  const requested = context.task.context?.assetIds;
  const assetIds = Array.isArray(requested) && requested.every((id) => typeof id === 'string')
    ? requested as string[]
    : await context.tools.call<ConditionReadInput, readonly string[]>('condition.read', { kind: 'assetIds' });
  const inputs: AssetRiskInput[] = [];
  const evidence: EvidenceRef[] = [];
  const skipped: string[] = [];
  for (const assetId of assetIds) {
    const assembled = await assembleAsset(context, assetId, asOf);
    if (!assembled) { skipped.push(assetId); continue; }
    inputs.push(assembled.input);
    evidence.push(...assembled.evidence);
  }
  return { assessments: assessAll(inputs), evidence, asOf, skipped };
}

const ASSUMPTIONS = [
  `Scoring weights and thresholds are the legacy demo values (${RISK_ENGINE_VERSION}); they are not calibrated against RTA outcomes.`,
  'Failures in the last 12 months and open work orders are derived from the Maximo work-order extract; PM status from the first PM record per asset.',
];

export interface AssetHealthValue {
  asOf: string;
  engineVersion: string;
  summary: NetworkSummary;
  assets: readonly { id: string; name: string; section: string; healthIndex: number; healthBand: Assessment['healthBand']; trend90d: number; riskScore: number; riskBand: Assessment['riskBand']; openWorkOrders: number }[];
  skipped: readonly string[];
}

export function createAssetHealthHandler(): CapabilityHandler<AssetHealthValue> {
  return {
    capability: 'asset-health',
    async execute(context): Promise<CapabilityResult<AssetHealthValue>> {
      const scope = await assembleScope(context);
      return {
        value: {
          asOf: scope.asOf,
          engineVersion: RISK_ENGINE_VERSION,
          summary: summarise(scope.assessments),
          assets: scope.assessments.map((a) => ({ id: a.asset.id, name: a.asset.name, section: a.asset.section, healthIndex: a.asset.healthIndex, healthBand: a.healthBand, trend90d: a.trend90d, riskScore: a.riskScore, riskBand: a.riskBand, openWorkOrders: a.asset.openWorkOrders })),
          skipped: scope.skipped,
        },
        evidence: scope.evidence,
        assumptions: [...ASSUMPTIONS, ...(scope.skipped.length ? [`Skipped assets without a condition profile or Maximo record: ${scope.skipped.join(', ')}.`] : [])],
      };
    },
  };
}

export interface FailureRiskValue {
  asOf: string;
  engineVersion: string;
  assessments: readonly { assetId: string; name: string; riskScore: number; riskBand: Assessment['riskBand']; confidence: number; drivers: Assessment['drivers']; recommendation: Assessment['recommendation'] }[];
}

export function createFailureRiskHandler(): CapabilityHandler<FailureRiskValue> {
  return {
    capability: 'failure-risk',
    async execute(context): Promise<CapabilityResult<FailureRiskValue>> {
      const scope = await assembleScope(context);
      return {
        value: {
          asOf: scope.asOf,
          engineVersion: RISK_ENGINE_VERSION,
          assessments: scope.assessments.map((a) => ({ assetId: a.asset.id, name: a.asset.name, riskScore: a.riskScore, riskBand: a.riskBand, confidence: a.recommendation.confidence, drivers: a.drivers, recommendation: a.recommendation })),
        },
        evidence: scope.evidence,
        assumptions: [...ASSUMPTIONS, 'Every high-risk recommendation requires named engineer review before it leaves the system.'],
      };
    },
  };
}

export interface MaintenancePriorityValue {
  asOf: string;
  mode: 'analyse' | 'propose_write';
  ranked: readonly { assetId: string; name: string; riskScore: number; riskBand: Assessment['riskBand']; action: Assessment['recommendation']['action']; withinHours: number; requiresEngineerReview: boolean }[];
  /** Present only in propose_write mode: proposals that a named engineer must accept in Maximo. */
  proposals: readonly (WorkOrderProposal | { assetId: string; blocked: 'engineer_review_required' | 'reviewer_name_missing' | 'review_rejected' })[];
}

/**
 * Maintenance priority. In analyse mode it ranks and recommends. In
 * propose_write mode it also drafts work-order proposals; high-risk proposals
 * are produced only with the named review carried in task.context.review, and
 * the P0 policy still requires named approval before any proposal is released.
 */
export function createMaintenancePriorityHandler(): CapabilityHandler<MaintenancePriorityValue> {
  return {
    capability: 'maintenance-priority',
    async execute(context): Promise<CapabilityResult<MaintenancePriorityValue>> {
      const scope = await assembleScope(context);
      const mode = context.task.actionMode === 'propose_write' ? 'propose_write' : 'analyse';
      const reviewRaw = context.task.context?.review;
      const review = typeof reviewRaw === 'object' && reviewRaw !== null ? reviewRaw as HumanApproval : undefined;
      const proposals: MaintenancePriorityValue['proposals'] = mode === 'propose_write'
        ? scope.assessments.map((assessment) => { const outcome = proposeWorkOrder(assessment, review); return outcome.ok ? outcome.proposal : { assetId: assessment.asset.id, blocked: outcome.reason }; })
        : [];
      return {
        value: {
          asOf: scope.asOf,
          mode,
          ranked: scope.assessments.map((a) => ({ assetId: a.asset.id, name: a.asset.name, riskScore: a.riskScore, riskBand: a.riskBand, action: a.recommendation.action, withinHours: a.recommendation.withinHours, requiresEngineerReview: a.recommendation.requiresEngineerReview })),
          proposals,
        },
        evidence: scope.evidence,
        assumptions: [...ASSUMPTIONS, 'Proposals are never submitted to Maximo by RailMind; a named engineer submits them after approval.'],
      };
    },
  };
}
