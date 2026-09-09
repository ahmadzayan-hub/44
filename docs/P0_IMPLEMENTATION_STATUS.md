# P0 Implementation Status

Status date: 2026-09-09

| Capability | Status | P0 evidence |
|---|---|---|
| Canonical decision model | Implemented | `src/data/canonical.ts` |
| Maximo read-only adapter | Implemented foundation | `src/connectors/maximo/client.ts` |
| Deterministic KPI engine | Implemented | `src/kpi/engine.ts` |
| Exception engine | Implemented | `src/exceptions/engine.ts` |
| Monthly/Quarterly/Annual report package | Implemented | `src/reporting/generator.ts` |
| Open-source LLM gateway | Implemented adapter | `src/llm/openai-compatible.ts` |
| Grounded reporting prompt | Implemented | `src/llm/report-narrative.ts` |
| Agent policy kernel | Implemented | `src/agent-os/kernel.ts`, `policy.ts`; risk class escalated to the capability minimum |
| Agent OS runtime (orchestrator) | Implemented | `src/agent-os/orchestrator.ts`, `tools.ts`, `standard-tools.ts`, `handlers.ts`; see ADR-003 |
| Capability handlers | Implemented (7) | `src/agents/*`: data-quality, maintenance-kpi, exception-analysis, monthly/quarterly/annual-report, executive-briefing. Not implemented: asset-health, failure-risk, maintenance-priority, contract-context, finance-context (fail closed) |
| Model invocation policy | Implemented | `src/llm/policy.ts`: local vs remote endpoint, data classification, explicit remote approvals |
| Contract context port | Implemented (in-memory) | `src/connectors/contract/port.ts` serving the demo definition set |
| Composition root and configuration | Implemented | `src/app/compose.ts`, `src/config.ts`, `.env.example` |
| Containers and CI | Implemented | `Dockerfile`, `infra/docker-compose.yml`, `.github/workflows/ci.yml` |
| Control Tower view model | Implemented | `src/control-tower/view-model.ts` |
| Bilingual Control Tower UX | Implemented | `index.html`, `web/*` with Arabic RTL, English toggle, evidence drawer and responsive controls |
| Engine-driven preview data | Implemented | `src/web/demo-pack.ts` generates `web/data/demo-pack.js`; `npm run check:web-data` blocks drift |
| Report approval state machine | Implemented | `src/reporting/approval.ts`: draft, under_review, approved, locked; evidence gate on submission, named approval, critical exceptions require a mitigation note, lock only after period end |
| Audit log | Implemented | `src/audit/log.ts` (in-memory) and `src/persistence/postgres.ts` (PostgreSQL, append-only trigger, advisory-locked appends); hash chain verified on read |
| Local decision API | Implemented | `src/api/router.ts`: report transitions, reset, audited agent planning, audit trail; no authentication in P0 |
| Interactive approval gate | Implemented | Reports workspace drives the state machine through the API with a named actor, shows blockers and the audit trail with chain status |
| PostgreSQL persistence | Implemented, optional | `DATABASE_URL` selects `PgAuditLog`, `PgMemoryStore`, `PgReportStore`; schema in `infra/sql/001_railmind_core.sql`; live test runs when `DATABASE_URL` is set |
| Release-readiness policy | Implemented | `hasApprovedHumanReview`, `isOutputReleaseReady` in `src/agent-os/policy.ts` |
| Packaged build | Implemented | `npm run build` emits `dist/`; `scripts/package-smoke.mjs` verifies the public surface |
| CI activation template | Included | `docs/CI_WORKFLOW_TEMPLATE.yml`; move to `.github/workflows/ci.yml` after workflows permission is granted |
| Production Maximo credentials / object mappings | Pending owner environment | No credentials are stored in GitHub |
| Approved RTA contractual KPI formulas | Pending formal source | Demo thresholds must not be used operationally |
| Finance production mapping | Port exists; source mapping pending | Requires approved Maximo finance fields/object structure |
| Production auth/RBAC | P1 | Do not expose production data before this gate |
| Identity on API calls | P1 | Actor id and role are caller-supplied; bind them to an authenticated principal before live data |

## Release gate

The P0 demo is safe to publish because it uses synthetic data. It is **not approved for live RTA data** until authentication, authorization, data classification, source-system approvals, approved KPI formula definitions, audit retention and environment-specific cybersecurity review are completed.
