"""FastAPI application factory."""

import logging
import logging.config

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api import auth, dashboard, entries, goals, health, investments
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.middleware import SecurityHeadersMiddleware

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

# ---------------------------------------------------------------------------
# Rate limiter (shared instance)
# ---------------------------------------------------------------------------

limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])


def create_app() -> FastAPI:
    """Application factory — returns a configured FastAPI instance."""
    app = FastAPI(
        title="Engoal-lite API",
        description="Personal financial goal tracker — FastAPI backend",
        version="1.0.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )

    # -----------------------------------------------------------------------
    # Middleware (applied in reverse registration order)
    # -----------------------------------------------------------------------

    # Security headers
    app.add_middleware(SecurityHeadersMiddleware)

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
        max_age=600,
    )

    # -----------------------------------------------------------------------
    # Rate limiting
    # -----------------------------------------------------------------------
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

    # -----------------------------------------------------------------------
    # Exception handlers
    # -----------------------------------------------------------------------
    register_exception_handlers(app)

    # -----------------------------------------------------------------------
    # Routers
    # -----------------------------------------------------------------------
    api_prefix = "/api/v1"
    app.include_router(health.router, prefix=api_prefix)
    app.include_router(auth.router, prefix=api_prefix)
    app.include_router(goals.router, prefix=api_prefix)
    app.include_router(investments.router, prefix=api_prefix)
    app.include_router(entries.router, prefix=api_prefix)
    app.include_router(dashboard.router, prefix=api_prefix)

    return app


# Module-level app instance for uvicorn
app = create_app()
