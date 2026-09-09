# Project 44 — RailMind Agent OS

Canonical implementation repository for an open-source, evidence-first rail asset and contract intelligence platform.

> Replace document-driven periodic reporting with a governed, continuously updated decision environment while keeping Maximo, finance and approved contract repositories authoritative.

## What Project 44 owns

Project 44 is the **Agent Operating System and decision layer**. It connects asset, maintenance, finance and approved contractual context; calculates deterministic KPIs; detects exceptions; coordinates bounded agents; drafts grounded reports; and enforces human approval.

The existing `RailMind` repository is treated as the asset-intelligence reference/legacy prototype until its reusable components are migrated.

## Non-negotiable rules

1. Maximo and finance remain systems of record.
2. Contractual KPIs are deterministic, versioned and testable. LLMs do not calculate contractual KPI truth.
3. Every decision-grade output carries source provenance.
4. High-impact contractual, financial and safety-adjacent outputs require named human review.
5. No autonomous safety-critical rail control.
6. P0 enterprise integrations are read-only.
7. Model and agent-framework independence through internal ports.
8. Open-source-first, zero-cost-capable local development.

## P0 implemented

- canonical decision data model
- configurable Maximo REST read adapter and mock port
- deterministic Availability / Failure / MTBF / MTTR / Backlog demo engine
- versioned KPI observations with evidence
- exception-based management engine
- monthly / quarterly / annual report package model
- deterministic executive summary
- optional OpenAI-compatible local model gateway
- grounded report-narrative service
- governed multi-agent kernel and memory abstraction
- Control Tower view model
- Arabic-first bilingual Control Tower preview with English toggle, responsive navigation, evidence drawers and human-review safeguards
- deterministic schedule-adjusted expenditure-pace distribution model with P25 / P50 / P75 portfolio planning scenarios
- local verification and static preview smoke test, with a GitHub Actions activation template

> **Important:** KPI formulas and thresholds included in the demo are synthetic examples only. They are not RTA contractual definitions and must be replaced by formally approved rules before production. The portfolio forecast is exploratory decision support, not a committed budget, cash forecast or contractual entitlement.

## Run

```bash
npm run verify
npm run serve
```

Open `http://localhost:4173`.

The browser preview remains **illustrative only**. It is built from synthetic data and never sends an external write, creates a work order or changes a source system.

## Replit

The repository includes `.replit` and `replit.nix` configuration files for a Node.js 22 Replit environment. Import `ahmadzayan-hub/44` from GitHub, then select **Run**. Replit installs dependencies with `npm ci` and starts the application using `PORT=5000 npm run serve`, which aligns with Replit's web preview port. The deployment configuration runs `npm ci && npm run verify` before starting the server with `PORT=5000 npm start`.

## Architecture

```text
Maximo / Finance / Contracts / Condition feeds
                  │
          Evidence & Provenance
                  │
       Deterministic KPI Engine
                  │
     Exception & Decision Layer
                  │
        RailMind Agent OS Kernel
       ┌──────────┼───────────┐
 Asset Agent   Reporting   Contract/Finance Agents
       └──────────┼───────────┘
                  │
          Human Approval Gates
                  │
 Control Tower / Exception Centre / Reports
```

## Documentation

- `docs/PRODUCT_AUTHORITY.md`
- `docs/ARCHITECTURE_AGENT_OS.md`
- `docs/DATA_REQUIREMENTS.md`
- `docs/P0_IMPLEMENTATION_STATUS.md`
- `docs/P0_PILOT_PLAN.md`
- `docs/OPEN_SOURCE_STACK.md`
- `docs/DEPLOYMENT.md`
- `docs/MIGRATION_FROM_RAILMIND.md`
- `docs/ADR-002_PLATFORM_SCOPE.md`
- `docs/UX_REVIEW_2026-09-09.md`
- `docs/CI_WORKFLOW_TEMPLATE.yml`
