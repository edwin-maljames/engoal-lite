"""
Shared pytest fixtures for unit and integration tests.

Uses SQLite in-memory — no external database required.
E2E tests (post-merge) use Postgres via backend/.env.test.
"""

from __future__ import annotations

import os
from typing import TYPE_CHECKING, Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator

# ---------------------------------------------------------------------------
# Test database — set via env var, fall back to the default test container URL
# ---------------------------------------------------------------------------
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "sqlite+aiosqlite:///:memory:",
)

# Ensure config picks up the test DB before importing anything that triggers settings
os.environ.setdefault("DATABASE_URL", TEST_DATABASE_URL)
os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long!")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "15")
os.environ.setdefault("REFRESH_TOKEN_EXPIRE_DAYS", "7")
os.environ.setdefault("DEBUG", "false")
os.environ.setdefault("ALLOWED_ORIGINS", '["http://localhost:3000"]')


# ---------------------------------------------------------------------------
# anyio backend (use asyncio for all async fixtures and tests)
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


# ---------------------------------------------------------------------------
# Database — created once per test session, dropped at teardown
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
async def engine() -> AsyncGenerator[Any, None]:
    import app.models  # noqa: F401 — register all models
    from app.db.base import Base

    _is_sqlite = TEST_DATABASE_URL.startswith("sqlite")
    _engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        **({} if _is_sqlite else {"pool_pre_ping": True}),
    )
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield _engine
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await _engine.dispose()


# ---------------------------------------------------------------------------
# Per-test database session with rollback isolation
# ---------------------------------------------------------------------------
@pytest.fixture
async def db_session(engine: Any) -> AsyncGenerator[AsyncSession, None]:
    """Provide an isolated session that rolls back after each test."""
    session_factory: async_sessionmaker[AsyncSession] = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with session_factory() as session:
        yield session
        await session.rollback()


# ---------------------------------------------------------------------------
# FastAPI app with dependency override pointing at the test session
# ---------------------------------------------------------------------------
@pytest.fixture
async def app(db_session: AsyncSession) -> AsyncGenerator[Any, None]:
    from app.db.session import get_db
    from app.main import create_app

    _app = create_app()

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    _app.dependency_overrides[get_db] = _override_get_db
    yield _app
    _app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Async HTTP client
# ---------------------------------------------------------------------------
@pytest.fixture
async def client(app: Any) -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test/api/v1",
    ) as c:
        yield c


# ---------------------------------------------------------------------------
# Seed fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
async def test_user(db_session: AsyncSession) -> Any:
    """Create and return a test user (not committed — session-scoped rollback handles cleanup)."""
    from app.core.security import hash_password
    from app.models.user import User

    user = User(
        email="test@engoal-lite.app",
        hashed_password=hash_password("TestPass123!@"),
        full_name="Test User",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.fixture
async def auth_headers(client: AsyncClient, test_user: Any) -> dict[str, str]:
    """Log in and return Bearer auth headers."""
    response = await client.post(
        "/auth/login",
        json={"email": "test@engoal-lite.app", "password": "TestPass123!@"},
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def test_goal(db_session: AsyncSession, test_user: Any) -> Any:
    """Create and return a test goal."""
    from datetime import date
    from decimal import Decimal

    from app.models.goal import Goal, GoalStatus

    goal = Goal(
        user_id=test_user.id,
        name="Test Retirement Goal",
        description="A test goal",
        target_amount=Decimal("5000000.00"),
        target_date=date(2045, 6, 1),
        status=GoalStatus.ACTIVE,
    )
    db_session.add(goal)
    await db_session.flush()
    return goal


@pytest.fixture
async def test_investment(db_session: AsyncSession, test_user: Any, test_goal: Any) -> Any:
    """Create and return a test investment."""
    from decimal import Decimal

    from app.models.investment import AssetClass, Investment

    inv = Investment(
        goal_id=test_goal.id,
        user_id=test_user.id,
        name="Nifty 50 Index Fund",
        asset_class=AssetClass.EQUITY_MF,
        expected_cagr=Decimal("12.00"),
        is_active=True,
    )
    db_session.add(inv)
    await db_session.flush()
    return inv
