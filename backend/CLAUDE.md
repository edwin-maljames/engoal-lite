# Project Rules — Python

This file extends the global Alteeza Lab rules at `~/.claude/CLAUDE.md`.
Stack: **Python · pytest · ruff · uv**

---

## Tech Stack

| Layer | Tool |
|-------|------|
| Language | Python 3.12+ |
| Unit + Integration tests | pytest |
| Linter + Formatter | ruff |
| Type checker | mypy |
| Package manager | uv (preferred) or pip + `requirements.txt` |
| E2E tests | Playwright (CI only, if applicable) |

---

## Commands

```bash
uv run pytest                  # run full test suite (must pass before push)
uv run ruff check .            # lint — fix all errors before pushing
uv run ruff format .           # format — run before every commit
uv run mypy .                  # type check — fix all errors before pushing
```

If the project uses `pip` instead of `uv`:
```bash
source .venv/bin/activate      # always activate venv first
pytest
ruff check .
ruff format .
mypy .
```

**Before every push, run in this order:**
```bash
uv run ruff format . && uv run ruff check . && uv run mypy . && uv run pytest
```
All must pass. Do not push if any fails.

---

## Testing Standards

### Unit tests (pytest)
- Co-locate tests in a `tests/` directory mirroring the source structure
- File naming: `test_<module>.py`
- Test every public function — aim for 100% coverage on business logic
- Use `pytest.fixture` for shared setup, not `setUp/tearDown`

### Integration tests (pytest)
- Use `pytest-httpx` or `responses` to mock external HTTP calls
- Never call real external APIs in tests — always mock them
- Database tests use SQLite in-memory (`sqlite:///:memory:`) via a test-scoped fixture — no Postgres needed locally

### E2E tests (Playwright — post-merge, local Mac + CI)
- Only for projects with a web UI or API that serves a frontend
- Live in `tests/e2e/`
- Run against **Postgres** (local Mac for manual runs, Docker via `docker-compose.test.yml` in CI)
- Requires `backend/.env.test` with `DATABASE_URL=postgresql://test_user:test_pwd@localhost:5432/engoal_lite_test`
- Do not block worktree pushes on E2E — these run after merge

---

## Code Standards

- **Type hints:** All function signatures must have type hints. No bare `def foo(x)`.
- **mypy:** Run in strict mode (`mypy --strict .` or via `pyproject.toml`). Fix all errors.
- **Imports:** Use absolute imports. No relative `from ..module import x` except inside packages.
- **Env vars:** Load via `pydantic-settings` or `python-dotenv` into a typed settings object — never `os.environ["X"]` scattered through code.
- **Secrets:** Never commit `.env` files. Use `.env.example` with placeholder values only.
- **Error handling:** Raise specific exceptions, not bare `Exception`. Catch specific types, not bare `except`.

---

## Project Setup (run once per new repo)

```bash
# Create and activate virtual environment with uv
uv venv && source .venv/bin/activate

# Install dependencies
uv pip install -e ".[dev]"     # if pyproject.toml with dev extras
# or
uv pip install -r requirements-dev.txt

# Copy PR template
mkdir -p .github && cp ~/dev/Alteeza/alteeza_lab/pr_template.md .github/pull_request_template.md

# Verify tests run
uv run pytest
```

