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
    phone: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyResetCodeRequest(BaseModel):
    email: EmailStr
    code: str


class VerifyResetCodeResponse(BaseModel):
    reset_token: str


class ResetPasswordConfirmRequest(BaseModel):
    reset_token: str
    new_password: str


class AdminSendEmailRequest(BaseModel):
    target: str  # 'all' | 'user'
    user_id: Optional[int] = None
    subject: str
    message: str
    include_admins: Optional[bool] = False


class PublicStatsOut(BaseModel):
    users_count: int
    posts_count: int

class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: Optional[str]
    phone: Optional[str]
    is_admin: bool
    class Config:
        orm_mode = True

class ApartmentBase(BaseModel):
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    rooms: Optional[int] = 1
    rent: Optional[int] = 0
    listing_type: Optional[str] = 'offer'

    # Listing attributes / filters
    gender: Optional[str] = None  # 'male' | 'female'
    shomer_shabbos: Optional[bool] = False
    shomer_kashrut: Optional[bool] = False
    opposite_gender_allowed: Optional[bool] = False
    smoking_allowed: Optional[bool] = False

class ApartmentCreate(ApartmentBase):
    pass

class ApartmentOut(ApartmentBase):
    id: int
    owner_id: int
    owner_name: Optional[str]
    class Config:
        orm_mode = True


class OwnerApplicationsOut(BaseModel):
    apartment: dict
    applications: list
    class Config:
        orm_mode = True

class ApplicationCreate(BaseModel):
    message: Optional[str] = None


class ApplicationOut(BaseModel):
    id: int
    message: Optional[str]
    status: str
    applicant_id: int
    applicant_name: Optional[str]
    applicant_phone: Optional[str]
    apartment_id: int
    class Config:
        orm_mode = True


class ApplicationDetailOut(BaseModel):
    id: int
    message: Optional[str]
    status: str
    applicant_id: int
    applicant_name: Optional[str]
    applicant_phone: Optional[str]
    owner_id: int
    owner_name: Optional[str]
    owner_phone: Optional[str]
    apartment_id: int
    apartment_title: Optional[str]
    class Config:
        orm_mode = True
