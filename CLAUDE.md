# Project Rules — <Project Name>

This file sits at the **monorepo root** and extends the global Alteeza Lab rules at `~/.claude/CLAUDE.md`.
Stack-specific rules live in `frontend/CLAUDE.md` (React) and `backend/CLAUDE.md` (Python).

---

## Repo Structure

```
<project-name>/
├── CLAUDE.md                  ← this file — shared, cross-stack rules
├── frontend/
│   ├── CLAUDE.md              ← React/Next.js/Vitest rules
│   ├── package.json
│   └── src/
├── backend/
│   ├── CLAUDE.md              ← Python/pytest/ruff rules
│   ├── pyproject.toml
│   └── src/
├── .github/
│   ├── pull_request_template.md
│   └── workflows/
│       ├── ci-frontend.yml
│       └── ci-backend.yml
└── README.md
```

---

## Running the Project Locally

```bash
# Backend (from repo root)
cd backend && uv run uvicorn src.main:app --reload --port 8000

# Frontend (from repo root, in a separate terminal)
cd frontend && npm run dev
```

Both must be running for full local development.

---

## Database

### Environment model

| Context | Engine | `DATABASE_URL` |
|---------|--------|----------------|
| Worktree dev (local run) | SQLite | `sqlite:///./engoal_lite_dev.db` |
| Unit / integration tests (pre-push) | SQLite in-memory | `sqlite:///:memory:` |
| E2E tests (post-merge, local Mac) | Postgres on local Mac | `postgresql://test_user:test_pwd@localhost:5432/engoal_lite_test` |
| CI | Postgres via `docker-compose.test.yml` | `postgresql://test_user:test_pwd@localhost:5433/engoal_lite_test` |

### Rules

- **Dev always uses SQLite** — no Docker, no port conflicts, one file per worktree.
- **Never write raw SQL or use Postgres-specific features** (JSONB, arrays, `ON CONFLICT DO UPDATE`, `ILIKE`) in application code. Use the ORM for all queries. These silently pass SQLite tests but break in Postgres.
- **E2E and CI always use Postgres** — this is the hard gate before anything ships.
- **SQLite `.db` files are gitignored** — never commit them.

### One-time local Mac Postgres setup

```bash
createuser -s test_user
psql -c "ALTER USER test_user WITH PASSWORD 'test_pwd';"
createdb -O test_user engoal_lite_test
```

---

## Shared Environment Variables

Create `.env` files at the appropriate layer — never at repo root.

| Variable | Location | Dev value | Test value |
|----------|----------|-----------|------------|
| `DATABASE_URL` | `backend/.env` / `backend/.env.test` | `sqlite:///./engoal_lite_dev.db` | `postgresql://test_user:test_pwd@localhost:5432/engoal_lite_test` |
| `SECRET_KEY` | `backend/.env` / `backend/.env.test` | any random string | any random string |
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` / `frontend/.env.test.local` | `http://localhost:8000/api` | `http://localhost:8000/api` |

Copy from the `.example` files — never commit the actual `.env` files:

```bash
cp backend/.env.example backend/.env
cp backend/.env.test.example backend/.env.test
cp frontend/.env.local.example frontend/.env.local
cp frontend/.env.test.local.example frontend/.env.test.local
```

---

## API Contract

- Backend exposes a REST API (or fill in: GraphQL / tRPC)
- Base path: `/api/v1/`
- All responses follow this envelope:
  ```json
  { "data": ..., "error": null }
  { "data": null, "error": { "code": "...", "message": "..." } }
  ```
- Authentication: Bearer token in `Authorization` header
- When an agent changes a backend endpoint, it must also update the frontend API client in the same PR

---

## Agent Navigation Rules

When implementing a feature that touches both stacks, the agent must:

1. `cd backend/` — implement and test the API endpoint first
2. `cd frontend/` — implement the UI against the new endpoint
3. Open a single PR covering both changes

Never open separate PRs for the frontend and backend halves of the same feature — reviewers need to see the full change together.

---

## Cross-Stack Code Standards

- **API errors:** Backend returns structured error codes (e.g., `USER_NOT_FOUND`). Frontend must handle them explicitly — no generic "something went wrong" catch-alls.
- **Types:** If the project uses OpenAPI / tRPC, regenerate the client types whenever the backend schema changes. Do not hand-edit generated files.
- **Dates:** Always UTC from the backend. Frontend formats for display only.
- **Auth:** Session tokens are stored in httpOnly cookies — never in localStorage.
