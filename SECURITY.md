# Security baseline

Project 44 is designed for asset-intensive and potentially safety-relevant environments.

- Never commit credentials, API keys, operational secrets or production asset data.
- P0 connectors are read-only.
- No public LLM endpoint may receive confidential operational data by default.
- Every external write requires explicit policy and human approval.
- No signalling, possession, isolation, speed restriction or other safety-critical control action may be executed by the platform.
- KPI formula code and evidence lineage must be auditable and versioned.

## HTTP runtime controls (implemented)

- The static host serves only `index.html` and `web/**` with an extension allowlist. Repository files, dotfiles, package files, `src/`, `tests/`, `docs/`, `infra/` and `.git/` are unreachable; traversal, encoded traversal, absolute, backslash and null-byte paths are rejected (`src/http/public-paths.ts`).
- Static routes accept GET and HEAD only. Every response carries Content-Security-Policy, X-Content-Type-Options, Referrer-Policy, X-Frame-Options, Permissions-Policy and cross-origin policies (`src/http/security-headers.ts`).
- Every API route except `/api/health` and `/api/auth/demo-identities` requires a bearer token; roles and scopes are enforced on the server and denials are audited.
- Production mode refuses synthetic data; confidential data never reaches a remote model endpoint without explicit approval.
- `tests/http-security.test.ts` and `tests/api.test.ts` exercise these controls against the live server.

## Reporting a vulnerability

Open a private security advisory on the repository or contact the repository owner directly. Do not open a public issue for a security problem.
