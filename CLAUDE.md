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

## Shared Environment Variables

Create `.env` files at the appropriate layer — never at repo root.

| Variable | Location | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | `backend/.env` | Postgres connection string |
| `SECRET_KEY` | `backend/.env` | App secret for JWT / sessions |
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | Backend API base URL |

Use `.env.example` files (no real values) at each layer so agents know what variables are required.

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
