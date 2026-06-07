from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(tags=["health"])

@router.get("/healthz")
def healthz():
    return {
        "ok": True,
        "storage_configured": bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY),
    }