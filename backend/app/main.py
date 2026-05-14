from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# from fastapi_cloud_cli.logging import setup_logging

from app.core.database import Base, engine
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
)
from app.core.logging_config import setup_logging
from app.middleware.request_logging import RequestLoggingMiddleware

setup_logging()

app = FastAPI()


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

origins = [
    settings.FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "http://172.27.163.209:8080",
    "http://192.168.8.189:8000"
]

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