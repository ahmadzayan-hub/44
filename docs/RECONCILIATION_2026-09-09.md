# Repository reconciliation report

Date: 2026-09-09
Branch under reconciliation: `claude/project-understanding-69wh3l`
Base at session start: `c612e40` (origin/main at that time)

## 1. What was compared

| Line | Head | Commits since `c612e40` | Content |
|---|---|---:|---|
| `origin/main` (pushed from the Replit workspace) | `335965c` | 6 | Vercel packaging (`vercel.json`, module-relative static root, leading-slash strip), simulated train-movement layer, GIS inspector re-localisation on language switch, predictive-maintenance panel |
| This branch (governed runtime work) | `3c6b84e` | 7 | Engine-driven data pack, approval state machine, hash-chained audit log, local decision API, PostgreSQL adapters, Agent OS runtime with governed tools and handlers, bearer-token authentication with RBAC, migrated asset intelligence, Docker/CI/OpenAPI |

Files changed on both sides: `server.mjs`, `web/app.js`, `web/styles.css`, `index.html`.

## 2. Findings

1. **No security or forecast fixes exist on `origin/main`.** The six Replit commits are user-interface and packaging changes only. The static server on `origin/main` still serves the repository root; the forecast calibration on `origin/main` is unchanged from `c612e40`. If newer security or forecast work exists in the Replit workspace, it was never pushed. This session cannot read the Replit filesystem; any unpushed work there must be pushed to a branch before it can be reconciled.
2. **The predictive-maintenance panel on `origin/main` computed risk scores in the browser** from a phase table driven by telemetry ticks. That is browser-created operational truth and conflicts with the product rules. It was not discarded: the panel is kept and now loads deterministic scores from the `failure-risk` agent through the API.
3. **The train-movement layer is presentation only** and labelled as simulated. It was merged unchanged.
4. **Static serving**: `origin/main` resolved the root from the module path (needed for Vercel). This was adopted. Full hardening (public allowlist, method restriction, CSP) is Phase 1 of the implementation plan.
5. **Forecast calibration defect confirmed** (independent of the merge): `buildPaceDistribution` includes initiatives whose execution end is on or before the as-of date, because clamped schedule progress becomes 1 and passes the minimum-progress filter. `docs/PORTFOLIO_INTELLIGENCE_WORKSPACE.md` states they are excluded; the code does not do that. Scheduled for Phase 9 together with the portfolio API, because the embedded portfolio cells cannot be regenerated from the repository.
6. **Vercel**: `vercel.json` includes only `index.html` and `web/**`. The server now imports `src/**` and needs Node 22.18 or later for type stripping. The Vercel path is unverified from this session and is recorded as such.

## 3. Resolution

`origin/main` was merged into this branch (`662a9f3`). Conflicts in `server.mjs`, `web/app.js` and `web/styles.css` were resolved by taking the governed-runtime versions and porting the three Replit capabilities into them. `index.html` and `vercel.json` merged automatically.

Verification after the merge: typecheck, web syntax, data-pack drift, portfolio check, 80 tests (1 skipped without `DATABASE_URL`), build and package smoke all pass. A browser run confirmed sign-in, role-aware approval controls, the API-sourced predictive panel, the asset-health assessment, the train layer and inspector localisation.

## 4. Canonical line going forward

`origin/main` remains the release branch. This branch is the reconciled implementation and must reach `main` through a pull request with CI, not a direct push. No further direct commits to `main` from any workspace, Replit included. Replit should pull from GitHub, never the other way round.

## 5. Not verifiable from this session

- Unpushed content of the Replit workspace.
- Vercel deployment behaviour with the type-stripping server.
- GitHub Actions run results for this branch (the workflow file is present; results are on GitHub).
