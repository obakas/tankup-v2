from pydantic import BaseModel


class UserBase(BaseModel):
    name: str
    phone: str
    address: str
    # email: str
    # password: str


class UserCreate(UserBase):
    name: str
    phone: str
    address: str


class UserUpdate(BaseModel):
    name: str | None = None
    address: str | None = None


class UserOut(UserBase):
    id: int

    class Config:
        from_attributes = True