from pydantic import BaseModel


class UserBase(BaseModel):
    name: str
    phone: str
    address: str
    email: str | None = None


class UserCreate(UserBase):
    name: str
    phone: str
    address: str


class UserUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    email: str | None = None
    expo_push_token: str | None = None
    fcm_token: str | None = None


class UserOut(UserBase):
    id: int
    expo_push_token: str | None = None
    fcm_token: str | None = None

    class Config:
        from_attributes = True