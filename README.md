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
- report approval state machine (draft, under review, approved, locked) with evidence gates and named accountability
- hash-chained, append-only audit log for report transitions, approvals and agent runs
- release-readiness policy: no high-impact output is release-ready without decision-grade evidence and a named approved review
- engine-generated browser data pack: every number in the preview is produced by the deterministic engine and verified against it
- Agent OS runtime (orchestrator): deterministic routing, risk escalation to the capability minimum, plan-scoped read-only tools, model access by data-classification policy, evidence verification, approval gate, hash-chained audit and structured decision memory (ADR-003)
- executable capability handlers: data quality, maintenance KPI, exception analysis, monthly/quarterly/annual reporting (deterministic narrative, model narrative when policy allows) and executive briefing that consumes governed decision memory
- contract context port serving approved KPI definition sets (demo set in P0)
- local decision API: governed agent runs, report transitions, audited agent planning, audit trail and chain verification over HTTP; the browser approval gate and agent workspace are interactive
- PostgreSQL adapters for the audit log, memory store and report state behind the same interfaces, with a database-level append-only guard on audit rows
- local verification, packaged build smoke test, static preview smoke test and an active GitHub Actions workflow (`.github/workflows/ci.yml`)

> **Important:** KPI formulas and thresholds included in the demo are synthetic examples only. They are not RTA contractual definitions and must be replaced by formally approved rules before production. The portfolio forecast is exploratory decision support, not a committed budget, cash forecast or contractual entitlement.

## Run

```bash
npm run verify
npm run serve
```

Open `http://localhost:4173`.

The browser preview remains **illustrative only**. It is built from synthetic data and never sends an external write, creates a work order or changes a source system.

### How the preview gets its numbers

The preview has no bundler and no runtime dependency, so it cannot execute the TypeScript engine directly. Instead `src/web/demo-pack.ts` projects the engine's outputs (KPI observations, exceptions, report status, approval gate, asset roll-ups and a period-to-date replay timeline) into `web/data/demo-pack.js`.

```bash
npm run build:web-data   # regenerate web/data/demo-pack.js from the engine
npm run check:web-data   # fails when the committed file drifts from the engine (part of verify)
```

The browser layer owns bilingual labels and layout only. If a number on screen is wrong, fix the engine or the synthetic data in `src/demo.ts`, regenerate, and commit the result.

### Local decision API

`server.mjs` hosts the static preview and a small JSON API implemented in `src/api/router.ts`. It mutates RailMind-owned state only (report status, audit trail, agent memory) and never writes to Maximo, finance or contract systems.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | service status and active persistence mode |
| GET | `/api/report` | current report package, readiness (next transitions and blockers) and its audit trail |
| POST | `/api/report/transition` | `{ type, actorId, actorRole?, note?, at? }` with `type` one of `submit_for_review`, `approve`, `reject`, `lock`; refused transitions return 409 with blockers and are audited |
| POST | `/api/report/reset` | `{ actorId }` restores the demo package; audited |
| POST | `/api/agent/task` | `{ capability, actorId, goal, riskClass, actionMode }` routes through the kernel without executing; audited |
| POST | `/api/agent/run` | same body plus optional `context` scope; executes the capability through the orchestrator and returns the run record with grounded output, tool calls, model use, approval requirement and audit sequences |
| GET | `/api/runs` | run records of this process |
| GET | `/api/audit` | all audit events with hash-chain verification |
| GET | `/api/agents` | the registered agent catalog |

P0 has no authentication. The named actor is supplied by the caller and recorded as given. Authentication and role-based access control are release gates before any live data. The OpenAPI description is in `docs/openapi.yaml`.

### Configuration

All configuration is read from environment variables by `src/config.ts` (see `.env.example`). Without any variable the server runs the synthetic in-memory demo. `DATABASE_URL` enables PostgreSQL. `LLM_BASE_URL` and `LLM_MODEL` enable an OpenAI-compatible model gateway; `DATA_CLASSIFICATION` and the `LLM_REMOTE_APPROVED_*` flags control whether a model may be used for the data at hand. `MAXIMO_BASE_URL` switches the Maximo port from the mock to the read-only REST client.

### Containers

`Dockerfile` runs the server with Node 22 and no build step. `infra/docker-compose.yml` starts PostgreSQL and the app together:

```bash
docker compose -f infra/docker-compose.yml up --build
```

### Persistence

Without `DATABASE_URL` all state is in memory and resets on restart. With `DATABASE_URL` set, the server uses the PostgreSQL adapters in `src/persistence/postgres.ts` through the optional `pg` driver and creates the schema from `infra/sql/001_railmind_core.sql` on start. Audit rows are protected by a database trigger that rejects `UPDATE` and `DELETE`.

```bash
docker compose -f infra/docker-compose.yml up -d
DATABASE_URL=postgres://railmind:local_only_change_me@localhost:5432/railmind npm run serve
DATABASE_URL=... npm test   # also runs the live PostgreSQL integration test
```

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
- `docs/ADR-003_AGENT_RUNTIME.md`
- `docs/openapi.yaml`
- `docs/UX_REVIEW_2026-09-09.md`
- `docs/CI_WORKFLOW_TEMPLATE.yml`
