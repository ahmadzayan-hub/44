# ADR-003: Agent OS runtime (orchestrator)

Status: **accepted** (2026-09-09)

## Context

Until this decision the Agent OS had a router and a policy gate (`kernel.ts`, `policy.ts`) but nothing executed an agent run. The documented flow `route -> retrieve -> analyse -> explain -> draft -> verify -> escalate` existed only on paper. Agent "runs" in the API were planning calls that never touched data.

## Decision

Add an in-process, deterministic-first runtime (`src/agent-os/orchestrator.ts`) with these properties.

1. **Routing before execution.** `createExecutionPlan` selects the agent and evaluates policy. The kernel escalates the task's risk class to the capability minimum declared in the catalog, so a caller cannot label a contractual report as routine.
2. **Tools are the only data path.** A `ToolRegistry` holds read-only tools bound to ports (`maximo.read`, `finance.read`, `contract.read`, `memory.read`). A handler receives an invoker scoped to the plan's allowed tool ids; any other call is refused before the implementation runs and the run fails closed.
3. **Capability handlers are explicit.** Each catalog capability needs a registered `CapabilityHandler`. A capability without a handler fails closed instead of falling back to a model.
4. **Model access is a policy decision.** A handler receives a model gateway only when the agent may use a model and `evaluateModelInvocation` allows it for the run's data classification and endpoint locality. Confidential data never reaches a remote endpoint without explicit deployment approval. The decision is audited either way.
5. **Evidence verification.** Output without decision-grade evidence is discarded. Release readiness combines evidence with the approval requirement.
6. **Everything is audited.** Start, each tool call, model decision, completion or failure are appended to the hash-chained audit log under the run id. The grounded value is stored in decision memory as structured JSON so downstream agents (executive briefing) consume governed results instead of recomputing.
7. **No framework.** The runtime is about 150 lines of TypeScript with no dependency. LangGraph or similar can be introduced later behind `CapabilityHandler` without touching policy, tools or audit.

## Consequences

Agents become testable in isolation and as a pipeline (`exception-analysis` feeding `executive-briefing` through memory). The catalog is now a contract: adding a tool id or capability there without a registered implementation is visible at run time and in `/api/health`.

Not covered: multi-step planning by a model, parallel agent execution, long-running jobs, retries. These are deferred until a measured need appears.

## Alternatives rejected

- Adopting an agent framework first: would put the strategic governance layer (routing, policy, evidence, audit) inside third-party abstractions.
- Letting handlers receive the raw ports: would make tool boundaries unenforceable.
