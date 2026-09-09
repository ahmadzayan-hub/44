/**
 * Fidelity tests ported from the legacy RailMind repository
 * (tests/risk.test.ts and tests/maximo.test.ts). Same assertions, node:test.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { MAX_CONFIDENCE, assess, assessAll, assessmentConfidence, healthBand, pmOverdueRatio, riskBand, riskDrivers, riskScore, summarise } from '../src/asset-intelligence/risk.ts';
import { proposeWorkOrder } from '../src/asset-intelligence/proposal.ts';
import { LEGACY_SAMPLE_NETWORK } from '../src/asset-intelligence/sample-network.ts';
import type { AssetRiskInput } from '../src/asset-intelligence/types.ts';

function asset(over: Partial<AssetRiskInput> = {}): AssetRiskInput {
  return { id: 'TRK-001', name: 'Track section 001', assetClass: 'track', section: 'Line A', healthIndex: 90, healthIndex90dAgo: 90, failures12m: 0, daysSinceLastPm: 30, pmIntervalDays: 90, openWorkOrders: 0, serviceCritical: false, signals: [], ...over };
}

test('maps health and risk to bands at the documented thresholds', () => {
  assert.equal(healthBand(90), 'healthy'); assert.equal(healthBand(75), 'healthy'); assert.equal(healthBand(74), 'watch'); assert.equal(healthBand(55), 'watch'); assert.equal(healthBand(54), 'critical');
  assert.equal(riskBand(39), 'low'); assert.equal(riskBand(40), 'medium'); assert.equal(riskBand(69), 'medium'); assert.equal(riskBand(70), 'high');
});

test('pmOverdueRatio is zero inside the interval, grows past it, never divides by zero', () => {
  assert.equal(pmOverdueRatio(asset({ daysSinceLastPm: 30, pmIntervalDays: 90 })), 0);
  assert.equal(pmOverdueRatio(asset({ daysSinceLastPm: 180, pmIntervalDays: 90 })), 1);
  assert.equal(pmOverdueRatio(asset({ pmIntervalDays: 0, daysSinceLastPm: 500 })), 0);
});

test('drivers: none for a healthy asset; ranked and normalised otherwise; improved signals ignored', () => {
  assert.deepEqual(riskDrivers(asset()), []);
  const drivers = riskDrivers(asset({ healthIndex: 50, healthIndex90dAgo: 78, failures12m: 4, daysSinceLastPm: 200, pmIntervalDays: 90, signals: [{ name: 'Vibration', changePct: 40, weight: 1 }] }));
  assert.ok(drivers.length > 3);
  assert.ok(Math.abs(drivers.reduce((s, d) => s + d.contribution, 0) - 1) < 1e-5);
  for (let i = 1; i < drivers.length; i += 1) assert.ok(drivers[i - 1]!.contribution >= drivers[i]!.contribution);
  assert.deepEqual(riskDrivers(asset({ signals: [{ name: 'Temperature', changePct: -10, weight: 1 }] })), []);
});

test('risk score: low for healthy, high for degraded, consequence-weighted, bounded 0..100', () => {
  assert.ok(riskScore(asset()) < 40);
  assert.ok(riskScore(asset({ healthIndex: 40, failures12m: 5, daysSinceLastPm: 300, pmIntervalDays: 90 })) >= 70);
  assert.ok(riskScore(asset({ healthIndex: 60, failures12m: 2, serviceCritical: true })) > riskScore(asset({ healthIndex: 60, failures12m: 2, serviceCritical: false })));
  const extreme = asset({ healthIndex: 0, healthIndex90dAgo: 100, failures12m: 99, daysSinceLastPm: 9999, pmIntervalDays: 1, serviceCritical: true, signals: [{ name: 'X', changePct: 999, weight: 1 }] });
  assert.ok(riskScore(extreme) <= 100);
  assert.ok(riskScore(asset({ healthIndex: 100 })) >= 0);
});

test('confidence rises with evidence and never claims certainty', () => {
  assert.ok(assessmentConfidence(asset({ daysSinceLastPm: 0, signals: [] })) < 0.6);
  const rich = asset({ healthIndex: 60, healthIndex90dAgo: 80, failures12m: 2, signals: [{ name: 'a', changePct: 5, weight: 1 }, { name: 'b', changePct: 5, weight: 1 }, { name: 'c', changePct: 5, weight: 1 }] });
  assert.ok(assessmentConfidence(rich) <= MAX_CONFIDENCE);
  assert.ok(assessmentConfidence(rich) > 0.8);
  const everything = asset({ healthIndex: 10, healthIndex90dAgo: 95, failures12m: 9, daysSinceLastPm: 900, pmIntervalDays: 30, signals: [{ name: 'a', changePct: 90, weight: 1 }, { name: 'b', changePct: 90, weight: 1 }, { name: 'c', changePct: 90, weight: 1 }, { name: 'd', changePct: 90, weight: 1 }] });
  assert.equal(assessmentConfidence(everything), MAX_CONFIDENCE);
});

test('assess: monitoring for healthy, engineer review for every high-risk, shorter window when service-critical', () => {
  const healthy = assess(asset());
  assert.equal(healthy.riskBand, 'low'); assert.equal(healthy.recommendation.action, 'monitor'); assert.equal(healthy.recommendation.requiresEngineerReview, false);
  const high = assess(asset({ healthIndex: 35, failures12m: 5, daysSinceLastPm: 300, pmIntervalDays: 90 }));
  assert.equal(high.riskBand, 'high'); assert.equal(high.recommendation.requiresEngineerReview, true);
  const critical = assess(asset({ healthIndex: 30, failures12m: 4, serviceCritical: true }));
  const ordinary = assess(asset({ healthIndex: 30, failures12m: 4, serviceCritical: false }));
  assert.ok(critical.recommendation.withinHours < ordinary.recommendation.withinHours);
  assert.equal(assess(asset({ healthIndex: 40, failures12m: 4, daysSinceLastPm: 200, pmIntervalDays: 90 })).recommendation.action, 'replace_component');
  const overdue = assess(asset({ healthIndex: 70, daysSinceLastPm: 200, pmIntervalDays: 90 }));
  assert.equal(overdue.riskBand, 'medium'); assert.equal(overdue.recommendation.action, 'schedule_pm');
  const nonTrivial = assess(asset({ healthIndex: 45, failures12m: 3 }));
  assert.ok(nonTrivial.drivers.length > 0); assert.ok(nonTrivial.recommendation.drivers.length > 0);
  assert.equal(assess(asset({ healthIndex: 70, healthIndex90dAgo: 80 })).trend90d, -10);
  assert.equal(assess(asset({ healthIndex: 85, healthIndex90dAgo: 80 })).trend90d, 5);
});

test('assessAll orders worst first and summarise counts bands, high risk and the review queue', () => {
  const list = assessAll([asset({ id: 'a', name: 'A', healthIndex: 95 }), asset({ id: 'b', name: 'B', healthIndex: 30, failures12m: 5 }), asset({ id: 'c', name: 'C', healthIndex: 70 })]);
  assert.deepEqual(list.map((a) => a.asset.id), ['b', 'c', 'a']);
  const s = summarise(assessAll([asset({ id: 'a', healthIndex: 95 }), asset({ id: 'b', healthIndex: 60 }), asset({ id: 'c', healthIndex: 30, failures12m: 5, daysSinceLastPm: 300, pmIntervalDays: 90 })]));
  assert.deepEqual(s, { total: 3, healthy: 1, watch: 1, critical: 1, highRisk: 1, awaitingReview: 1, meanHealth: 62 });
  assert.equal(summarise([]).meanHealth, null);
});

test('legacy sample network reproduces the legacy ranking: EMU R24-017 and track A12 worst', () => {
  const ranked = assessAll(LEGACY_SAMPLE_NETWORK);
  assert.deepEqual(ranked.slice(0, 2).map((a) => a.asset.id), ['EMU-R24-017', 'TRK-SEC-A12']);
  assert.equal(ranked[0]?.riskBand, 'high');
  assert.equal(ranked[0]?.recommendation.requiresEngineerReview, true);
  assert.equal(ranked[ranked.length - 1]?.asset.id, 'PWR-SUB-11');
});

const highRisk = asset({ id: 'PTS-014', name: 'Points 014', assetClass: 'points', healthIndex: 32, healthIndex90dAgo: 70, failures12m: 5, daysSinceLastPm: 300, pmIntervalDays: 90, serviceCritical: true });
const review = { reviewerId: 'a.zaian', reviewerRole: 'Chief Engineer', decision: 'approved' as const, at: '2026-08-23T07:00:00.000Z' };

test('proposal gate: high risk needs a named, accepting engineer; low and medium do not', () => {
  const noReview = proposeWorkOrder(assess(highRisk));
  assert.equal(noReview.ok, false); if (!noReview.ok) assert.equal(noReview.reason, 'engineer_review_required');
  const anonymous = proposeWorkOrder(assess(highRisk), { ...review, reviewerId: '   ' });
  assert.equal(anonymous.ok, false); if (!anonymous.ok) assert.equal(anonymous.reason, 'reviewer_name_missing');
  const rejected = proposeWorkOrder(assess(highRisk), { ...review, decision: 'rejected' });
  assert.equal(rejected.ok, false); if (!rejected.ok) assert.equal(rejected.reason, 'review_rejected');
  const accepted = proposeWorkOrder(assess(highRisk), review);
  assert.equal(accepted.ok, true);
  if (accepted.ok) { assert.equal(accepted.proposal.priority, 1); assert.equal(accepted.proposal.assetId, 'PTS-014'); assert.ok(accepted.proposal.drivers.length > 0); assert.equal(accepted.proposal.submittedToMaximo, false); for (const d of accepted.proposal.drivers) { assert.ok(d.detail.length > 0); assert.ok(d.contribution > 0); } }
  const medium = proposeWorkOrder(assess(asset({ healthIndex: 70, daysSinceLastPm: 200 })));
  assert.equal(medium.ok, true); if (medium.ok) assert.equal(medium.proposal.priority, 2);
  const low = proposeWorkOrder(assess(asset()));
  assert.equal(low.ok, true); if (low.ok) assert.equal(low.proposal.priority, 3);
});
