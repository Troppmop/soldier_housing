from pydantic import BaseModel, EmailStr
from typing import Optional, List

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None

class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: Optional[str]
    is_admin: bool
    class Config:
        orm_mode = True

class ApartmentBase(BaseModel):
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    rooms: Optional[int] = 1
    rent: Optional[int] = 0

class ApartmentCreate(ApartmentBase):
    pass

class ApartmentOut(ApartmentBase):
    id: int
    owner_id: int
    class Config:
        orm_mode = True

class ApplicationCreate(BaseModel):
    message: Optional[str] = None

class ApplicationOut(BaseModel):
    id: int
    message: Optional[str]
    applicant_id: int
    apartment_id: int
    class Config:
        orm_mode = True
