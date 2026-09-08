# RailMind Agent OS Foundation

RailMind is a **governed decision and orchestration layer** for rail maintenance intelligence. It connects to authoritative systems, applies deterministic rules and KPIs, produces evidence-backed drafts, and retains human accountability for consequential decisions.

This repository deliberately begins as a small TypeScript modular monolith. It contains domain contracts, routing, execution policy, a read-only Maximo port, an in-memory P0 memory adapter, reporting contracts, architecture decisions, and executable safety tests. It does **not** connect to production Maximo or finance systems, calculate contract KPIs, invoke a language model, or perform external writes.

## Architecture boundaries

| RailMind owns | RailMind integrates, but does not own |
|---|---|
| Decision records, recommendations, approvals, outcomes, evidence snapshots, reporting intelligence | Asset register, work orders, maintenance history, finance ledger, invoice workflow, approved contract obligations and safety-critical control |

The foundation blocks rail control and autonomous external writes. High-impact contractual, financial and safety-critical outputs require named human review. Every decision-grade output must carry valid provenance.

## Quick start

```bash
npm install
npm run check
```

The validated commands are:

| Command | Purpose |
|---|---|
| `npm run typecheck` | Strict TypeScript validation of source and tests |
| `npm test` | Policy, routing, evidence and memory tests |
| `npm run build` | Produces portable JavaScript and declaration files in `dist/` |
| `npm run check` | Runs all three release checks |

## Repository map

| Location | Purpose |
|---|---|
| `src/agent-os/` | Model-independent Agent OS contracts, catalog, routing, policy and P0 memory adapter |
| `src/connectors/maximo/` | Read-only Maximo anti-corruption port |
| `src/reporting/` | Reporting and deterministic KPI data contracts |
| `tests/` | Executable architectural and safety controls |
| `docs/` | P0 architecture, data contract, pilot plan, scope ADR and stack rationale |

## Implementation review and next build priorities

The supplied foundation was **additive and suitable as an architectural baseline**. It establishes the critical guardrails needed for RailMind: source-of-truth discipline, vendor-independent model access, read-only P0 integration, human approval for high-impact work, deterministic routing and provenance checks.

Before any operational pilot, implement these items in order:

1. Confirm approved KPI formula versions, clauses, exclusions, thresholds and sign-off roles with the relevant RTA/contract authorities. Do not encode generic KPI formulas.
2. Build a Maximo read adapter against synthetic or anonymised export data, preserving source IDs, timestamps, ingestion timestamps and snapshot hashes.
3. Create a deterministic KPI module with versioned formulas and test vectors signed off by the business owner.
4. Persist decisions, evidence and approvals in PostgreSQL with tenant/contract access controls and an immutable audit trail.
5. Implement a report approval state machine that rejects release until evidence is valid and the required named approval exists.
6. Add data classification, redaction and model-gateway controls before any confidential data is sent to an inference endpoint.

See [the P0 pilot plan](docs/P0_PILOT_PLAN.md), [data requirements](docs/DATA_REQUIREMENTS.md), and [architecture](docs/ARCHITECTURE_AGENT_OS.md) for the approved sequencing and boundaries.

## License

No software licence has been selected. The `OPEN_SOURCE_STACK.md` recommendation is not a licence grant. Add an owner-approved `LICENSE` file before representing this repository as open source or accepting reusable external contributions.
