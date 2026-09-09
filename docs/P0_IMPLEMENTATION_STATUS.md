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
| Agent policy kernel | Implemented | `src/agent-os/*` |
| Control Tower view model | Implemented | `src/control-tower/view-model.ts` |
| Bilingual Control Tower UX | Implemented | `index.html`, `web/*` with Arabic RTL, English toggle, evidence drawer and responsive controls |
| Engine-driven preview data | Implemented | `src/web/demo-pack.ts` generates `web/data/demo-pack.js`; `npm run check:web-data` blocks drift |
| Report approval state machine | Implemented | `src/reporting/approval.ts`: draft, under_review, approved, locked; evidence gate on submission, named approval, critical exceptions require a mitigation note, lock only after period end |
| Audit log | Implemented (in-memory) | `src/audit/log.ts`: append-only, SHA-256 hash-chained, verifiable; PostgreSQL adapter pending |
| Release-readiness policy | Implemented | `hasApprovedHumanReview`, `isOutputReleaseReady` in `src/agent-os/policy.ts` |
| Packaged build | Implemented | `npm run build` emits `dist/`; `scripts/package-smoke.mjs` verifies the public surface |
| CI activation template | Included | `docs/CI_WORKFLOW_TEMPLATE.yml`; move to `.github/workflows/ci.yml` after workflows permission is granted |
| Production Maximo credentials / object mappings | Pending owner environment | No credentials are stored in GitHub |
| Approved RTA contractual KPI formulas | Pending formal source | Demo thresholds must not be used operationally |
| Finance production mapping | Port exists; source mapping pending | Requires approved Maximo finance fields/object structure |
| Production auth/RBAC | P1 | Do not expose production data before this gate |
| Durable audit and decision persistence | P1 | In-memory adapters only; PostgreSQL adapter through the same interfaces is the next step |

## Release gate

The P0 demo is safe to publish because it uses synthetic data. It is **not approved for live RTA data** until authentication, authorization, data classification, source-system approvals, approved KPI formula definitions, audit retention and environment-specific cybersecurity review are completed.
