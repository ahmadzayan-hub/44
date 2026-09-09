export type AwardStatus =
  | 'Awarded / Delivery Party Identified'
  | 'Not Awarded';

export interface BudgetForecastInput {
  initiativeId: string;
  portfolio: string;
  businessArea: string;
  awardStatus: AwardStatus;
  totalEstimatedCost: number;
  recordedExpenditure: number;
  approvedBudget: number;
  executionStart: string;
  executionEnd: string;
}

export interface PaceDistribution {
  sampleSize: number;
  p25: number;
  p50: number;
  p75: number;
}

export interface ForecastScenario {
  label: 'P25' | 'P50' | 'P75';
  paceFactor: number;
  additionalExpenditure: number;
  projectedCumulativeExpenditure: number;
}

export interface InitiativeForecast {
  initiativeId: string;
  eligible: boolean;
  scheduleProgressAtAsOf: number | null;
  scheduleProgressAtHorizon: number | null;
  scenarios: readonly ForecastScenario[];
}

const AWARDED: AwardStatus = 'Awarded / Delivery Party Identified';

function asDate(value: string): Date | null {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function clamp(value: number, lower = 0, upper = 1): number {
  return Math.min(upper, Math.max(lower, value));
}

function scheduleProgress(start: Date, end: Date, point: Date): number {
  const duration = end.getTime() - start.getTime();
  if (duration <= 0) return 0;
  return clamp((point.getTime() - start.getTime()) / duration);
}

function interpolateQuantile(values: readonly number[], probability: number): number {
  const ordered = [...values].sort((a, b) => a - b);
  if (ordered.length === 0) return 0;
  const position = (ordered.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const lowerValue = ordered[lower];
  const upperValue = ordered[upper];
  if (lowerValue === undefined || upperValue === undefined) return 0;
  return lowerValue + (upperValue - lowerValue) * (position - lower);
}

/**
 * Builds a deterministic distribution of cumulative-spend pace, normalised by
 * schedule progress. It deliberately excludes unawarded, zero-spend and
 * early-stage inputs because they cannot evidence an observed spending pace.
 */
export function buildPaceDistribution(
  inputs: readonly BudgetForecastInput[],
  asOfDate: string,
  minimumScheduleProgress = 0.1,
): PaceDistribution {
  const asOf = asDate(asOfDate);
  if (!asOf) throw new Error(`Invalid as-of date: ${asOfDate}`);

  const paces = inputs.flatMap((input) => {
    const start = asDate(input.executionStart);
    const end = asDate(input.executionEnd);
    if (
      input.awardStatus !== AWARDED ||
      input.totalEstimatedCost <= 0 ||
      input.recordedExpenditure <= 0 ||
      !start ||
      !end
    ) {
      return [];
    }
    const progress = scheduleProgress(start, end, asOf);
    if (progress < minimumScheduleProgress) return [];
    return [(input.recordedExpenditure / input.totalEstimatedCost) / progress];
  });

  if (paces.length === 0) {
    throw new Error('No eligible historical expenditure records are available for forecast calibration.');
  }

  return {
    sampleSize: paces.length,
    p25: interpolateQuantile(paces, 0.25),
    p50: interpolateQuantile(paces, 0.5),
    p75: interpolateQuantile(paces, 0.75),
  };
}

/**
 * Forecasts additional expenditure through the horizon using a schedule-
 * adjusted historical pace distribution. This is an exploratory planning
 * model, not a committed budget, forecast of cash, or contract entitlement.
 */
export function forecastInitiative(
  input: BudgetForecastInput,
  distribution: PaceDistribution,
  asOfDate: string,
  horizonDate: string,
): InitiativeForecast {
  const asOf = asDate(asOfDate);
  const horizon = asDate(horizonDate);
  const start = asDate(input.executionStart);
  const end = asDate(input.executionEnd);
  if (!asOf || !horizon || !start || !end) {
    throw new Error('Forecast inputs require valid as-of, horizon, start and end dates.');
  }

  const eligible =
    input.awardStatus === AWARDED &&
    input.totalEstimatedCost > 0 &&
    end > asOf &&
    start <= horizon;
  const progressAtAsOf = scheduleProgress(start, end, asOf);
  const progressAtHorizon = scheduleProgress(start, end, horizon);

  if (!eligible) {
    return {
      initiativeId: input.initiativeId,
      eligible: false,
      scheduleProgressAtAsOf: progressAtAsOf,
      scheduleProgressAtHorizon: progressAtHorizon,
      scenarios: [],
    };
  }

  const scenarioDefinitions: readonly [ForecastScenario['label'], number][] = [
    ['P25', distribution.p25],
    ['P50', distribution.p50],
    ['P75', distribution.p75],
  ];
  const scenarios = scenarioDefinitions.map(([label, paceFactor]) => {
    const projectedCumulativeExpenditure = Math.min(
      input.totalEstimatedCost,
      Math.max(
        input.recordedExpenditure,
        input.totalEstimatedCost * paceFactor * progressAtHorizon,
      ),
    );
    return {
      label,
      paceFactor,
      projectedCumulativeExpenditure,
      additionalExpenditure: Math.max(
        0,
        projectedCumulativeExpenditure - input.recordedExpenditure,
      ),
    };
  });

  return {
    initiativeId: input.initiativeId,
    eligible: true,
    scheduleProgressAtAsOf: progressAtAsOf,
    scheduleProgressAtHorizon: progressAtHorizon,
    scenarios,
  };
}
