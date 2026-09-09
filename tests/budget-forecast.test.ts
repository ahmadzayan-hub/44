import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPaceDistribution,
  forecastInitiative,
  type BudgetForecastInput,
} from '../src/forecast/budget-forecast.ts';

const awarded = 'Awarded / Delivery Party Identified' as const;
const notAwarded = 'Not Awarded' as const;

function input(overrides: Partial<BudgetForecastInput> = {}): BudgetForecastInput {
  return {
    initiativeId: 'I-01',
    portfolio: 'Capital',
    businessArea: 'Business Area-01',
    awardStatus: awarded,
    totalEstimatedCost: 100,
    recordedExpenditure: 20,
    approvedBudget: 30,
    executionStart: '2026-01-01',
    executionEnd: '2026-12-31',
    ...overrides,
  };
}

test('builds deterministic pace distribution from eligible observed expenditure', () => {
  const distribution = buildPaceDistribution([
    input({ initiativeId: 'A', recordedExpenditure: 20 }),
    input({ initiativeId: 'B', recordedExpenditure: 40 }),
    input({ initiativeId: 'C', recordedExpenditure: 0 }),
    input({ initiativeId: 'D', awardStatus: notAwarded, recordedExpenditure: 80 }),
  ], '2026-06-30');

  assert.equal(distribution.sampleSize, 2);
  assert.ok(distribution.p25 > 0);
  assert.ok(distribution.p25 <= distribution.p50);
  assert.ok(distribution.p50 <= distribution.p75);
});

test('forecasts cumulative expenditure at the scenario pace and never below actual spend', () => {
  const distribution = { sampleSize: 3, p25: 0.4, p50: 0.6, p75: 0.9 };
  const result = forecastInitiative(
    input({ recordedExpenditure: 20 }),
    distribution,
    '2026-06-30',
    '2026-12-31',
  );

  assert.equal(result.eligible, true);
  assert.equal(result.scenarios.length, 3);
  assert.equal(result.scenarios[1]?.label, 'P50');
  assert.equal(result.scenarios[1]?.projectedCumulativeExpenditure, 60);
  assert.equal(result.scenarios[1]?.additionalExpenditure, 40);
});

test('does not forecast unawarded or completed initiatives', () => {
  const distribution = { sampleSize: 3, p25: 0.4, p50: 0.6, p75: 0.9 };
  const unawarded = forecastInitiative(
    input({ awardStatus: notAwarded }),
    distribution,
    '2026-06-30',
    '2026-12-31',
  );
  const completed = forecastInitiative(
    input({ executionEnd: '2026-05-31' }),
    distribution,
    '2026-06-30',
    '2026-12-31',
  );

  assert.equal(unawarded.eligible, false);
  assert.equal(unawarded.scenarios.length, 0);
  assert.equal(completed.eligible, false);
  assert.equal(completed.scenarios.length, 0);
});

test('caps projected cumulative expenditure at total estimated cost', () => {
  const result = forecastInitiative(
    input({ recordedExpenditure: 85 }),
    { sampleSize: 1, p25: 0.8, p50: 1.3, p75: 2 },
    '2026-06-30',
    '2026-12-31',
  );

  assert.equal(result.scenarios[1]?.projectedCumulativeExpenditure, 100);
  assert.equal(result.scenarios[1]?.additionalExpenditure, 15);
});
