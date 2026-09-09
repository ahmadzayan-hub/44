# Branch and release governance

## Rules

1. `main` is the release branch and the only canonical code line. Nobody commits to `main` directly, from any workspace (Replit included).
2. All work goes through a feature branch and a pull request. CI (`.github/workflows/ci.yml`) must pass: `npm ci`, typecheck, web syntax, data-pack drift, portfolio privacy check, unit and integration tests (including HTTP security and RBAC tests), build and package smoke, API and preview smoke.
3. At least one human review before merge. Squash or merge commits are acceptable; history on `main` must never be rewritten.
4. Replit pulls from GitHub. It never pushes to `main`. If a Replit experiment is worth keeping, push it to a branch and open a pull request.
5. Version is bumped in `package.json` only when every gate passes on the branch.

## Branch protection settings to configure on GitHub (not automatable from this repository)

Repository settings, Branches, add a rule for `main`:

- Require a pull request before merging; required approvals: 1; dismiss stale approvals on new commits.
- Require status checks to pass before merging; required check: `verify` (the job in `ci.yml`); require branches to be up to date.
- Require conversation resolution before merging.
- Do not allow bypassing the above settings (include administrators).
- Restrict force pushes and deletions.

Optional: require signed commits; require linear history.

## Release checklist

1. `npm run verify` green locally and in CI on the branch.
2. `docs/P0_IMPLEMENTATION_STATUS.md`, `README.md`, `CLAUDE.md` and `docs/openapi.yaml` match the code.
3. `web/data/demo-pack.js` regenerated and committed if anything upstream of the Control Tower service changed.
4. Version bumped. Pull request opened against `main` with the change summary, controls implemented and test results.
