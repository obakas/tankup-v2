from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.core.security import create_access_token, verify_password
from app.models.admin_user import AdminUser
from app.schemas.admin_auth import AdminLoginRequest, TokenResponse, AdminMeResponse

router = APIRouter(prefix="/admin", tags=["Admin Auth"])


@router.post("/login", response_model=TokenResponse)
def admin_login(payload: AdminLoginRequest, db: Session = Depends(get_db)):
    admin = db.query(AdminUser).filter(AdminUser.username == payload.username).first()

    if not admin or not admin.is_active or not verify_password(payload.password, admin.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials",
        )

    access_token = create_access_token(
        {
            "sub": str(admin.id),
            "role": admin.role,
            "hub_id": admin.hub_id,
            "username": admin.username,
        }
    )

    return TokenResponse(access_token=access_token)


@router.get("/me", response_model=AdminMeResponse)
def admin_me(current_admin: dict = Depends(require_admin)):
    return AdminMeResponse(
        username=current_admin.get("username", "admin"),
        role=current_admin.get("role", "admin"),
        hub_id=current_admin.get("hub_id"),
    )
