"""Application exception hierarchy and FastAPI exception handlers."""

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.status import (
    HTTP_400_BAD_REQUEST,
    HTTP_401_UNAUTHORIZED,
    HTTP_403_FORBIDDEN,
    HTTP_404_NOT_FOUND,
    HTTP_409_CONFLICT,
    HTTP_422_UNPROCESSABLE_CONTENT,
    HTTP_429_TOO_MANY_REQUESTS,
    HTTP_500_INTERNAL_SERVER_ERROR,
)

logger = logging.getLogger("engoal_lite")


# ---------------------------------------------------------------------------
# Base exception
# ---------------------------------------------------------------------------


class AppException(Exception):
    """Base application exception with structured detail payload."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        field: str | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.field = field


# ---------------------------------------------------------------------------
# Concrete exception types
# ---------------------------------------------------------------------------


class BadRequestException(AppException):
    def __init__(self, message: str, field: str | None = None) -> None:
        super().__init__(HTTP_400_BAD_REQUEST, "BAD_REQUEST", message, field)


class InvalidCredentialsException(AppException):
    def __init__(self) -> None:
        super().__init__(
            HTTP_401_UNAUTHORIZED,
            "INVALID_CREDENTIALS",
            "Invalid email or password.",
        )


class TokenExpiredException(AppException):
    def __init__(self) -> None:
        super().__init__(
            HTTP_401_UNAUTHORIZED,
            "TOKEN_EXPIRED",
            "Access token has expired.",
        )


class TokenInvalidException(AppException):
    def __init__(self) -> None:
        super().__init__(
            HTTP_401_UNAUTHORIZED,
            "TOKEN_INVALID",
            "Access token is invalid.",
        )


class ForbiddenException(AppException):
    def __init__(self, message: str = "Access forbidden.") -> None:
        super().__init__(HTTP_403_FORBIDDEN, "FORBIDDEN", message)


class NotFoundException(AppException):
    def __init__(self, resource: str, resource_id: str | None = None) -> None:
        msg = (
            f"{resource} with ID '{resource_id}' not found."
            if resource_id
            else f"{resource} not found."
        )
        super().__init__(HTTP_404_NOT_FOUND, "RESOURCE_NOT_FOUND", msg)


class ConflictException(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(HTTP_409_CONFLICT, "CONFLICT", message)


class ValidationException(AppException):
    def __init__(self, message: str, field: str | None = None) -> None:
        super().__init__(HTTP_422_UNPROCESSABLE_CONTENT, "VALIDATION_ERROR", message, field)


class RateLimitException(AppException):
    def __init__(self) -> None:
        super().__init__(
            HTTP_429_TOO_MANY_REQUESTS,
            "RATE_LIMITED",
            "Too many requests. Please try again later.",
        )


# ---------------------------------------------------------------------------
# Registration helper
# ---------------------------------------------------------------------------


def register_exception_handlers(app: FastAPI) -> None:
    """Register all exception handlers on the FastAPI app."""

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
        error_body: dict[str, object] = {
            "code": exc.code,
            "message": exc.message,
        }
        if exc.field is not None:
            error_body["field"] = exc.field
        return JSONResponse(
            status_code=exc.status_code,
            content={"data": None, "error": error_body},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception on %s %s", request.method, request.url)
        return JSONResponse(
            status_code=HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "data": None,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "An unexpected error occurred.",
                },
            },
        )
