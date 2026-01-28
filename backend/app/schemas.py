from pydantic import BaseModel, EmailStr
from typing import Optional, List
from uuid import UUID

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
    phone_number: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    phone_number: Optional[str] = None


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
    full_name: Optional[str] = None
    phone: Optional[str] = None
    phone_number: Optional[str] = None
    phone_verified: Optional[bool] = None
    is_admin: bool
    class Config:
        orm_mode = True


class MyPhoneOut(BaseModel):
    phone_number: Optional[str] = None
    phone_verified: bool = False


class MyPhoneUpdate(BaseModel):
    phone_number: Optional[str] = None

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


# -----------------------------
# External listings
# -----------------------------


class ExternalListingCreate(BaseModel):
    source: str
    url: str
    title: Optional[str] = None
    price: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None


class ExternalListingOut(BaseModel):
    id: UUID
    created_by_user_id: int
    source: str
    url: str
    title: Optional[str] = None
    price: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[str] = None
    interest_count: int = 0
    is_interested: bool = False

    class Config:
        orm_mode = True


class ExternalListingListOut(BaseModel):
    items: List[ExternalListingOut]
    total: int


# -----------------------------
# Contact requests
# -----------------------------


class ContactRequestCreate(BaseModel):
    target_user_id: int
    listing_id: UUID


class ContactRequestOut(BaseModel):
    id: UUID
    requester_user_id: int
    target_user_id: int
    listing_id: UUID
    status: str
    created_at: Optional[str] = None

    class Config:
        orm_mode = True


class IncomingContactRequestOut(BaseModel):
    id: UUID
    requester_user_id: int
    target_user_id: int
    listing_id: UUID
    status: str
    created_at: Optional[str] = None
    requester_name: Optional[str] = None
    requester_email: Optional[EmailStr] = None
    listing_title: Optional[str] = None
    listing_url: Optional[str] = None


class ContactInfoOut(BaseModel):
    listing_id: UUID
    requester_user_id: int
    target_user_id: int
    requester_phone_number: str
    target_phone_number: str


# -----------------------------
# Community
# -----------------------------


class CommunityPostCreate(BaseModel):
    title: Optional[str] = None
    body: str


class CommunityPostOut(BaseModel):
    id: int
    created_by_user_id: int
    created_by_name: Optional[str] = None
    title: Optional[str] = None
    body: str
    is_pinned: bool = False
    created_at: Optional[str] = None
    comments_count: int = 0


class CommunityCommentCreate(BaseModel):
    body: str


class CommunityCommentOut(BaseModel):
    id: int
    post_id: int
    created_by_user_id: int
    created_by_name: Optional[str] = None
    body: str
    created_at: Optional[str] = None


class CommunityEventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    starts_at: str


class CommunityEventOut(BaseModel):
    id: int
    created_by_user_id: int
    created_by_name: Optional[str] = None
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    starts_at: str
    status: str
    created_at: Optional[str] = None


class CommunityUserOut(BaseModel):
    id: int
    full_name: Optional[str] = None


class CommunityMessageSendIn(BaseModel):
    recipient_user_id: int
    body: str


class CommunityMessageOut(BaseModel):
    id: int
    sender_user_id: int
    recipient_user_id: int
    sender_name: Optional[str] = None
    recipient_name: Optional[str] = None
    body: str
    created_at: Optional[str] = None
    is_read: bool = False


# -----------------------------
# Resources
# -----------------------------


class ResourceItemCreate(BaseModel):
    title: str
    category: Optional[str] = None
    description: Optional[str] = None
    url: Optional[str] = None


class ResourceItemOut(BaseModel):
    id: int
    created_by_user_id: int
    created_by_name: Optional[str] = None
    title: str
    category: Optional[str] = None
    description: Optional[str] = None
    url: Optional[str] = None
    status: Optional[str] = None
    created_at: Optional[str] = None
    is_saved: bool = False


# -----------------------------
# Jobs
# -----------------------------


class JobListingCreate(BaseModel):
    title: str
    company: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    apply_url: Optional[str] = None
    salary: Optional[str] = None


class JobListingOut(BaseModel):
    id: int
    created_by_user_id: int
    created_by_name: Optional[str] = None
    title: str
    company: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    apply_url: Optional[str] = None
    salary: Optional[str] = None
    status: Optional[str] = None
    created_at: Optional[str] = None
    is_saved: bool = False


class JobApplicationCreate(BaseModel):
    message: Optional[str] = None


class JobApplicationOut(BaseModel):
    id: int
    job_id: int
    user_id: int
    user_name: Optional[str] = None
    message: Optional[str] = None
    created_at: Optional[str] = None


# -----------------------------
# Push
# -----------------------------


class VapidPublicKeyOut(BaseModel):
    public_key: str


class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionIn(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys


class PushUnsubscribeIn(BaseModel):
    endpoint: str


# -----------------------------
# Admin
# -----------------------------


class AdminSendNotificationRequest(BaseModel):
    target: str  # 'all' | 'user'
    user_id: Optional[int] = None
    title: Optional[str] = None
    message: str
    include_admins: Optional[bool] = False
