import re
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
# from fastapi_cloud_cli.logging import setup_logging

from app.core.database import Base, engine
from app.models import driver_earning  # noqa: F401
from app.core.scheduler import start_scheduler, stop_scheduler
from app.core.config import settings
from app.api.routes import (
    requests,
    batches,
    tankers,
    payments,
    auth,
    users,
    batch_members,
    refunds,
    deliveries,
    histories,
    admins,
    healths,
    admin_auth,
    notifications,
    sites,
    incidents,
)
from app.core.logging_config import setup_logging
from app.middleware.request_logging import RequestLoggingMiddleware

setup_logging()

_NAIVE_DT_RE = re.compile(
    r'"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?)"'
)


class UTCDatetimeMiddleware:
    """Appends Z to naive ISO 8601 datetime strings in JSON responses."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        response_started = False
        response_headers = None
        response_status = None
        body_chunks: list[bytes] = []
        is_json = False

        async def send_wrapper(message):
            nonlocal response_started, response_headers, response_status, is_json

            if message["type"] == "http.response.start":
                response_status = message["status"]
                headers = dict(message.get("headers", []))
                content_type = headers.get(b"content-type", b"").decode()
                is_json = content_type.startswith("application/json")
                response_headers = message
                if not is_json:
                    await send(message)
                response_started = True

            elif message["type"] == "http.response.body":
                if not is_json:
                    await send(message)
                    return
                body_chunks.append(message.get("body", b""))
                if not message.get("more_body", False):
                    full_body = b"".join(body_chunks)
                    fixed = _NAIVE_DT_RE.sub(r'"\1Z"', full_body.decode("utf-8"))
                    fixed_bytes = fixed.encode("utf-8")
                    new_headers = []
                    for k, v in response_headers.get("headers", []):
                        if k.lower() == b"content-length":
                            new_headers.append((b"content-length", str(len(fixed_bytes)).encode()))
                        else:
                            new_headers.append((k, v))
                    await send({
                        "type": "http.response.start",
                        "status": response_status,
                        "headers": new_headers,
                    })
                    await send({
                        "type": "http.response.body",
                        "body": fixed_bytes,
                        "more_body": False,
                    })
            else:
                await send(message)

        await self.app(scope, receive, send_wrapper)


app = FastAPI()


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": str(exc)})


@app.on_event("startup")
def on_startup():
    start_scheduler()


@app.on_event("shutdown")
def on_shutdown():
    stop_scheduler()

@app.get("/")
def health_check():
    return {"status": "ok"}


# Base.metadata.create_all(bind=engine)
if settings.DATABASE_URL.startswith("sqlite"):
    Base.metadata.create_all(bind=engine)

# origins = [
#     settings.FRONTEND_URL,
#     "http://localhost:5173",
#     "http://127.0.0.1:5173",
# ]

origins = [settings.FRONTEND_URL]
if settings.DEBUG:
    origins += [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
    ]

app.add_middleware(UTCDatetimeMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    # allow_origins={"*"},
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(requests.router)
app.include_router(batches.router)
app.include_router(tankers.router)
app.include_router(payments.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(batch_members.router)
app.include_router(refunds.router)
app.include_router(deliveries.router)
app.include_router(histories.router)
app.include_router(admins.router)
app.include_router(healths.router)
app.add_middleware(RequestLoggingMiddleware)
app.include_router(admin_auth.router)
app.include_router(notifications.router)
app.include_router(sites.router)
app.include_router(incidents.router)