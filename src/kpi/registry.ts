import type { ExecutableKpiDefinition } from './engine.ts';

/**
 * KPI authority registry.
 *
 * Every governed KPI definition is machine-readable, versioned, owned and
 * bounded in time. Production mode serves only approved definitions that are
 * effective for the requested period; demo definitions are explicitly
 * labelled DEMO ONLY and never approved.
 */
export type KpiApprovalStatus = 'approved' | 'draft' | 'unapproved' | 'demo_only' | 'superseded';

export interface GovernedKpiDefinition extends ExecutableKpiDefinition {
  authority: { contractId?: string; policyRef?: string; clauseRef?: string };
  effectiveFrom: string;
  effectiveTo?: string;
  includedEvents: readonly string[];
  excludedEvents: readonly string[];
  requiredSourceFields: readonly string[];
  dataQualityRequirements: readonly string[];
  evidenceRules: readonly string[];
  owner: string;
  reviewer: string;
  approvalStatus: KpiApprovalStatus;
  approvedAt?: string;
  approvedBy?: string;
}

export interface RegistryQuery {
  contractId: string;
  periodStart: string;
  periodEnd: string;
  mode: 'synthetic' | 'production';
}

export interface RegistryResolution {
  definitions: readonly GovernedKpiDefinition[];
  /** Definitions that exist but were refused, with the reason. */
  refused: readonly { id: string; formulaVersion: string; reason: string }[];
}

const REQUIRED_TEXT: readonly (keyof GovernedKpiDefinition)[] = ['id', 'name', 'unit', 'formulaVersion', 'effectiveFrom', 'owner', 'reviewer'];

export function validateDefinition(definition: GovernedKpiDefinition): readonly string[] {
  const problems: string[] = [];
  for (const key of REQUIRED_TEXT) {
    const value = definition[key];
    if (typeof value !== 'string' || value.trim().length === 0) problems.push(`${key} is required`);
  }
  if (Number.isNaN(Date.parse(definition.effectiveFrom))) problems.push('effectiveFrom must be a date');
  if (definition.effectiveTo !== undefined && (Number.isNaN(Date.parse(definition.effectiveTo)) || definition.effectiveTo <= definition.effectiveFrom)) problems.push('effectiveTo must be a date after effectiveFrom');
  if (definition.threshold !== undefined && definition.direction === undefined) problems.push('direction is required when a threshold is set');
  if (definition.requiredSourceFields.length === 0) problems.push('requiredSourceFields must not be empty');
  if (definition.evidenceRules.length === 0) problems.push('evidenceRules must not be empty');
  if (!definition.authority.contractId && !definition.authority.policyRef) problems.push('authority requires a contractId or policyRef');
  if (definition.approvalStatus === 'approved' && (!definition.approvedAt || !definition.approvedBy)) problems.push('approved definitions require approvedAt and approvedBy');
  if (definition.approvalStatus === 'approved' && definition.formulaVersion.toLowerCase().includes('demo')) problems.push('a demo formula version cannot be approved');
  return problems;
}

export class KpiRegistry {
  readonly #definitions = new Map<string, GovernedKpiDefinition>();

  register(definition: GovernedKpiDefinition): this {
    const problems = validateDefinition(definition);
    if (problems.length > 0) throw new Error(`Invalid KPI definition ${definition.id}@${definition.formulaVersion}: ${problems.join('; ')}`);
    const key = `${definition.authority.contractId ?? definition.authority.policyRef}:${definition.id}:${definition.formulaVersion}`;
    if (this.#definitions.has(key)) throw new Error(`Duplicate KPI definition ${key}`);
    this.#definitions.set(key, definition);
    return this;
  }

  all(): readonly GovernedKpiDefinition[] {
    return [...this.#definitions.values()];
  }

  /** Definitions effective for the whole period; production admits approved ones only. */
  resolve(query: RegistryQuery): RegistryResolution {
    const definitions: GovernedKpiDefinition[] = [];
    const refused: { id: string; formulaVersion: string; reason: string }[] = [];
    const byId = new Map<string, GovernedKpiDefinition[]>();
    for (const definition of this.#definitions.values()) {
      if (definition.authority.contractId !== query.contractId) continue;
      const list = byId.get(definition.id) ?? [];
      list.push(definition);
      byId.set(definition.id, list);
    }
    for (const [id, candidates] of byId) {
      const effective = candidates.filter((d) => d.effectiveFrom <= query.periodStart && (d.effectiveTo === undefined || d.effectiveTo >= query.periodEnd));
      if (effective.length === 0) { refused.push({ id, formulaVersion: candidates.map((c) => c.formulaVersion).join('|'), reason: 'no version is effective for the whole period' }); continue; }
      const admissible = effective.filter((d) => (query.mode === 'production' ? d.approvalStatus === 'approved' : d.approvalStatus !== 'superseded'));
      if (admissible.length === 0) { refused.push({ id, formulaVersion: effective.map((c) => c.formulaVersion).join('|'), reason: `no ${query.mode === 'production' ? 'approved' : 'admissible'} version for ${query.mode} mode (${effective.map((c) => c.approvalStatus).join(', ')})` }); continue; }
      if (admissible.length > 1) { refused.push({ id, formulaVersion: admissible.map((c) => c.formulaVersion).join('|'), reason: 'multiple versions effective for the same period; resolve the overlap' }); continue; }
      definitions.push(admissible[0]!);
    }
    return { definitions, refused };
  }
}
