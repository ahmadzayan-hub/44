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
