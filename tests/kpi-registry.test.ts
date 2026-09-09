import test from 'node:test';
import assert from 'node:assert/strict';

import { DEMO_KPI_DEFINITIONS } from '../src/kpi/demo-definitions.ts';
import { KpiRegistry, validateDefinition, type GovernedKpiDefinition } from '../src/kpi/registry.ts';

const approved = (over: Partial<GovernedKpiDefinition> = {}): GovernedKpiDefinition => ({
  id: 'availability', name: 'Availability', unit: '%', formulaVersion: 'c17-v2', formulaKind: 'availability_percent', threshold: 99.5, direction: 'higher_is_better',
  authority: { contractId: 'C-17', clauseRef: 'Schedule 4 §2.1' }, effectiveFrom: '2026-01-01T00:00:00Z',
  includedEvents: ['CM'], excludedEvents: ['PM'], requiredSourceFields: ['workOrderId', 'reportedAt', 'downtimeMinutes'], dataQualityRequirements: ['no duplicates'], evidenceRules: ['work orders by id'],
  owner: 'contract.manager', reviewer: 'reliability.lead', approvalStatus: 'approved', approvedAt: '2025-12-15T00:00:00Z', approvedBy: 'steering.committee', ...over,
});

test('demo definitions are complete, governed and labelled DEMO ONLY', () => {
  for (const definition of DEMO_KPI_DEFINITIONS) {
    assert.deepEqual(validateDefinition(definition), [], definition.id);
    assert.equal(definition.approvalStatus, 'demo_only');
    assert.ok(definition.owner.includes('synthetic'));
    assert.ok(definition.requiredSourceFields.length > 0);
  }
});

test('validation rejects incomplete or contradictory definitions', () => {
  assert.ok(validateDefinition(approved({ owner: ' ' })).includes('owner is required'));
  assert.ok(validateDefinition(approved({ effectiveTo: '2025-01-01T00:00:00Z' })).some((p) => p.includes('effectiveTo')));
  assert.ok(validateDefinition(approved({ approvedAt: undefined })).some((p) => p.includes('approvedAt')));
  assert.ok(validateDefinition(approved({ formulaVersion: 'demo-v9' })).some((p) => p.includes('demo formula')));
  assert.ok(validateDefinition(approved({ evidenceRules: [] })).some((p) => p.includes('evidenceRules')));
  assert.ok(validateDefinition(approved({ authority: {} })).some((p) => p.includes('authority')));
  assert.throws(() => new KpiRegistry().register(approved({ reviewer: '' })), /Invalid KPI definition/);
  assert.throws(() => new KpiRegistry().register(approved()).register(approved()), /Duplicate/);
});

test('production resolves approved, effective definitions only; demo definitions are refused', () => {
  const registry = new KpiRegistry();
  registry.register(approved());
  registry.register(approved({ id: 'mttr', name: 'MTTR', unit: 'hours', formulaKind: 'mttr_hours', threshold: 2, direction: 'lower_is_better', approvalStatus: 'draft', approvedAt: undefined, approvedBy: undefined }));
  for (const definition of DEMO_KPI_DEFINITIONS) registry.register({ ...definition, authority: { contractId: 'C-17', clauseRef: definition.authority.clauseRef } });
  const query = { contractId: 'C-17', periodStart: '2026-08-01T00:00:00Z', periodEnd: '2026-08-31T23:59:59Z' };
  const production = registry.resolve({ ...query, mode: 'production' });
  assert.deepEqual(production.definitions.map((d) => `${d.id}@${d.formulaVersion}`), ['availability@c17-v2']);
  assert.ok(production.refused.some((r) => r.id === 'mttr' && /draft/.test(r.reason)));
  assert.ok(production.refused.some((r) => r.id === 'backlog' && /demo_only/.test(r.reason)));
  const demo = registry.resolve({ ...query, mode: 'synthetic' });
  assert.ok(demo.definitions.some((d) => d.id === 'backlog'));
});

test('validity windows and version changes are enforced per period', () => {
  const registry = new KpiRegistry();
  registry.register(approved({ formulaVersion: 'c17-v1', effectiveFrom: '2025-01-01T00:00:00Z', effectiveTo: '2026-06-30T23:59:59Z', approvalStatus: 'superseded' }));
  registry.register(approved({ formulaVersion: 'c17-v2', effectiveFrom: '2026-07-01T00:00:00Z' }));
  const august = registry.resolve({ contractId: 'C-17', periodStart: '2026-08-01T00:00:00Z', periodEnd: '2026-08-31T23:59:59Z', mode: 'production' });
  assert.equal(august.definitions[0]?.formulaVersion, 'c17-v2');
  const straddling = registry.resolve({ contractId: 'C-17', periodStart: '2026-06-15T00:00:00Z', periodEnd: '2026-07-15T00:00:00Z', mode: 'production' });
  assert.equal(straddling.definitions.length, 0);
  assert.match(straddling.refused[0]?.reason ?? '', /effective for the whole period/);
  registry.register(approved({ formulaVersion: 'c17-v3', effectiveFrom: '2026-07-01T00:00:00Z' }));
  const overlap = registry.resolve({ contractId: 'C-17', periodStart: '2026-08-01T00:00:00Z', periodEnd: '2026-08-31T23:59:59Z', mode: 'production' });
  assert.match(overlap.refused[0]?.reason ?? '', /multiple versions/);
});
