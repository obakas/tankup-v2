from fastapi import APIRouter, HTTPException, Depends, status

from app.api.deps import require_admin
from app.core.config import settings
from app.core.security import create_access_token
from app.schemas.admin_auth import AdminLoginRequest, TokenResponse, AdminMeResponse

router = APIRouter(prefix="/admin", tags=["Admin Auth"])


@router.post("/login", response_model=TokenResponse)
def admin_login(payload: AdminLoginRequest):
    if payload.username != settings.ADMIN_USERNAME or payload.password != settings.ADMIN_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials",
        )

    access_token = create_access_token(
        {
            "sub": "admin",
            "role": "admin",
            "username": payload.username,
        }
    )

    return TokenResponse(access_token=access_token)


@router.get("/me", response_model=AdminMeResponse)
def admin_me(payload: dict = Depends(require_admin)):
    return AdminMeResponse(username=payload.get("username", "admin"))
