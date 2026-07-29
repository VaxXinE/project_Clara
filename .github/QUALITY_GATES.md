# Clara Production Quality Gates

The `quality-gates.yml` workflow validates every pull request and protected-branch
push without deploying Clara or receiving production secrets.

## Checks

These job display names are stable because branch rulesets depend on them:

- **Repository hygiene** rejects tracked sensitive/generated files and checks
  whitespace integrity for the relevant pull-request or push diff.
- **Backend** installs the frozen `uv.lock` environment on Python 3.14, runs
  Ruff, and runs the complete pytest suite against its isolated SQLite fixtures.
- **Dashboard** installs the npm lockfile on Node.js 22, enforces the current
  seven-warning lint budget, and creates a production build.
- **Extension** installs the npm lockfile on Node.js 22, builds the extension,
  and verifies that packaging succeeds. CI does not publish the ZIP.
- **Dependency review** runs only on pull requests and blocks newly introduced
  dependencies with high or critical known vulnerabilities.

The exact expected status-check names are:

1. `Repository hygiene`
2. `Backend`
3. `Dashboard`
4. `Extension`
5. `Dependency review`

## Local equivalents

Run these commands from the repository root:

```bash
cd clara-backend
uv sync --frozen
uv run --frozen ruff check .
uv run --frozen pytest -q

cd ../clara-dashboard
npm ci --no-audit --no-fund
npm run lint -- --max-warnings 7
npm run build

cd ../clara-extension
npm ci --no-audit --no-fund
npm run build
npm run package
```

The dashboard currently has seven known warnings. The `--max-warnings 7` budget
keeps the established baseline green and fails as soon as the warning count
increases. It does not suppress existing warnings.

## Security model

The workflow has only `contents: read`, checkout does not persist credentials,
and jobs receive no repository or production secrets. Backend tests intentionally
use isolated SQLite fixtures, so CI needs neither PostgreSQL nor production
database credentials. No job deploys an application, publishes an extension
package, or uploads source, environment, database, or test-payload artifacts.

`pull_request_target` is prohibited because it runs in the trusted base-repository
context. Running untrusted pull-request code in that context can expose privileged
tokens or secrets. This workflow uses `pull_request` with read-only permissions.

Dependency Review compares pull-request dependency changes with the target branch
and fails for newly introduced vulnerabilities at severity `high` or `critical`.
It does not comment on the pull request, ignore failures, or use a vulnerability
allowlist. GitHub must provide Dependency Review for the repository plan and have
the dependency graph enabled.

## Branch ruleset setup

After the first successful workflow run, a repository administrator should create
a ruleset for `dev-extension`:

1. Require a pull request before merging.
2. Require all five status checks listed above.
3. Require conversation resolution.
4. Require the branch to be up to date before merging.
5. Block force pushes.
6. Block branch deletion.

Do not configure `main` yet. Extend the same ruleset requirements to `main` only
after release reconciliation confirms that `main` contains the intended
`dev-extension` release state and all five checks pass there.

This document is guidance only; the workflow does not modify repository settings.

## Cache and lockfile troubleshooting

### npm

Each Node job keys the setup-node npm cache from its own `package-lock.json`.
If cache restoration fails, rerun the job first; cache misses are safe and npm
will download dependencies. If `npm ci` reports a lock mismatch, regenerate and
review the lockfile locally using the repository's intended npm version. Never
replace `npm ci` with `npm install` in CI.

### uv

The uv cache key includes `clara-backend/uv.lock`. A cache miss only makes the job
slower. If `uv sync --frozen` fails, update and review `uv.lock` locally together
with the intended dependency change; do not remove frozen behavior in CI.

## Updating action pins

Actions are pinned to full immutable commit SHAs with release-version comments.
To update one safely:

1. Open the official upstream action repository.
2. Select a current signed release supported by GitHub-hosted runners.
3. Verify the release tag's full commit SHA through the official GitHub API.
4. Review release notes and runtime changes.
5. Replace both the SHA and version comment.
6. Run Prettier and validate the workflow on a pull request before changing any
   required status check.

Do not substitute an unverified SHA, floating branch, or third-party fork.

## No deployment

These quality gates only lint, test, build, package-check, and review dependency
changes. They do not deploy Clara, publish the extension ZIP, change repository
settings, or write to protected branches.
