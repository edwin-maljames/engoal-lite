# Engoal-lite

Personal Financial Planning App — built on the Alteeza Lab agentic stack.

## Tech Stack

| Layer | Tool |
|-------|------|
| Frontend | Next.js (App Router) · TypeScript · Tailwind CSS |
| Backend | FastAPI · Python 3.12 · SQLAlchemy · Alembic |
| Database | SQLite (dev) · PostgreSQL 16 (E2E / CI / prod) |
| Package managers | npm (frontend) · uv (backend) |
| Tests | Vitest + Playwright (frontend) · pytest (backend) |
| Deployment | DigitalOcean Droplet · systemd · Nginx |

---

## Local Development Setup

### Prerequisites

- **Python 3.12+** and [uv](https://docs.astral.sh/uv/)
- **Node.js 24+**
- **PostgreSQL 16+** — only needed for E2E tests (not required for dev or unit/integration tests)

### 1. Clone the repository

```bash
git clone git@github.com:edwin-maljames/Engoal-lite.git
cd Engoal-lite
```

### 2. Configure environment variables

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env — set SECRET_KEY (DATABASE_URL defaults to SQLite)

# Frontend
cp frontend/.env.local.example frontend/.env.local
```

Required variables:

| Variable | Location | Dev default |
|----------|----------|-------------|
| `DATABASE_URL` | `backend/.env` | `sqlite+aiosqlite:///./engoal_lite_dev.db` |
| `SECRET_KEY` | `backend/.env` | Generate with `openssl rand -hex 32` |
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | `http://localhost:8000/api` |

### 3. Start the application

```bash
# Terminal 1 — Backend
cd backend
uv sync
uv run alembic upgrade head        # creates all tables on first run
uv run uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

- Backend: http://localhost:8000
- Frontend: http://localhost:3000
- API docs: http://localhost:8000/api/docs

> Dev uses **SQLite** — no Docker or Postgres setup needed. The `.db` file is gitignored.

### 4. One-time Postgres setup (E2E tests only)

Only needed if you want to run E2E tests locally:

```bash
createuser -s test_user
psql -c "ALTER USER test_user WITH PASSWORD 'test_pwd';"
createdb -O test_user engoal_lite_test
```

---

## Running Tests

### Backend

Unit and integration tests run against **SQLite in-memory** (no database setup needed):

```bash
cd backend

# Run the full suite
uv run pytest tests/ -v --tb=short --cov=app --cov-report=term-missing

# Lint and type-check
uv run ruff check .
uv run mypy app/
```

**Before every push, all must pass:**

```bash
uv run ruff format . && uv run ruff check . && uv run mypy app/ && uv run pytest tests/
```

### Frontend

```bash
cd frontend

# Unit and integration tests (Vitest)
npm run test          # watch mode
npx vitest run        # single run (CI equivalent)

# Lint and type-check
npm run lint
npx tsc --noEmit

# E2E tests (Playwright — requires a running backend + Postgres)
npm run test:e2e
```

**Before every push, all must pass:**

```bash
npm run lint && npm run build && npx vitest run
```

---

## CI/CD

### Workflows

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `ci-frontend.yml` | PR to `main` (frontend changes) | ESLint · tsc · Vitest · next build · Playwright |
| `ci-backend.yml` | PR to `main` (backend changes) | ruff · mypy · pytest (with Postgres service via Docker) |
| `deploy.yml` | Push to `main` | SSH deploy to DigitalOcean Droplet |

> CI uses `docker-compose.test.yml` to spin up a Postgres test database on port 5433.
> Locally, unit/integration tests use SQLite in-memory instead.

### Deploy flow

On every merge to `main`, the deploy workflow:
1. Pulls latest code on the Droplet
2. Runs Alembic migrations
3. Restarts the FastAPI backend (systemd)
4. Builds the Next.js frontend
5. Restarts the Next.js frontend (systemd)
6. Runs health checks (on-server + external)

### Required GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `DO_HOST` | Droplet IP or hostname |
| `DO_USER` | SSH username on the Droplet |
| `DO_SSH_KEY` | Private SSH key for deployment |

### Health endpoint

`GET /api/v1/health` — returns `200 OK` with version info. Used by deploy workflow to verify the stack is up after each deploy.

---

## Project Structure

```
Engoal-lite/
├── .github/
│   ├── pull_request_template.md
│   └── workflows/
│       ├── ci-frontend.yml
│       ├── ci-backend.yml
│       └── deploy.yml
├── backend/               # FastAPI application
│   ├── app/
│   ├── alembic/
│   ├── tests/
│   ├── pyproject.toml
│   └── uv.lock
├── frontend/              # Next.js application
│   ├── src/
│   │   └── tests/         # Vitest unit + integration tests
│   └── package.json
├── docker-compose.test.yml    # Test Postgres database (port 5433)
├── .gitignore
└── README.md
```

---

## Agentic Development Workflow

This project follows the [Alteeza Lab SDLC](~/.claude/CLAUDE.md):

1. Work in a git worktree: `wt create trees/<feature-name> -b feat/<feature-name>`
2. Implement and test locally (all tests must pass)
3. Push and open a PR — CI runs automatically
4. Human Orchestrator reviews and merges
5. Merge to `main` triggers automatic deploy

Never push directly to `main`. Never merge your own PR.
