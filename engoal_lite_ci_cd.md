# Engoal-lite CI/CD Specification & Implementation Guide

> **Project:** Engoal-lite -- Personal Financial Planning App
> **Owner:** edwin-maljames
> **Lab:** Alteeza Lab (AI-native agentic development)
> **Last updated:** 2026-02-22

---

## Table of Contents

1. [Pipeline Overview](#1-pipeline-overview)
2. [Frontend CI Workflow](#2-frontend-ci-workflow)
3. [Backend CI Workflow](#3-backend-ci-workflow)
4. [Deploy Workflow](#4-deploy-workflow)
5. [GitHub Actions Secrets Required](#5-github-actions-secrets-required)
6. [Branch Protection Rules](#6-branch-protection-rules)
7. [AI-Native Failure Handling](#7-ai-native-failure-handling)
8. [Deployment Health Check](#8-deployment-health-check)
9. [Rollback Strategy](#9-rollback-strategy)
10. [PR Template](#10-pr-template)

---

## 1. Pipeline Overview

### Full Flow Diagram

```
Developer / Claude Code Agent
        |
        |  git push -u origin feat/xyz
        v
+------------------+
|   PR Opened /    |
|   Updated on GH  |
+--------+---------+
         |
         |  triggers (parallel)
         v
+--------+---------+     +------------------+
| ci-frontend.yml  |     | ci-backend.yml   |
| (if frontend/**  |     | (if backend/**   |
|  files changed)  |     |  files changed)  |
+--------+---------+     +--------+---------+
         |                         |
         +-------+     +----------+
                 |     |
                 v     v
          +------+-----+------+
          |  Both checks pass  |
          |  (required status  |
          |   checks on main)  |
          +--------+-----------+
                   |
                   v
          +--------+-----------+
          | Human Orchestrator  |
          | reviews & approves  |
          +--------+-----------+
                   |
                   |  merge to main
                   v
          +--------+-----------+
          |   deploy.yml        |
          |   (push to main)    |
          +--------+-----------+
                   |
                   |  SSH into Droplet
                   v
          +--------+-----------+
          | 1. git pull         |
          | 2. alembic upgrade  |
          | 3. restart backend  |
          | 4. next build       |
          | 5. restart frontend |
          | 6. health check     |
          +--------+-----------+
                   |
                   v
          +--------+-----------+
          |  Health check pass  |-----> DONE
          +--------+-----------+
                   |
                   | (fail)
                   v
          +--------+-----------+
          | Workflow fails,     |
          | agent investigates  |
          +--------------------+
```

### Repository Structure

```
Engoal-lite/
  .github/
    workflows/
      ci-frontend.yml
      ci-backend.yml
      deploy.yml
    pull_request_template.md
  frontend/              # Next.js app
    package.json
    package-lock.json
    next.config.ts
    vitest.config.ts
    playwright.config.ts
    src/
    tests/
    e2e/
  backend/               # FastAPI app
    pyproject.toml
    uv.lock
    alembic/
    app/
    tests/
  CLAUDE.md              # Project-level agent rules
```

### Workflow Summary

| Workflow           | Trigger                         | Purpose                          |
| ------------------ | ------------------------------- | -------------------------------- |
| `ci-frontend.yml`  | PR to `main`, paths `frontend/**` | Lint, type-check, test, build frontend |
| `ci-backend.yml`   | PR to `main`, paths `backend/**`  | Lint, type-check, test backend with Postgres |
| `deploy.yml`       | Push to `main`                  | Deploy to DigitalOcean Droplet   |

---

## 2. Frontend CI Workflow

**File:** `.github/workflows/ci-frontend.yml`

```yaml
name: CI Frontend

on:
  pull_request:
    branches: [main]
    paths:
      - "frontend/**"
      - ".github/workflows/ci-frontend.yml"

defaults:
  run:
    working-directory: frontend

concurrency:
  group: ci-frontend-${{ github.head_ref || github.ref_name }}
  cancel-in-progress: true

jobs:
  lint-and-typecheck:
    name: "Frontend: Lint & Type Check"
    runs-on: ubuntu-latest
    steps:
      - name: "step:checkout"
        uses: actions/checkout@v4

      - name: "step:setup-node"
        uses: actions/setup-node@v4
        with:
          node-version: 24

      - name: "step:cache-node-modules"
        uses: actions/cache@v4
        with:
          path: frontend/node_modules
          key: node-modules-${{ runner.os }}-${{ hashFiles('frontend/package-lock.json') }}
          restore-keys: |
            node-modules-${{ runner.os }}-

      - name: "step:install-deps"
        run: npm ci

      - name: "step:lint-eslint"
        run: npx eslint . --max-warnings 0

      - name: "step:typecheck-tsc"
        run: npx tsc --noEmit

  unit-and-integration-tests:
    name: "Frontend: Unit & Integration Tests (Vitest)"
    runs-on: ubuntu-latest
    steps:
      - name: "step:checkout"
        uses: actions/checkout@v4

      - name: "step:setup-node"
        uses: actions/setup-node@v4
        with:
          node-version: 24

      - name: "step:cache-node-modules"
        uses: actions/cache@v4
        with:
          path: frontend/node_modules
          key: node-modules-${{ runner.os }}-${{ hashFiles('frontend/package-lock.json') }}
          restore-keys: |
            node-modules-${{ runner.os }}-

      - name: "step:install-deps"
        run: npm ci

      - name: "step:test-vitest"
        run: npx vitest run --reporter=verbose

  build:
    name: "Frontend: Build (next build)"
    needs: [lint-and-typecheck, unit-and-integration-tests]
    runs-on: ubuntu-latest
    steps:
      - name: "step:checkout"
        uses: actions/checkout@v4

      - name: "step:setup-node"
        uses: actions/setup-node@v4
        with:
          node-version: 24

      - name: "step:cache-node-modules"
        uses: actions/cache@v4
        with:
          path: frontend/node_modules
          key: node-modules-${{ runner.os }}-${{ hashFiles('frontend/package-lock.json') }}
          restore-keys: |
            node-modules-${{ runner.os }}-

      - name: "step:install-deps"
        run: npm ci

      - name: "step:build-nextjs"
        run: npx next build

  e2e-tests:
    name: "Frontend: E2E Tests (Playwright)"
    needs: [build]
    runs-on: ubuntu-latest
    steps:
      - name: "step:checkout"
        uses: actions/checkout@v4

      - name: "step:setup-node"
        uses: actions/setup-node@v4
        with:
          node-version: 24

      - name: "step:cache-node-modules"
        uses: actions/cache@v4
        with:
          path: frontend/node_modules
          key: node-modules-${{ runner.os }}-${{ hashFiles('frontend/package-lock.json') }}
          restore-keys: |
            node-modules-${{ runner.os }}-

      - name: "step:install-deps"
        run: npm ci

      - name: "step:install-playwright-browsers"
        run: npx playwright install --with-deps chromium

      - name: "step:build-nextjs"
        run: npx next build

      - name: "step:e2e-playwright"
        run: npx playwright test
        env:
          CI: true

      - name: "step:upload-playwright-report"
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: frontend/playwright-report/
          retention-days: 14
```

### Key Design Decisions -- Frontend

- **Concurrency group** cancels stale runs when a branch is force-updated, saving CI minutes.
- **Parallel jobs** for lint/type-check and Vitest tests: these are independent and run simultaneously.
- **Build** depends on both passing, since there is no point building broken code.
- **E2E** runs after a successful build. Playwright tests execute against the production build (`next start` is handled inside `playwright.config.ts` via `webServer`).
- **Artifact upload** only on failure, so the Playwright HTML report is available for debugging without wasting storage on green builds.
- **Step naming convention** uses the `step:` prefix so Claude Code agents can parse log output programmatically (see Section 7).

---

## 3. Backend CI Workflow

**File:** `.github/workflows/ci-backend.yml`

```yaml
name: CI Backend

on:
  pull_request:
    branches: [main]
    paths:
      - "backend/**"
      - ".github/workflows/ci-backend.yml"

defaults:
  run:
    working-directory: backend

concurrency:
  group: ci-backend-${{ github.head_ref || github.ref_name }}
  cancel-in-progress: true

jobs:
  lint-and-typecheck:
    name: "Backend: Lint & Type Check"
    runs-on: ubuntu-latest
    steps:
      - name: "step:checkout"
        uses: actions/checkout@v4

      - name: "step:setup-python"
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: "step:install-uv"
        uses: astral-sh/setup-uv@v4

      - name: "step:cache-uv"
        uses: actions/cache@v4
        with:
          path: ~/.cache/uv
          key: uv-${{ runner.os }}-${{ hashFiles('backend/uv.lock') }}
          restore-keys: |
            uv-${{ runner.os }}-

      - name: "step:install-deps"
        run: uv sync --frozen

      - name: "step:lint-ruff"
        run: uv run ruff check .

      - name: "step:typecheck-mypy"
        run: uv run mypy app/

  test:
    name: "Backend: Unit & Integration Tests (pytest)"
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: engoal_lite_test
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: engoal_lite_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd="pg_isready -U engoal_lite_test"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=5

    env:
      DATABASE_URL: postgresql://engoal_lite_test:test_password@localhost:5432/engoal_lite_test

    steps:
      - name: "step:checkout"
        uses: actions/checkout@v4

      - name: "step:setup-python"
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: "step:install-uv"
        uses: astral-sh/setup-uv@v4

      - name: "step:cache-uv"
        uses: actions/cache@v4
        with:
          path: ~/.cache/uv
          key: uv-${{ runner.os }}-${{ hashFiles('backend/uv.lock') }}
          restore-keys: |
            uv-${{ runner.os }}-

      - name: "step:install-deps"
        run: uv sync --frozen

      - name: "step:run-migrations"
        run: uv run alembic upgrade head

      - name: "step:test-pytest"
        run: uv run pytest tests/ -v --tb=short --junitxml=test-results.xml --cov=app --cov-report=term-missing

      - name: "step:upload-test-results"
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: backend-test-results
          path: backend/test-results.xml
          retention-days: 14
```

### Key Design Decisions -- Backend

- **PostgreSQL service container** runs alongside the test job, providing a real database for integration tests. No SQLite substitution -- tests run against the same engine as production.
- **Alembic migrations** run before tests to verify migration integrity as part of CI.
- **Coverage report** is printed to stdout (`term-missing`) so Claude Code agents can read it directly from the log without downloading artifacts.
- **JUnit XML** is uploaded as an artifact for optional integration with GitHub's test reporting UI.
- **`uv sync --frozen`** ensures the lockfile is respected exactly. If `uv.lock` is out of date relative to `pyproject.toml`, this will fail -- catching dependency drift in CI.

---

## 4. Deploy Workflow

**File:** `.github/workflows/deploy.yml`

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

concurrency:
  group: deploy-production
  cancel-in-progress: false  # Never cancel a running deploy

jobs:
  deploy:
    name: "Deploy: Production (DigitalOcean Droplet)"
    runs-on: ubuntu-latest
    environment: production

    steps:
      - name: "step:checkout"
        uses: actions/checkout@v4

      - name: "step:deploy-via-ssh"
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DO_HOST }}
          username: ${{ secrets.DO_USER }}
          key: ${{ secrets.DO_SSH_KEY }}
          port: 22
          command_timeout: 10m
          script: |
            set -euo pipefail

            PROJECT_DIR="/opt/engoal_lite"
            cd "$PROJECT_DIR"

            echo "=== Pulling latest main ==="
            git fetch origin main
            git reset --hard origin/main

            echo "=== Running database migrations ==="
            cd backend
            uv sync --frozen
            uv run alembic upgrade head
            cd ..

            echo "=== Restarting backend (FastAPI) ==="
            sudo systemctl restart engoal_lite-backend
            sleep 3

            echo "=== Verifying backend is up ==="
            for i in 1 2 3 4 5; do
              if curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then
                echo "Backend health check passed on attempt $i"
                break
              fi
              if [ "$i" -eq 5 ]; then
                echo "ERROR: Backend health check failed after 5 attempts"
                sudo journalctl -u engoal_lite-backend --no-pager -n 50
                exit 1
              fi
              echo "Backend not ready, retrying in 3s..."
              sleep 3
            done

            echo "=== Building frontend (Next.js) ==="
            cd frontend
            npm ci
            npx next build
            cd ..

            echo "=== Restarting frontend (Next.js) ==="
            sudo systemctl restart engoal_lite-frontend
            sleep 3

            echo "=== Verifying frontend is up ==="
            for i in 1 2 3 4 5; do
              if curl -sf http://localhost:3000 > /dev/null 2>&1; then
                echo "Frontend health check passed on attempt $i"
                break
              fi
              if [ "$i" -eq 5 ]; then
                echo "ERROR: Frontend health check failed after 5 attempts"
                sudo journalctl -u engoal_lite-frontend --no-pager -n 50
                exit 1
              fi
              echo "Frontend not ready, retrying in 3s..."
              sleep 3
            done

            echo "=== Deploy complete ==="

      - name: "step:smoke-test-health"
        run: |
          sleep 5
          HTTP_STATUS=$(curl -sf -o /tmp/health.json -w "%{http_code}" https://${{ secrets.DO_HOST }}/api/health || true)
          if [ "$HTTP_STATUS" != "200" ]; then
            echo "ERROR: Production health check returned HTTP $HTTP_STATUS"
            cat /tmp/health.json 2>/dev/null || echo "(no response body)"
            exit 1
          fi
          echo "Production health check passed (HTTP 200)"
          cat /tmp/health.json
```

### Deployment Order and Zero-Downtime Considerations

The deploy follows this specific order for a reason:

1. **Database migrations first** -- The backend code on `main` is already written to be compatible with the new schema. Running migrations before restarting the backend means the old code may briefly run against the new schema, so migrations must be backward-compatible (additive only: new columns with defaults, new tables). Destructive migrations (drop column, rename) require a two-phase deploy strategy.

2. **Restart backend, then verify** -- The backend restarts with the new code. A retry loop confirms it is healthy before proceeding. If the backend fails to start, the deploy aborts immediately. The frontend still serves the previous version, so users see a degraded but functional state rather than a total outage.

3. **Build and restart frontend** -- The `next build` step runs on the Droplet. This is acceptable for a single-server setup. For larger deployments, consider building in CI and deploying the artifact. The frontend is restarted last because it depends on the backend API being available.

### systemd Service Configuration (Reference)

These service files should exist on the Droplet. They are not managed by CI but are documented here for completeness.

**`/etc/systemd/system/engoal_lite-backend.service`**

```ini
[Unit]
Description=Engoal-lite FastAPI Backend
After=network.target postgresql.service

[Service]
Type=exec
User=engoal_lite
Group=engoal_lite
WorkingDirectory=/opt/engoal_lite/backend
EnvironmentFile=/opt/engoal_lite/.env
ExecStart=/opt/engoal_lite/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**`/etc/systemd/system/engoal_lite-frontend.service`**

```ini
[Unit]
Description=Engoal-lite Next.js Frontend
After=network.target engoal_lite-backend.service

[Service]
Type=exec
User=engoal_lite
Group=engoal_lite
WorkingDirectory=/opt/engoal_lite/frontend
EnvironmentFile=/opt/engoal_lite/.env
ExecStart=/usr/bin/npx next start --port 3000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

---

## 5. GitHub Actions Secrets Required

All secrets are configured at the repository level:

```
Settings > Secrets and variables > Actions > Repository secrets
```

| Secret Name    | Used In          | Purpose                                                              |
| -------------- | ---------------- | -------------------------------------------------------------------- |
| `DO_HOST`      | `deploy.yml`     | DigitalOcean Droplet IP address or hostname                          |
| `DO_USER`      | `deploy.yml`     | SSH username on the Droplet (e.g., `engoal_lite` or `deploy`)             |
| `DO_SSH_KEY`   | `deploy.yml`     | Private SSH key for authenticating to the Droplet                    |

### Secrets That Live on the Droplet (Not in GitHub)

These are stored in `/opt/engoal_lite/.env` on the Droplet and loaded by systemd's `EnvironmentFile` directive. They are **never** committed to the repository or stored in GitHub Secrets:

| Variable              | Purpose                                                 |
| --------------------- | ------------------------------------------------------- |
| `DATABASE_URL`        | PostgreSQL connection string for production              |
| `SECRET_KEY`          | FastAPI secret key for JWT signing                       |
| `NEXTAUTH_SECRET`     | Next.js authentication secret (if using NextAuth)        |
| `NEXTAUTH_URL`        | Canonical URL of the frontend (e.g., `https://engoal_lite.app`) |
| `NEXT_PUBLIC_API_URL` | Public API URL the frontend calls                        |

### CI Test Database Credentials

The PostgreSQL credentials used in `ci-backend.yml` are **not secrets** -- they are hardcoded in the workflow YAML because the service container is ephemeral, isolated, and destroyed after each CI run. Using hardcoded values here is standard practice and avoids unnecessary secret management overhead.

### SSH Key Setup

Generate a dedicated deploy key (do not reuse personal keys):

```bash
ssh-keygen -t ed25519 -C "engoal_lite-github-deploy" -f ~/.ssh/engoal_lite_deploy -N ""
```

- Copy the **public** key to the Droplet: add to `/home/engoal_lite/.ssh/authorized_keys`
- Copy the **private** key content to the GitHub secret `DO_SSH_KEY`
- Restrict the deploy user's permissions on the Droplet to only what is needed (git pull, systemctl restart, npm/uv commands)

---

## 6. Branch Protection Rules

### Recommended Settings for `main`

| Setting                                    | Value   |
| ------------------------------------------ | ------- |
| Require a pull request before merging       | Yes     |
| Required number of approvals               | 1       |
| Dismiss stale PR approvals on new pushes   | Yes     |
| Require status checks to pass              | Yes     |
| Required checks                            | `Frontend: Lint & Type Check`, `Frontend: Unit & Integration Tests (Vitest)`, `Frontend: Build (next build)`, `Frontend: E2E Tests (Playwright)`, `Backend: Lint & Type Check`, `Backend: Unit & Integration Tests (pytest)` |
| Require branches to be up to date          | Yes     |
| Restrict who can push to matching branches | Yes     |
| Allow force pushes                         | No      |
| Allow deletions                            | No      |

### Configuring via `gh` CLI

Run these commands from the repository root (SSH authenticated):

```bash
# Enable branch protection on main
gh api repos/edwin-maljames/Engoal-lite/branches/main/protection \
  --method PUT \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Frontend: Lint & Type Check",
      "Frontend: Unit & Integration Tests (Vitest)",
      "Frontend: Build (next build)",
      "Frontend: E2E Tests (Playwright)",
      "Backend: Lint & Type Check",
      "Backend: Unit & Integration Tests (pytest)"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

**Note on path-filtered workflows and required checks:** GitHub will not report a status for a workflow that was not triggered. If a PR only changes `frontend/**` files, the backend CI workflow will not run, and its required check will remain in a "pending" state indefinitely, blocking the merge.

**Solution:** Use the `paths-filter` pattern with a "skip" job, or use GitHub's newer "required checks" configuration that allows checks to be required only when the corresponding workflow is triggered. The simplest approach is to configure branch protection via the repository settings UI, selecting "Require status checks to pass before merging" and only marking checks as required when they are relevant. Alternatively, add a trivial pass-through job:

```yaml
# Add to ci-backend.yml
jobs:
  skip-check:
    name: "Backend: Unit & Integration Tests (pytest)"
    if: false  # This job name matches the required check
    runs-on: ubuntu-latest
    steps:
      - run: echo "skipped"
```

The recommended approach is to use GitHub's ruleset feature (Settings > Rules > Rulesets) which natively supports "require check only when workflow is triggered."

---

## 7. AI-Native Failure Handling

This section defines how Claude Code agents interact with CI failures autonomously, aligning with the Alteeza Lab self-healing loop (global `CLAUDE.md`, Section 9).

### Step Naming Convention

Every step in every workflow uses the `step:` prefix in its name:

```yaml
- name: "step:lint-eslint"
- name: "step:test-pytest"
- name: "step:build-nextjs"
```

This convention allows agents to search log output for specific step boundaries. When an agent reads a failed run log, it can locate the failing step by searching for `step:<name>` and reading the output that follows.

### How an Agent Diagnoses a CI Failure

When a CI check fails on a PR, the agent follows this sequence:

**1. Identify the failed run:**

```bash
gh run list --branch <branch-name> --limit 5
```

**2. Read the failure log:**

```bash
gh run view <run-id> --log-failed
```

This outputs only the logs from the failed steps, significantly reducing noise.

**3. Parse the structured output:**

The agent looks for these patterns in the log output:

| Failure Type | Pattern to Search For | What It Tells the Agent |
| --- | --- | --- |
| ESLint error | `error  <message>  <rule-name>` followed by file path and line number | Exact file, line, and rule violated |
| TypeScript error | `error TS<code>: <message>` followed by `<file>(<line>,<col>)` | Exact file, line, column, and error code |
| Vitest failure | `FAIL  <test-file>` followed by `AssertionError:` or `Error:` | Test file, test name, expected vs received |
| Playwright failure | `<n>) <test-file>:<line>:<col>` followed by the error | Test file, line, exact assertion |
| Ruff error | `<file>:<line>:<col>: <code> <message>` | File, line, rule code, description |
| mypy error | `<file>:<line>: error: <message>  [<code>]` | File, line, error category |
| pytest failure | `FAILED <test-path>::<test-name>` followed by the traceback | Test path, test name, full traceback |

**4. Fix the root cause:**

The agent edits the source file (not the test, unless the test itself is wrong), commits, and pushes. The CI re-runs automatically on the updated PR.

### Self-Healing Loop

```
Iteration 1:
  Agent reads failure log --> identifies root cause --> pushes fix --> CI re-runs

Iteration 2 (if CI fails again):
  Agent reads NEW failure log --> identifies next issue --> pushes fix --> CI re-runs

Iteration 3 (if CI fails again):
  Agent reads failure log --> attempts fix --> pushes --> CI re-runs

Iteration 3 failure:
  Agent STOPS and escalates to the human orchestrator with:
    - Summary of all 3 attempts
    - The current error output
    - What the agent believes the root cause is
    - Why the agent could not fix it
```

This matches the global `CLAUDE.md` rule: maximum 3 self-healing iterations before escalation.

### Example Agent Interaction

```bash
# Agent sees CI failed on PR #42
$ gh run list --branch feat/budget-categories --limit 3
STATUS  TITLE          WORKFLOW     BRANCH                ID
X       feat: add...   CI Backend   feat/budget-categories  12345678

$ gh run view 12345678 --log-failed
Backend: Unit & Integration Tests (pytest)  step:test-pytest
  FAILED tests/test_budget.py::test_create_category - AssertionError:
    assert response.status_code == 201
    E  assert 422 == 201

# Agent reads the test, reads the endpoint code, identifies that the
# request body schema requires a new field that the test is not sending.
# Agent fixes the test payload, commits, and pushes.
```

### Information the Agent Needs

For the self-healing loop to work reliably, the agent needs:

1. **Exact error line** -- provided by verbose test output (`pytest -v --tb=short`, `vitest --reporter=verbose`)
2. **File path** -- all tools (ruff, mypy, ESLint, tsc, pytest, Vitest) include absolute or relative file paths in their output
3. **Test name** -- pytest and Vitest both output the full test name on failure
4. **Exit code** -- `gh run view --log-failed` only shows failing steps, so the agent does not need to manually filter

---

## 8. Deployment Health Check

### Health Endpoint Specification

**Endpoint:** `GET /api/health`
**Location:** `backend/app/routes/health.py` (or equivalent)

**Response (200 OK):**

```json
{
  "status": "ok",
  "version": "abc1234",
  "db": "connected",
  "timestamp": "2026-02-22T14:30:00Z"
}
```

**Response (503 Service Unavailable) -- when database is unreachable:**

```json
{
  "status": "degraded",
  "version": "abc1234",
  "db": "disconnected",
  "timestamp": "2026-02-22T14:30:00Z",
  "error": "Connection refused"
}
```

### Reference Implementation

```python
# backend/app/routes/health.py
import subprocess
from datetime import datetime, timezone

from fastapi import APIRouter, Response
from sqlalchemy import text

from app.database import get_db_session

router = APIRouter()


def _get_git_sha() -> str:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        return result.stdout.strip() if result.returncode == 0 else "unknown"
    except Exception:
        return "unknown"


@router.get("/api/health")
async def health_check(response: Response):
    db_status = "connected"
    error = None

    try:
        async with get_db_session() as session:
            await session.execute(text("SELECT 1"))
    except Exception as e:
        db_status = "disconnected"
        error = str(e)
        response.status_code = 503

    payload = {
        "status": "ok" if db_status == "connected" else "degraded",
        "version": _get_git_sha(),
        "db": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    if error:
        payload["error"] = error

    return payload
```

### Post-Deploy Smoke Test

The `deploy.yml` workflow includes two levels of health checking:

1. **On-server check** (inside the SSH session): Curls `localhost:8000/api/health` immediately after restarting each service. This catches startup crashes before proceeding to the next step.

2. **External check** (from the GitHub Actions runner): Curls the public URL `https://<DO_HOST>/api/health` after the SSH session completes. This verifies the full stack is reachable from the internet, including any reverse proxy (Nginx/Caddy) configuration.

---

## 9. Rollback Strategy

### Manual Rollback (Human-Initiated)

If a deploy introduces a bug that was not caught by CI:

```bash
# 1. Identify the last known good commit
git log --oneline -10

# 2. Revert the bad commit(s) on main
git revert <bad-commit-sha> --no-edit
git push origin main

# 3. The push to main triggers deploy.yml automatically
#    which deploys the reverted state
```

This is preferable to `git reset --hard` because it preserves history and does not require force-pushing to `main`.

### Agent-Initiated Rollback (After Failed Deploy)

When the deploy workflow's health check fails, the agent follows this procedure:

**1. Read the deploy failure log:**

```bash
gh run list --workflow=deploy.yml --limit 3
gh run view <run-id> --log-failed
```

**2. Identify the cause:**

- If the SSH step failed, the issue is likely on the Droplet (disk space, permission error, dependency issue).
- If the smoke test failed (health check returned non-200), the issue is in the deployed code.

**3. For code issues -- open a fix PR:**

The agent does NOT attempt to SSH into the Droplet or manually roll back. Instead:

```
1. Create a new branch: fix/deploy-health-check-failure
2. Fix the root cause (e.g., missing env var reference, broken import)
3. Run local tests
4. Push and open a PR
5. Request expedited human review with a note: "Deploy health check failed. This PR fixes the root cause."
```

**4. For infrastructure issues -- escalate to orchestrator:**

The agent cannot and should not fix infrastructure problems (disk full, Droplet unreachable, PostgreSQL down). It escalates immediately:

```
ESCALATION: Deploy failed due to infrastructure issue.
- Workflow run: <URL>
- Error: <exact error from log>
- Suggested action: SSH into Droplet and check systemd journal / disk space / PostgreSQL status
```

### Emergency Manual Rollback (SSH)

If the situation is urgent and the revert-and-deploy cycle is too slow:

```bash
ssh engoal_lite@<droplet-ip>
cd /opt/engoal_lite

# Roll back to previous commit
git log --oneline -5
git checkout <last-good-sha>

# Restart services
cd backend && uv sync --frozen && uv run alembic upgrade head
sudo systemctl restart engoal_lite-backend
cd ../frontend && npm ci && npx next build
sudo systemctl restart engoal_lite-frontend

# Verify
curl -s http://localhost:8000/api/health | python3 -m json.tool
```

**Important:** After an emergency manual rollback, the Droplet's code is in a detached HEAD state. The next `deploy.yml` run (triggered by any push to `main`) will overwrite it with whatever is on `main`. So the human must also revert the bad commit on `main` to prevent re-deploying it.

---

## 10. PR Template

**File:** `.github/pull_request_template.md`

```markdown
## What changed

-

## Why

<!-- Link to issue if applicable: Fixes #123 -->

## How to test

<!-- Steps for manual verification, or note "Covered by automated tests" -->

1.

## Test results

<!-- Paste the passing test output summary, or a screenshot -->

```
<test output here>
```

## Checklist

- [ ] Local tests pass (`vitest run` for frontend, `pytest` for backend)
- [ ] No secrets, API keys, or `.env` files are committed
- [ ] Database migrations are included (if schema changed)
- [ ] Types pass (`tsc --noEmit` for frontend, `mypy` for backend)
- [ ] Linting passes (`eslint .` for frontend, `ruff check .` for backend)
```

---

## Appendix A: Quick Reference Commands

Commands that Claude Code agents and humans use frequently in the Alteeza Lab workflow:

```bash
# Check CI status for current branch
gh pr checks

# View failed CI logs
gh run view <run-id> --log-failed

# Re-run failed CI jobs
gh run rerun <run-id> --failed

# View deploy history
gh run list --workflow=deploy.yml --limit 10

# View PR status
gh pr view <pr-number>

# Check branch protection rules
gh api repos/edwin-maljames/Engoal-lite/branches/main/protection

# Set remote to SSH (if accidentally HTTPS)
git remote set-url origin git@github.com:edwin-maljames/Engoal-lite.git
```

## Appendix B: File Path Summary

| File | Purpose |
| --- | --- |
| `.github/workflows/ci-frontend.yml` | Frontend CI pipeline |
| `.github/workflows/ci-backend.yml` | Backend CI pipeline |
| `.github/workflows/deploy.yml` | Production deploy pipeline |
| `.github/pull_request_template.md` | PR template for all pull requests |
| `backend/app/routes/health.py` | Health check endpoint |
| `/opt/engoal_lite/.env` | Production environment variables (on Droplet only) |
| `/etc/systemd/system/engoal_lite-backend.service` | Backend systemd unit (on Droplet) |
| `/etc/systemd/system/engoal_lite-frontend.service` | Frontend systemd unit (on Droplet) |
