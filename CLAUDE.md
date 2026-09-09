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
  agent-os/        contracts (types), policy (P0 execution rules), catalog (7 agents), kernel (deterministic routing), memory (in-memory store)
  connectors/maximo/ port (anti-corruption interfaces), client (read-only REST adapter), mock (in-memory port)
  data/canonical.ts  canonical decision projections (asset, work order, invoice, contract, snapshot)
  kpi/             engine (availability, failure count, MTBF, MTTR, backlog) + demo definitions
  exceptions/      exception severity from KPI observations (breach + prior breaches -> critical)
  reporting/       contracts (KPI observation, exception, report package) + generator (deterministic executive summary)
  llm/             OpenAI-compatible gateway (fetch only) + grounded report-narrative prompt
  forecast/        deterministic P25/P50/P75 schedule-adjusted expenditure pace model
  control-tower/   view model counts for the Control Tower
  demo.ts          synthetic August 2026 work orders, KPI observations and report package
  index.ts         public export surface
web/
  app.js           bilingual (Arabic RTL first, English toggle) Control Tower UI, telemetry simulation, GIS mock, decision drawers
  styles.css       single-file design system
  portfolio.html   self-contained sanitised portfolio dashboard, embedded in an iframe
index.html         application shell
server.mjs         zero-dependency static server with /api/health
tests/             node:test suites (23 tests)
scripts/           check-portfolio.mjs (privacy + aggregate assertions), package-smoke.mjs (currently unusable, see gaps)
docs/              product authority, architecture, data contract, pilot plan, status, reviews, deployment
infra/             optional PostgreSQL + pgvector compose file
```

## Commands

```bash
npm ci
npm run verify      # typecheck + web syntax check + portfolio check + tests
npm test            # node --experimental-strip-types --test tests/*.test.ts
npm run serve       # http://localhost:4173  (Replit uses PORT=5000)
```

Run `npm run verify` before every commit. All 23 tests must pass.

## Coding conventions

- TypeScript strict mode with `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`.
- Imports inside `src/` and `tests/` use explicit `.ts` extensions (Node strip-types runtime). `src/index.ts` uses `.js` extensions for the packaged surface.
- Tests use `node:test` and `node:assert/strict`. No test framework dependency.
- Keep modules small and pure. Deterministic functions take inputs and return values; no hidden state.
- Web code is plain ES modules, no bundler. Keep Arabic as the default language and preserve RTL layout. Every user-facing string needs both Arabic and English.
- Prose in docs: no em dashes. Short sentences. Facts, assumptions, risks and recommendations kept separate.
- Do not put a model name or AI identifier in commits, code comments or docs.

## Known gaps and inconsistencies (as of 2026-09-09)

- `scripts/package-smoke.mjs` imports `dist/index.js` and expects `hasApprovedHumanReview` and `isOutputReleaseReady`. Neither the build output nor those functions exist. `tsconfig.build.json` inherits `noEmit: true`, so `tsc -p tsconfig.build.json` emits nothing. `docs/FOUNDATION_REVIEW.md` describes these functions as present; that description is outdated.
- `vitest.config.ts` is orphaned. Vitest is not installed and tests run on `node:test`.
- `src/index.ts` does not export the KPI engine, exception engine, reporting generator, forecast, LLM gateway, canonical data model or Maximo client/mock.
- `web/app.js` hard-codes KPI values, exceptions and answers. It does not consume `src/demo.ts` or the KPI engine, so the UI and the domain layer can drift.
- No GitHub Actions workflow is active. `docs/CI_WORKFLOW_TEMPLATE.yml` must be moved to `.github/workflows/ci.yml` once the workflows permission exists.
- No authentication, RBAC, persistence, audit log or data classification exists yet. These are release gates before any live data.
- The report approval state machine (`draft -> under_review -> approved -> locked`) is only a type union; no transitions are enforced.
- PM compliance KPI, data-quality service, contract-context port and finance-context port are documented but not implemented.

## Intended direction (see docs/P0_PILOT_PLAN.md)

Phase 0: approved KPI definitions and Maximo field mapping. Phase 1: deterministic data and KPI layer with provenance and data-quality checks. Phase 2: Control Tower and exception centre with drill-down to evidence. Phase 3: local model gateway, grounded reporting and executive briefing agents, human approval workflow. Phase 4: parallel reporting cycle and value case.

When extending the platform, add capability behind existing ports and contracts, keep every number reproducible from source fields, and keep every high-impact output behind a named approval.
