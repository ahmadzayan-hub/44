# Migration from the existing RailMind repository

## Decision

Use `ahmadzayan-hub/44` as the canonical repository for the RailMind Agent OS platform.

The existing `ahmadzayan-hub/RailMind` repository should be treated as an asset-intelligence reference implementation and migration source, not as a competing platform authority.

## Reuse from RailMind

The following concepts should be preserved and migrated into Project 44 as modules:

- asset health scoring
- failure-risk drivers
- engineer review gate
- Maximo proposal boundary
- network / asset visualisation concepts
- synthetic demonstration dataset

## Do not copy blindly

Project 44 introduces broader product authority for owner-contractor operating intelligence. Existing RailMind statements that assign contract compliance or management reporting to other portfolio products must be reconciled through a portfolio decision before production rollout.

## Target relationship

```text
Project 44 / RailMind Agent OS  ← canonical platform
  ├─ Asset Intelligence module  ← evolved from RailMind
  ├─ Maintenance KPI module
  ├─ Contract Context module
  ├─ Finance Context module
  ├─ Reporting Intelligence module
  └─ Agent OS + governance
```

## Migration record (2026-09-09)

| Legacy module | Project 44 location | Notes |
|---|---|---|
| `src/domain/types.ts` | `src/asset-intelligence/types.ts` | `Asset` became `AssetRiskInput` (assembled from ports, not typed in); `position` dropped (map layout only) |
| `src/domain/risk.ts` | `src/asset-intelligence/risk.ts` | Logic, weights and thresholds ported unchanged; tagged `railmind-legacy-v1`; weights remain uncalibrated demo values |
| `src/domain/maximo.ts` | `src/asset-intelligence/proposal.ts` | `EngineerReview` mapped onto `HumanApproval`; proposals run in `propose_write` mode and stay behind the P0 approval gate |
| `src/data/sample-network.ts` | `src/asset-intelligence/sample-network.ts` | Kept as a synthetic fixture for fidelity tests |
| `tests/risk.test.ts`, `tests/maximo.test.ts` | `tests/asset-risk.test.ts` | Same assertions on `node:test` |
| React UI (`NetworkMap`, `AssetDetail`) | Not migrated | The Control Tower Asset Intelligence view calls the agent through the API instead |

New in Project 44: `src/connectors/condition/port.ts` (condition profiles), `condition.read` tool, and three capability handlers (`asset-health`, `failure-risk`, `maintenance-priority`) that assemble inputs from Maximo and condition ports and run inside the governed runtime.
