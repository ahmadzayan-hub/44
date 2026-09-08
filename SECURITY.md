# Security baseline

Project 44 is designed for asset-intensive and potentially safety-relevant environments.

- Never commit credentials, API keys, operational secrets or production asset data.
- P0 connectors are read-only.
- No public LLM endpoint may receive confidential operational data by default.
- Every external write requires explicit policy and human approval.
- No signalling, possession, isolation, speed restriction or other safety-critical control action may be executed by the platform.
- KPI formula code and evidence lineage must be auditable and versioned.
