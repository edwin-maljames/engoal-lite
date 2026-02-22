# Engoal-lite

Personal Financial Planning App — built on the Alteeza Lab agentic stack.

## Tech Stack

| Layer | Tool |
|-------|------|
| Frontend | Next.js (App Router) · TypeScript · Tailwind CSS |
| Backend | FastAPI · Python 3.12 · SQLAlchemy · Alembic |
| Database | PostgreSQL 16 |
| Package managers | npm (frontend) · uv (backend) |
| Tests | Vitest + Playwright (frontend) · pytest (backend) |
| Deployment | DigitalOcean Droplet · systemd · Nginx |

---

## Local Development Setup

### Prerequisites

- Docker and Docker Compose
- Node.js 24+ (for frontend work outside Docker)
- Python 3.12+ and [uv](https://docs.astral.sh/uv/) (for backend work outside Docker)

### 1. Clone the repository

```bash
git clone git@github.com:edwin-maljames/Engoal-lite.git
cd Engoal-lite
```

### 2. Configure environment variables

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your local values

# Frontend
cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local with your local values
```

Required variables — see `.env.example` files at each layer for full list:

| Variable | Location | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | `backend/.env` | PostgreSQL connection string |
| `SECRET_KEY` | `backend/.env` | JWT signing secret |
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | Backend API base URL |

### 3. Start with Docker Compose (recommended)

```bash
docker compose up
```

This starts:
- **PostgreSQL 16** on `localhost:5432`
- **FastAPI backend** on `localhost:8000`
- **Next.js frontend** on `localhost:3000`

The backend runs with `--reload` and the frontend volume-mounts source for hot reload.

### 4. Start manually (alternative)

If you prefer running services outside Docker:

```bash
# Terminal 1 — Start the test/dev database
docker compose -f docker-compose.test.yml up

# Terminal 2 — Backend
cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8000

# Terminal 3 — Frontend
cd frontend
npm install
npm run dev
```

---

## Running Tests

### Backend

```bash
cd backend

# Start the test database (port 5433 — separate from dev DB)
docker compose -f ../docker-compose.test.yml up -d

# Run the full suite
DATABASE_URL=postgresql://engoal_lite_test:test_password@localhost:5433/engoal_lite_test \
  uv run pytest tests/ -v --tb=short --cov=app --cov-report=term-missing

# Lint and type-check
uv run ruff check .
uv run mypy app/
```

**Before every push, all three must pass:**

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

# E2E tests (Playwright — requires a running backend)
npm run test:e2e
```

**Before every push, all three must pass:**

```bash
npm run lint && npm run build && npx vitest run
```

---

## CI/CD

### Workflows

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `ci-frontend.yml` | PR to `main` (frontend changes) | ESLint · tsc · Vitest · next build · Playwright |
| `ci-backend.yml` | PR to `main` (backend changes) | ruff · mypy · pytest (with Postgres service) |
| `deploy.yml` | Push to `main` | SSH deploy to DigitalOcean Droplet |

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

`GET /api/health` — returns `200 OK` with DB status. Used by deploy workflow to verify the stack is up after each deploy.

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
│   ├── tests/
│   ├── e2e/
│   └── package.json
├── docker-compose.yml         # Local dev stack
├── docker-compose.test.yml    # Test database only (port 5433)
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
