from pydantic import BaseModel


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AdminMeResponse(BaseModel):
    username: str
    role: str = "admin"
    is_active: bool = True
