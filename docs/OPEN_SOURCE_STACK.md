# RailMind Open-Source and Zero-Cost-Capable Stack

Status: **recommended foundation**

## Principle

The application stack should be open-source and self-hostable. A free managed cloud tier may be used for a pilot, but hosting providers are replaceable infrastructure, not architectural dependencies.

**Important:** zero cost can be guaranteed for local/self-hosted development on hardware you already own. It cannot be guaranteed for an enterprise production workload on public cloud because free-tier quotas, policies and availability can change.

## Recommended stack

| Layer | Default | Why |
|---|---|---|
| Web UI | React + Vite | already used by RailMind; open source and lightweight |
| Core language | TypeScript | one language across UI, orchestration and contracts |
| Agent orchestration | RailMind Agent OS kernel | prevents framework lock-in; deterministic policy first |
| API contract | REST + OpenAPI 3.1 | portable, auditable enterprise interface |
| Tool protocol | MCP | open standard for model/tool interoperability |
| Agent protocol | A2A | open standard for independently deployed agents |
| LLM interface | OpenAI-compatible HTTP gateway | model/runtime swap without domain rewrite |
| Local LLM runtime | llama.cpp | MIT; works on commodity CPU/GPU hardware |
| Local model | Qwen3-8B quantized | Apache-2.0 model; practical P0 default for a 16 GB laptop |
| Scale inference | vLLM | Apache-2.0; only when server/GPU capacity exists |
| Embeddings | BAAI bge-m3 | MIT; multilingual retrieval |
| Operational DB | PostgreSQL | open-source relational source for RailMind-owned data |
| Vector retrieval | pgvector | keeps vector search with governed relational data |
| P0 managed DB option | Supabase Free | open-source/self-hostable stack with a free managed pilot tier |
| Auth | Supabase Auth for P0; Keycloak when enterprise SSO demands it | preserves an open-source path |
| Object storage | Supabase Storage or S3-compatible open-source service | evidence attachments without proprietary data model |
| Observability | OpenTelemetry | portable tracing/metrics/logging |
| CI | existing project CI | typecheck, lint, tests and build before release |

## Why not start with LangGraph or another agent framework?

Frameworks can be added later behind RailMind interfaces. The first architecture must own routing, policy, evidence, approval and audit contracts itself. This is the part that is strategic to a rail owner. Delegating it to a rapidly changing framework would create lock-in in the most important layer.

## Model profile

### Development / laptop profile

* Qwen3-8B GGUF, 4-bit quantization
* llama.cpp server
* short, bounded context by default
* RAG retrieves only relevant evidence
* no confidential RTA data leaves the machine unless an approved deployment exists

### Optional server profile

* same model gateway
* vLLM
* larger Apache-2.0 or otherwise approved open model
* GPU infrastructure only after the pilot proves value

## Cloud profile with no mandatory monthly bill

For the pilot:

* static UI can continue on the current deployment route
* Supabase Free can hold P0 RailMind-owned test data and pgvector
* local inference remains on the development machine, or an interchangeable free inference endpoint may be used only with non-confidential synthetic data

Do not design the product around a free inference API. Free inference capacity is a temporary convenience, not an architecture.

## Licensing gap in the current repository

A public GitHub repository without an explicit software license is **not automatically open source for reuse**. Before calling RailMind open source, add an approved license file. Apache-2.0 is a strong enterprise-friendly candidate because it includes an explicit patent grant, but the repository owner should make the licensing decision.
