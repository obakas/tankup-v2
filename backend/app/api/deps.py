from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import verify_token

from app.core.database import SessionLocal

from jose import JWTError, jwt


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

bearer_scheme = HTTPBearer()


def require_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    token = credentials.credentials
    payload = verify_token(token)

    if payload.get("sub") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return payload

# from app.core.database import SessionLocal

# def get_db():
#     db = SessionLocal()
#     try:
#         yield db
#     finally:
#         db.close()

# app/api/deps.py
# from fastapi import Depends, HTTPException, status
# from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
# from jose import JWTError, jwt
# from sqlalchemy.orm import Session

# from app.core.config import settings
# from app.core.database import get_db
# from app.models.admin_user import AdminUser

# security = HTTPBearer()


# def get_current_admin_user(
#     credentials: HTTPAuthorizationCredentials = Depends(security),
#     db: Session = Depends(get_db),
# ) -> AdminUser:
#     token = credentials.credentials

#     try:
#         payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
#         admin_id = payload.get("sub")
#         token_type = payload.get("type")

#         if not admin_id or token_type != "admin":
#             raise HTTPException(
#                 status_code=status.HTTP_401_UNAUTHORIZED,
#                 detail="Invalid token",
#             )
#     except JWTError:
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED,
#             detail="Could not validate credentials",
#         )

#     admin = db.query(AdminUser).filter(AdminUser.id == int(admin_id)).first()
#     if not admin or not admin.is_active:
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED,
#             detail="Admin user not found or inactive",
#         )

#     return admin