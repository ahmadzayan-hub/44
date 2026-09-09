# CLAUDE.md

Working notes for AI-assisted development on this repository. Read this before changing anything.

## What this repository is

Project 44 is the canonical repository for **RailMind Agent OS**: an evidence-first, governed decision layer for rail maintenance, asset, contract and finance intelligence. It is owned by Ahmed Zaian (Chief Engineer, Rail Maintenance Department context, Dubai). The older `ahmadzayan-hub/RailMind` repository is a legacy asset-intelligence prototype and migration source only; this repository is the platform authority.

The product answers one question for the asset owner and maintenance contractor: what is happening across asset, maintenance, contract and financial performance, what needs attention, why, and what decision is required now.

Current stage: **P0 synthetic demo**. Nothing here is connected to live RTA, Maximo or finance data, and nothing here may be presented as operational.

## Non-negotiable rules (enforced in code and tests)

1. Maximo and finance systems stay authoritative. RailMind never becomes a second asset register or ledger.
2. Contractual KPIs are deterministic, versioned and tested in `src/kpi/`. LLMs never calculate KPI truth; they only explain and draft.
3. Every decision-grade output carries evidence references (`EvidenceRef`: source system, entity type, entity id, observed timestamp).
4. Contractual, financial and safety-critical outputs require named human approval (`HumanApproval`).
5. No autonomous safety-critical rail control. `actionMode: 'control'` is always blocked. `execute_write` is always blocked in P0.
6. P0 integrations are read-only. The Maximo client exposes GET only. Do not add POST/PATCH/DELETE paths to `MaximoReadPort`; a future write needs a separate proposal/approval port.
7. Model and agent-framework independence. Domain code talks to `ModelGateway` only. No vendor SDK imports in `src/`.
8. Open-source first, zero-cost local development. Do not add runtime dependencies without a clear reason. The web preview must stay dependency-free and must never fetch external data or write to a source system.
9. Demo KPI formulas and thresholds in `src/kpi/demo-definitions.ts` are synthetic. Never describe them as RTA contractual definitions.
10. Never commit credentials, live operational data, contract documents or identifiable RTA records. `scripts/check-portfolio.mjs` fails the build if restricted identifiers appear in the portfolio workspace.

## Repository map

```
src/
  agent-os/        contracts, policy (execution rules + release readiness), catalog (7 agents with capability minimum risk), kernel (routing + risk escalation), orchestrator (runtime), tools (registry + plan-scoped invoker), standard-tools (ports -> tool ids), handlers (capability contract), memory
  agents/          executable capability handlers: data-quality, maintenance-kpi + exception-analysis, reporting (monthly/quarterly/annual) + executive-briefing, asset-intelligence (asset-health, failure-risk, maintenance-priority), scope resolution
  asset-intelligence/ migrated legacy RailMind engine: risk (health band, score, drivers, confidence, recommendation), proposal (engineer-review gate), sample network, types
  auth/            principals, roles and permissions; hashed bearer-token directory (demo identities only without RAILMIND_USERS)
  app/compose.ts   composition root: builds ports, adapters, runtime and API dependencies from config
  config.ts        typed environment configuration (.env.example documents every variable)
  api/router.ts    local decision API (report transitions, reset, audited agent planning, audit trail); runtime-neutral, hosted by server.mjs
  audit/           append-only, SHA-256 hash-chained audit log (in-memory adapter)
  persistence/     SQL ports, PostgreSQL adapters (audit, memory, report store), lazy `pg` loader
  connectors/maximo/ port (anti-corruption interfaces), client (read-only REST adapter), mock (in-memory port)
  connectors/contract/ contract context port (approved KPI definition sets); in-memory adapter serving the demo set
  connectors/condition/ condition-monitoring port (health index, trend, signals); in-memory demo profiles
  data/canonical.ts  canonical decision projections (asset, work order, invoice, contract, snapshot)
  kpi/             engine (availability, failure count, MTBF, MTTR, backlog) + demo definitions
  exceptions/      exception severity from KPI observations (breach + prior breaches -> critical)
  reporting/       contracts, generator (deterministic executive summary), approval (state machine), store (report state port)
  llm/             OpenAI-compatible gateway (fetch only), grounded report-narrative prompt, model invocation policy (classification x endpoint locality)
  forecast/        deterministic P25/P50/P75 schedule-adjusted expenditure pace model
  control-tower/   view model counts for the Control Tower
  web/demo-pack.ts projects engine outputs into the browser data pack (generated file: web/data/demo-pack.js)
  demo.ts          synthetic August 2026 work orders, KPI observations and report package
  index.ts         public export surface (all modules)
web/
  app.js           bilingual (Arabic RTL first, English toggle) Control Tower UI; reads every number from web/data/demo-pack.js
  data/demo-pack.js GENERATED by `npm run build:web-data`; never edit by hand; `check:web-data` blocks drift
  styles.css       single-file design system
  portfolio.html   self-contained sanitised portfolio dashboard, embedded in an iframe
index.html         application shell
server.mjs         host: loads config, composes the application, serves static files + API with structured logs and graceful shutdown
Dockerfile, infra/docker-compose.yml, .env.example, .github/workflows/ci.yml   runtime and CI infrastructure
infra/sql/         schema for RailMind-owned tables (audit rows append-only by trigger)
tests/             node:test suites (64 tests; the live PostgreSQL test is skipped unless DATABASE_URL is set)
scripts/           build-web-data.mjs, check-web-data.mjs, check-portfolio.mjs, package-smoke.mjs
docs/              product authority, architecture, data contract, pilot plan, status, reviews, deployment
infra/             optional PostgreSQL + pgvector compose file
```

## Commands

```bash
npm ci
npm run verify          # typecheck + web syntax + web data drift + portfolio check + tests + build/package smoke
npm test                # node --experimental-strip-types --test tests/*.test.ts
npm run build:web-data  # regenerate web/data/demo-pack.js after changing src/demo.ts or the engine
npm run build           # emit dist/ (ESM + declarations)
npm run serve           # http://localhost:4173  (Replit uses PORT=5000); DATABASE_URL=... enables PostgreSQL
```

Run `npm run verify` before every commit. All tests must pass. If you change `src/demo.ts`, the KPI engine, exceptions, reporting or approval logic, run `npm run build:web-data` and commit the regenerated pack.

## Coding conventions

- TypeScript strict mode with `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`.
- Imports inside `src/` and `tests/` use explicit `.ts` extensions (Node strip-types runtime). The build rewrites them to `.js` in `dist/`.
- Tests use `node:test` and `node:assert/strict`. No test framework dependency.
- Keep modules small and pure. Deterministic functions take inputs and return values; no hidden state.
- `src/` must not import Node-only modules or types (`node:*`, `Buffer`). The API uses structural request/response types so the domain layer stays runtime-neutral and typechecks without `@types/node`.
- Web code is plain ES modules, no bundler. Keep Arabic as the default language and preserve RTL layout. Every user-facing string needs both Arabic and English.
- Prose in docs: no em dashes. Short sentences. Facts, assumptions, risks and recommendations kept separate.
- Do not put a model name or AI identifier in commits, code comments or docs.

## Adding an agent capability

1. Register the capability, allowed action modes, allowed tool ids and minimum risk class in `src/agent-os/catalog.ts`.
2. Implement a `CapabilityHandler` in `src/agents/` that reaches data only through `context.tools` and returns evidence for every conclusion.
3. Register it in `createStandardHandlers`. A catalog capability without a handler fails closed at run time and is absent from `/api/health`.
4. Add an orchestrator test that asserts the tool trail, evidence count and release readiness.

## Known gaps (as of 2026-09-09, after the runtime work)

- Authentication is a hashed-token directory, not enterprise SSO. `DATA_CLASSIFICATION` is a deployment setting, not per-record classification.
- Two catalog capabilities have no handler yet: contract-context, finance-context.
- Asset-intelligence weights and thresholds are the legacy demo values, uncalibrated; the condition port serves synthetic profiles.
- Run records live in process memory (`/api/runs`); only their audit events and decision memory are persisted.
- The runtime is single-step: one handler per run, no model planning, no retries, no scheduling.
- Only one report package (the demo seed) is served. Multi-report and multi-contract scoping is not built.
- The KPI values in the preview still come from the generated pack, not from the API. Only report status, readiness and audit are live.
- PM compliance KPI, data-quality service, contract-context port and finance-context port are documented but not implemented.
- GIS positions, station names and routing defaults (owner, due window) in `web/app.js` are presentation placeholders, not engine outputs. They are labelled as such in the code.

## Resolved on 2026-09-09

- Build emits `dist/` (`rewriteRelativeImportExtensions`), and `scripts/package-smoke.mjs` runs in `verify`.
- `hasApprovedHumanReview` and `isOutputReleaseReady` exist with tests.
- Orphaned `vitest.config.ts` removed.
- `src/index.ts` exports every module.
- `web/app.js` no longer hard-codes any number. The previous UI showed MTBF 183.5 h while the engine computes 183.25 h, and showed three exceptions while the engine produces two. Both drifts are gone.
- Telemetry no longer perturbs KPI values with synthetic noise. It replays the period event by event with the engine recomputing each KPI.
- Approval gate is interactive through the local API with a named actor; every transition, refusal, reset and agent plan is audited and the chain is verified on read.
- PostgreSQL adapters exist for audit, memory and report state, verified live against PostgreSQL 16 including the append-only trigger.
- API requires bearer tokens; the audit actor is the authenticated principal; role checks on every mutating route with denials audited.
- Legacy RailMind asset health and failure risk migrated with their fidelity tests and exposed as three governed capabilities.

## Intended direction (see docs/P0_PILOT_PLAN.md)

Phase 0: approved KPI definitions and Maximo field mapping. Phase 1: deterministic data and KPI layer with provenance and data-quality checks. Phase 2: Control Tower and exception centre with drill-down to evidence. Phase 3: local model gateway, grounded reporting and executive briefing agents, human approval workflow. Phase 4: parallel reporting cycle and value case.

When extending the platform, add capability behind existing ports and contracts, keep every number reproducible from source fields, and keep every high-impact output behind a named approval.
