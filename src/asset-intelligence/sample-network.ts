/**
 * Legacy sample network (ahmadzayan-hub/RailMind, src/data/sample-network.ts).
 * Synthetic assets with plausible engineering characteristics, not real RTA
 * data. Kept as a fixture for fidelity tests and as illustrative content.
 */
import type { AssetRiskInput } from './types.ts';

export const LEGACY_SAMPLE_NETWORK: readonly AssetRiskInput[] = [
  { id: 'TRK-SEC-A12', name: 'Track section A12', assetClass: 'track', section: 'Line A', healthIndex: 48, healthIndex90dAgo: 71, failures12m: 3, daysSinceLastPm: 214, pmIntervalDays: 90, openWorkOrders: 2, serviceCritical: true, signals: [{ name: 'Track geometry deviation', changePct: 34, weight: 1 }, { name: 'Rail temperature stress', changePct: 12, weight: 0.5 }] },
  { id: 'PTS-014', name: 'Points machine 014', assetClass: 'points', section: 'Line A', healthIndex: 62, healthIndex90dAgo: 68, failures12m: 2, daysSinceLastPm: 120, pmIntervalDays: 60, openWorkOrders: 1, serviceCritical: true, signals: [{ name: 'Throw force', changePct: 22, weight: 0.8 }] },
  { id: 'SIG-INT-203', name: 'Interlocking 203', assetClass: 'signalling', section: 'Line A', healthIndex: 71, healthIndex90dAgo: 73, failures12m: 1, daysSinceLastPm: 40, pmIntervalDays: 180, openWorkOrders: 0, serviceCritical: true, signals: [{ name: 'Relay response time', changePct: 9, weight: 0.6 }] },
  { id: 'PWR-TRF-08', name: 'Traction rectifier 08', assetClass: 'traction_power', section: 'Line A', healthIndex: 55, healthIndex90dAgo: 64, failures12m: 2, daysSinceLastPm: 160, pmIntervalDays: 120, openWorkOrders: 1, serviceCritical: true, signals: [{ name: 'Winding temperature', changePct: 18, weight: 0.9 }, { name: 'Harmonic distortion', changePct: 11, weight: 0.4 }] },
  { id: 'TRK-SEC-B04', name: 'Track section B04', assetClass: 'track', section: 'Line B', healthIndex: 88, healthIndex90dAgo: 90, failures12m: 0, daysSinceLastPm: 35, pmIntervalDays: 90, openWorkOrders: 0, serviceCritical: false, signals: [] },
  { id: 'PTS-031', name: 'Points machine 031', assetClass: 'points', section: 'Line B', healthIndex: 74, healthIndex90dAgo: 79, failures12m: 1, daysSinceLastPm: 96, pmIntervalDays: 60, openWorkOrders: 0, serviceCritical: false, signals: [{ name: 'Detection contact wear', changePct: 15, weight: 0.7 }] },
  { id: 'EMU-R24-017', name: 'EMU set R24-017', assetClass: 'rolling_stock', section: 'Fleet', healthIndex: 41, healthIndex90dAgo: 66, failures12m: 5, daysSinceLastPm: 96, pmIntervalDays: 45, openWorkOrders: 3, serviceCritical: true, signals: [{ name: 'Bogie vibration', changePct: 41, weight: 1 }, { name: 'Brake pad wear rate', changePct: 26, weight: 0.8 }, { name: 'Traction motor current', changePct: 14, weight: 0.6 }] },
  { id: 'EMU-R24-022', name: 'EMU set R24-022', assetClass: 'rolling_stock', section: 'Fleet', healthIndex: 82, healthIndex90dAgo: 84, failures12m: 0, daysSinceLastPm: 20, pmIntervalDays: 45, openWorkOrders: 0, serviceCritical: true, signals: [] },
  { id: 'DEP-WSH-02', name: 'Depot wash plant 02', assetClass: 'depot', section: 'Depot', healthIndex: 69, healthIndex90dAgo: 70, failures12m: 1, daysSinceLastPm: 210, pmIntervalDays: 120, openWorkOrders: 0, serviceCritical: false, signals: [] },
  { id: 'PWR-SUB-11', name: 'Substation 11', assetClass: 'traction_power', section: 'Line B', healthIndex: 91, healthIndex90dAgo: 91, failures12m: 0, daysSinceLastPm: 15, pmIntervalDays: 120, openWorkOrders: 0, serviceCritical: true, signals: [] },
];
