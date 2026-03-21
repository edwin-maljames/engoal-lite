"""Custom middleware — security headers (pure ASGI, not BaseHTTPMiddleware)."""

from typing import TYPE_CHECKING

from starlette.datastructures import MutableHeaders

if TYPE_CHECKING:
    from starlette.types import ASGIApp, Message, Receive, Scope, Send


class SecurityHeadersMiddleware:
    """
    Attach security headers to every HTTP response.

    Implemented as a pure ASGI middleware (not BaseHTTPMiddleware) to avoid
    greenlet-context issues with asyncpg in async test environments.
    """

    def __init__(self, app: "ASGIApp") -> None:
        self.app = app

    async def __call__(self, scope: "Scope", receive: "Receive", send: "Send") -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_headers(message: "Message") -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers.append(
                    "Strict-Transport-Security",
                    "max-age=31536000; includeSubDomains; preload",
                )
                headers.append("X-Content-Type-Options", "nosniff")
                headers.append("X-Frame-Options", "DENY")
                headers.append("X-XSS-Protection", "0")
                headers.append("Referrer-Policy", "strict-origin-when-cross-origin")
                headers.append(
                    "Content-Security-Policy",
                    (
                        "default-src 'self'; "
                        "script-src 'self'; "
                        "style-src 'self' 'unsafe-inline'; "
                        "img-src 'self' data:; "
                        "font-src 'self'; "
                        "connect-src 'self'; "
                        "frame-ancestors 'none';"
                    ),
                )
                headers.append("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
            await send(message)

        await self.app(scope, receive, send_with_headers)
