# RailMind Agent OS Foundation Review

**Review date:** 9 September 2026
**Scope:** `RailMind-agent-os-foundation.patch` supplied for repository integration
**Status update (2026-09-09, later the same day):** `hasApprovedHumanReview` and `isOutputReleaseReady` are now implemented in `src/agent-os/policy.ts` with tests. The test runner is `node:test`, not Vitest. The audit-persistence and report-approval gaps listed below are addressed in-memory by `src/audit/log.ts` and `src/reporting/approval.ts`; durable persistence, identity and data classification remain open.

**Repository state at review:** The selected GitHub repository was empty. The supplied patch was therefore integrated as the initial repository baseline and completed with the minimum TypeScript build, test, package and CI configuration required to make it executable.

## Executive assessment

The supplied foundation is **approved as a P0 architectural baseline**, subject to the boundaries documented below. It is not yet an operational rail maintenance platform and must not be represented as one. The code correctly establishes the most important early governance principles: RailMind is a decision and orchestration layer, not a replacement system of record; source integration is read-only in P0; contractual KPI computation is deterministic; and safety-critical control is prohibited.

The design is appropriate for a rail-owner environment because it prioritises traceability, bounded authority, deterministic control and named accountability ahead of autonomous agent capability. This sequence reduces the risk of building an attractive but non-auditable AI interface over maintenance data.

## What the patch provides

| Area | Assessment | Decision value |
|---|---|---|
| Agent OS contracts | Strong | Separates business logic from a specific model vendor or agent framework. Defines tasks, risks, action modes, evidence, approvals and grounded output contracts. |
| Deterministic routing | Strong | Routes only registered capabilities and returns registered tool IDs. This prevents a model from selecting an unapproved agent or inventing a tool. |
| Execution policy | Strong | Blocks `control` and `execute_write`; requires approval for proposals and high-impact contractual, financial and safety-critical work. |
| Evidence model | Strong baseline | Requires evidence references with source system, entity, identifier and observed timestamp. |
| Maximo anti-corruption port | Strong P0 boundary | Defines read-only records without exposing Maximo-specific response shapes to the rest of the application. |
| Reporting contracts | Appropriate | Separates KPI observations, exceptions and report packages. It correctly states that AI narration follows approved KPI facts. |
| Memory abstraction | Appropriate for P0 | Supports a swap from in-memory records to PostgreSQL/pgvector without changing the domain interface. |
| Architecture and pilot documentation | Strong | Clearly establishes source ownership, data requirements, initial KPIs, refresh principles and staged pilot exits. |

## Integration additions and corrective controls

The supplied patch was intentionally additive but did not include a runnable project scaffold. The following non-domain additions were made so the foundation is buildable and protected from regression:

| Addition | Purpose |
|---|---|
| Strict TypeScript configuration | Validates contracts with strict type rules and produces JavaScript/declaration output. |
| Public package entry point | Provides an explicit `src/index.ts` export surface and package metadata for portable consumption. |
| Vitest configuration and tests | Executes routing, P0 policy, provenance, named approval and memory isolation tests. |
| Release-readiness policy | Adds `hasApprovedHumanReview` and `isOutputReleaseReady`. A permitted high-impact draft cannot be treated as a release-ready output without valid evidence and a named approved review. |
| GitHub Actions workflow | Runs typecheck, test and build on pushes and pull requests to `main`. |
| Repository README | Records architecture scope, runnable commands, current limitations and the safe implementation sequence. |
| Dependency remediation | Updates the test framework to remove identified moderate development dependency vulnerabilities. |

## Controls verified by automated tests

The validation suite contains **11 passing tests** across two test files. It verifies that RailMind routes a known capability deterministically, rejects an unregistered capability, blocks autonomous external writes, blocks rail control, requires approval for contractual work, rejects outputs with no evidence, accepts valid provenance, blocks release without named approval, blocks rejected approval, permits a valid approved high-impact output, and isolates in-memory records by task and memory kind.

## Material gaps before an operational pilot

| Priority | Gap | Required action | Pilot gate |
|---|---|---|---|
| P0 | Contract KPI authority | Obtain approved formula version, inclusion/exclusion rules, threshold, clause reference and accountable business owner for every KPI. | No KPI or narrative is released from generic formulas. |
| P0 | Source data adapter | Implement a Maximo read adapter first against synthetic or anonymised data, carrying source IDs, observed timestamps, ingestion timestamps and snapshot hashes. | Each displayed number is reproducible from the mapped source fields. |
| P0 | Deterministic KPI engine | Implement tested, versioned formulas outside the LLM path. | The same input produces the same approved result. |
| P0 | Identity, access and tenant isolation | Introduce enterprise authentication/authorisation, contract-level access control and least-privilege service identities. | Users see only records and evidence within their scope. |
| P0 | Audit persistence | Replace in-memory memory with durable decision, evidence and approval records. | An auditor can reconstruct the decision, evidence, approver and timing. |
| P0 | Data classification and model gateway | Classify and redact data before model use; retain a controlled OpenAI-compatible gateway with no public endpoint default for confidential information. | No confidential RTA/contract data is sent to an unapproved inference service. |
| P1 | Report approval state machine | Enforce KPI approval, evidence completeness, named review and lock-period controls. | A report cannot move to `approved` or `locked` when a required control is absent. |
| P1 | Data quality service | Implement source freshness, completeness, duplicate and reconciliation checks. | Any incomplete KPI/report section is visibly provisional. |

## Decision and recommended next action

Proceed with **Phase 0 of the documented P0 pilot plan** using one bounded asset/system scope or one maintenance contract, only after formal confirmation of KPI definitions and source-field mapping. Use synthetic or anonymised data until the required access, classification and governance approvals are in place. The first operational deliverable should be a deterministic five-KPI evidence pack and an exception view, not a conversational agent interface.

> **Do not proceed to production integration, finance workflow usage, contract enforcement, or any control-related action on the basis of this foundation alone.** The foundation deliberately prohibits those behaviours and still requires the P0 controls listed above.
