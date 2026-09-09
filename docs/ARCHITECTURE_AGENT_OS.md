# RailMind Agent OS Foundation

Status: **foundation v0**

RailMind is evolving from a single asset-risk application into an **AI-enabled rail maintenance decision platform** while preserving strict system-of-record boundaries. Maximo remains authoritative for assets, work orders and maintenance history. Finance systems remain authoritative for invoices and financial workflow. Contract facts remain authoritative in the contract domain. RailMind owns the decision, evidence, review and reporting intelligence layer.

## 1. Design objective

Replace document-driven periodic reporting with a right-time decision environment:

```text
Authoritative systems
  Maximo assets / work orders / PM / inspections
  Finance / invoices / workflow
  Contract obligations / KPI definitions
  Condition monitoring / alarms
           |
           v
Read-only connectors + provenance
           |
           v
RailMind evidence layer
           |
           v
Deterministic metrics + rules
           |
           v
Agent OS
  route -> retrieve -> analyse -> explain -> draft -> verify -> escalate
           |
           v
Human approval gates
           |
           v
Control Tower / Asset / KPI / Report / Exception views
```

Monthly, quarterly and annual reports are outputs of the same governed evidence model, not separate manual processes.

## 2. Non-negotiable architecture rules

1. **No second Maximo.** RailMind references authoritative records and stores only the minimum evidence snapshot required to explain a decision.
2. **LLMs do not calculate contractual KPIs.** KPI formulas, thresholds, penalties and reconciliations are deterministic, versioned and testable. LLMs may explain the result and draft narrative.
3. **No autonomous safety-critical control.** RailMind never issues signalling commands, possessions, isolations, speed restrictions or any rail control action.
4. **Writes are exceptional.** P0 integrations are read-only. A future write requires an explicit human approval gate and an auditable outbound proposal.
5. **Every conclusion carries provenance.** A number or recommendation without source references is not decision-grade.
6. **Right-time, not real-time everywhere.** Refresh frequency is set by decision need and source capability.
7. **Model independence.** Business logic must not depend on one LLM vendor or one agent framework.
8. **Open interfaces.** REST/OpenAPI for product APIs, MCP for tools/data access, A2A for agent interoperability when independently deployed agents are introduced.

## 3. Bounded contexts

### Asset Intelligence
Health scoring, failure risk, degradation signals, reliability trends and recommended interventions.

### Maintenance Performance
Work orders, PM, failures, inspections, backlog and response data. Produces governed operational metrics and exceptions.

### Contract Context
Consumes approved contract obligations, KPI definitions, reporting frequencies and evidence rules. RailMind may use these facts for reporting and exception detection but must not silently redefine the contract.

### Finance Context
Consumes invoice, payment, variation and workflow status needed to explain contract and maintenance performance. Finance remains authoritative.

### Reporting Intelligence
Builds monthly, quarterly, annual and executive report packages from approved metrics, exceptions, commentary and evidence.

### Decision & Review
Owns recommendations, named human reviews, approvals/rejections, decision rationale and outcome feedback.

## 4. Agent OS kernel

The Agent OS is a governed orchestration layer, not a collection of uncontrolled chatbots. The runtime that implements the flow below is described in ADR-003 (`src/agent-os/orchestrator.ts`).

```text
Task intake
  -> classify risk and intent
  -> identify required evidence
  -> select registered capability
  -> call approved tools only
  -> deterministic calculations where applicable
  -> LLM synthesis/explanation where useful
  -> evidence and assumption check
  -> human approval gate if required
  -> record run + outcome
```

### Initial agents

| Agent | Job | External write |
|---|---|---:|
| Data Quality Agent | missing, stale, duplicate and inconsistent source data | No |
| Asset Intelligence Agent | health, risk drivers and degradation interpretation | No |
| Maintenance KPI Agent | explain deterministic KPI results and exceptions | No |
| Reporting Agent | draft monthly / quarterly / annual narrative | No |
| Executive Briefing Agent | convert approved exceptions into decisions required | No |
| Contract Context Agent | retrieve approved clauses, thresholds and evidence rules | No |
| Finance Context Agent | retrieve invoice and workflow status | No |

## 5. Brain and model gateway

RailMind uses its own model gateway with an OpenAI-compatible HTTP contract so the underlying model can be replaced without changing business logic.

P0 default for a 16 GB development laptop:

* Qwen3-8B, quantized, for local reasoning and narrative generation.
* llama.cpp server as the local inference runtime.
* Optional larger open models through a compatible remote endpoint when free compute is available.

The model is never the source of truth. It receives grounded evidence and returns a structured draft with assumptions and evidence references.

## 6. Memory

* **Working memory:** one task/run; compact after completion.
* **Episodic memory:** tools called, actions, approvals and outcomes.
* **Semantic memory:** approved documents, clauses, procedures and lessons indexed for retrieval.
* **Decision memory:** assessments, recommendations, human decisions and measured outcomes.

Do not use vector memory as an authoritative database. Structured facts remain structured. Embeddings are for retrieval, not truth.

Target persistence: PostgreSQL + pgvector. P0 can use the in-memory adapter already defined in the foundation code.

## 7. Protocols

* **Maximo:** REST/JSON APIs, commonly exposed through Maximo REST / OSLC interfaces; P0 read-only.
* **RailMind API:** REST with OpenAPI 3.1 contracts.
* **Tools:** Model Context Protocol (MCP).
* **Agent interoperability:** Agent2Agent (A2A) when independently deployed agents are justified.
* **Models:** OpenAI-compatible HTTP behind RailMind's own gateway.
* **Events:** versioned RailMind domain-event envelope. A message broker is deferred until measured volume justifies it.

## 8. Product interface

1. **Control Tower**: asset, maintenance, contract and finance exceptions plus decisions required.
2. **Asset Intelligence**: health, trend, drivers, evidence and recommended action.
3. **Maintenance Performance**: availability, failures, MTBF, MTTR, backlog and PM compliance.
4. **Contract Performance**: approved KPI thresholds, status, evidence and disputes.
5. **Report Workspace**: monthly, quarterly and annual report packages generated from approved facts.
6. **Exception Centre**: deviations ranked by consequence and urgency.
7. **Evidence View**: narrative -> KPI -> source record -> timestamp.
8. **Agent Workspace**: natural-language analysis with visible evidence, assumptions and approval state.

## 9. Security baseline

* read-only source access in P0
* least-privilege service identities
* tenant and contract separation
* full audit log for agent runs and approvals
* data classification before model invocation
* no confidential operational data sent to public inference endpoints by default
* deterministic KPI tests before narrative is accepted
* mandatory human review for safety-critical, contractual, financial or external-write outputs

## 10. Scaling rule

Do not introduce microservices, a message broker, a graph database or a specialist vector database until a measured requirement appears. P0 should be a modular monolith with clear ports. This keeps the project understandable, testable and close to zero cost while preserving a path to scale.
