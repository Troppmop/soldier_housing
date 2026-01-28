import os
import time
import hmac
import hashlib
import secrets
from datetime import datetime
import threading
from collections import defaultdict, deque
from fastapi import FastAPI, Depends, HTTPException
from fastapi import Request
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from . import models, schemas, crud
from .database import engine, get_db, SessionLocal
from sqlalchemy import text, and_, or_, func
from sqlalchemy.exc import IntegrityError
from .auth import create_access_token, get_current_user
from . import config
from .emailer import send_password_reset_code, send_email
from uuid import UUID
from . import push

app = FastAPI(title="Soldier Housing API")


class _SlidingWindowRateLimiter:
    def __init__(self):
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def hit(self, key: str, *, limit: int, window_seconds: int) -> tuple[bool, int | None]:
        now = time.time()
        cutoff = now - float(window_seconds)

        with self._lock:
            dq = self._events[key]
            while dq and dq[0] < cutoff:
                dq.popleft()
            if len(dq) >= int(limit):
                # Retry when the oldest event falls out of window
                retry_after = int((dq[0] + float(window_seconds)) - now) + 1
                # best-effort cleanup
                if not dq:
                    self._events.pop(key, None)
                return False, max(1, retry_after)
            dq.append(now)
            return True, None

    def reset(self, key: str) -> None:
        with self._lock:
            self._events.pop(key, None)


_rate_limiter = _SlidingWindowRateLimiter()


def _get_client_ip(request: Request) -> str:
    # Works behind common proxies/load balancers.
    xff = request.headers.get('x-forwarded-for')
    if xff:
        # first IP in the list is the original client
        return xff.split(',')[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return 'unknown'


def _require_admin(current_user):
    if not getattr(current_user, 'is_admin', False):
        raise HTTPException(status_code=403, detail='Not authorized')


def _require_community_enabled():
    enabled = str(os.getenv('ENABLE_COMMUNITY', 'false')).strip().lower() in {'1', 'true', 'yes', 'on'}
    if not enabled:
        # 404 keeps the feature effectively hidden
        raise HTTPException(status_code=404, detail='Not found')

# CORS setup - allow localhost dev frontend by default
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173")
allow_origins = [o.strip() for o in origins.split(",")] if origins else ["*"]
print('CORS allow_origins:', allow_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    # create tables and default admin user if missing
    models.Base.metadata.create_all(bind=engine)
    # run lightweight ALTER TABLE migrations for added columns inside a committed transaction
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR"))
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE applications ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'pending'"))
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE apartments ADD COLUMN IF NOT EXISTS listing_type VARCHAR DEFAULT 'offer'"))
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE apartments ADD COLUMN IF NOT EXISTS gender VARCHAR"))
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE apartments ADD COLUMN IF NOT EXISTS shomer_shabbos BOOLEAN DEFAULT FALSE"))
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE apartments ADD COLUMN IF NOT EXISTS shomer_kashrut BOOLEAN DEFAULT FALSE"))
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE apartments ADD COLUMN IF NOT EXISTS opposite_gender_allowed BOOLEAN DEFAULT FALSE"))
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE apartments ADD COLUMN IF NOT EXISTS smoking_allowed BOOLEAN DEFAULT FALSE"))
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_hash VARCHAR"))
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_expires_at BIGINT"))
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR"))
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE"))
        except Exception:
            pass
    db: Session = SessionLocal()
    try:
        admin = crud.get_user_by_email(db, config.ADMIN_EMAIL)
        if not admin:
            from pydantic import BaseModel
            class Admin(BaseModel):
                email: str
                password: str
                full_name: str | None = None
            crud.create_user(db, Admin(email=config.ADMIN_EMAIL, password=config.ADMIN_PASSWORD), is_admin=True)
            print("Default admin created:", config.ADMIN_EMAIL)
    finally:
        db.close()


@app.post("/auth/register", response_model=schemas.UserOut)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = crud.get_user_by_email(db, user.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    new = crud.create_user(db, user)
    return new


@app.post("/auth/token", response_model=schemas.Token)
def login_for_access_token(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    ip = _get_client_ip(request)
    email = (form_data.username or '').strip().lower()

    ok, retry_after = _rate_limiter.hit(f'auth:token:ip:{ip}', limit=8, window_seconds=60)
    if not ok:
        raise HTTPException(
            status_code=429,
            detail='Too many login attempts. Please try again shortly.',
            headers={'Retry-After': str(retry_after)},
        )

    if email:
        ok2, retry_after2 = _rate_limiter.hit(f'auth:token:email:{email}', limit=10, window_seconds=600)
        if not ok2:
            raise HTTPException(
                status_code=429,
                detail='Too many login attempts for this account. Please try again later.',
                headers={'Retry-After': str(retry_after2)},
            )

    user = crud.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        # Small jittered delay to slow brute forcing even if attacker rotates IPs.
        time.sleep(0.25 + (secrets.randbelow(250) / 1000.0))
        raise HTTPException(status_code=400, detail="Incorrect username or password")

    # Successful login: clear account-specific limiter to reduce user friction.
    if email:
        _rate_limiter.reset(f'auth:token:email:{email}')
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/stats", response_model=schemas.PublicStatsOut)
def public_stats(db: Session = Depends(get_db)):
    users_count = db.query(models.User).count()
    posts_count = db.query(models.Apartment).count()
    return {"users_count": int(users_count), "posts_count": int(posts_count)}


def _reset_code_hash(code: str) -> str:
    key = (config.SECRET_KEY or "devsecret").encode("utf-8")
    msg = (code or "").encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).hexdigest()


@app.post("/auth/forgot-password")
def forgot_password(request: Request, body: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    ip = _get_client_ip(request)
    ok, retry_after = _rate_limiter.hit(f'auth:forgot:ip:{ip}', limit=5, window_seconds=60)
    if not ok:
        raise HTTPException(status_code=429, detail='Too many requests. Please try again shortly.', headers={'Retry-After': str(retry_after)})

    email = (body.email or '').strip().lower()
    if email:
        ok2, retry_after2 = _rate_limiter.hit(f'auth:forgot:email:{email}', limit=5, window_seconds=600)
        if not ok2:
            raise HTTPException(status_code=429, detail='Too many requests. Please try again later.', headers={'Retry-After': str(retry_after2)})

    # Always return ok to avoid user enumeration
    user = crud.get_user_by_email(db, body.email)
    if user:
        code = str(secrets.randbelow(1_000_000)).zfill(6)
        user.reset_code_hash = _reset_code_hash(code)
        user.reset_code_expires_at = int(time.time()) + (10 * 60)
        db.add(user)
        db.commit()

        # Best-effort email (Resend only; logs on failure)
        send_password_reset_code(body.email, code)
    return {"ok": True}


@app.post("/auth/verify-reset-code", response_model=schemas.VerifyResetCodeResponse)
def verify_reset_code(request: Request, body: schemas.VerifyResetCodeRequest, db: Session = Depends(get_db)):
    ip = _get_client_ip(request)
    ok, retry_after = _rate_limiter.hit(f'auth:verify-reset:ip:{ip}', limit=10, window_seconds=60)
    if not ok:
        raise HTTPException(status_code=429, detail='Too many attempts. Please try again shortly.', headers={'Retry-After': str(retry_after)})

    email = (body.email or '').strip().lower()
    if email:
        ok2, retry_after2 = _rate_limiter.hit(f'auth:verify-reset:email:{email}', limit=10, window_seconds=600)
        if not ok2:
            raise HTTPException(status_code=429, detail='Too many attempts. Please try again later.', headers={'Retry-After': str(retry_after2)})

    user = crud.get_user_by_email(db, body.email)
    now = int(time.time())
    if (not user) or (not user.reset_code_hash) or (not user.reset_code_expires_at) or (now > int(user.reset_code_expires_at)):
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    code = (body.code or "").strip()
    if len(code) != 6 or not code.isdigit():
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    if not hmac.compare_digest(user.reset_code_hash, _reset_code_hash(code)):
        time.sleep(0.15 + (secrets.randbelow(200) / 1000.0))
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    # One-time use: clear code once verified, then issue short-lived reset token
    user.reset_code_hash = None
    user.reset_code_expires_at = None
    db.add(user)
    db.commit()

    reset_token = create_access_token(
        data={"sub": user.email, "purpose": "password_reset"},
        expires_delta=__import__("datetime").timedelta(minutes=10),
    )
    return {"reset_token": reset_token}


@app.post("/auth/reset-password")
def reset_password_confirm(body: schemas.ResetPasswordConfirmRequest, db: Session = Depends(get_db)):
    # Validate reset token
    from jose import JWTError, jwt
    try:
        payload = jwt.decode(body.reset_token, config.SECRET_KEY, algorithms=[config.ALGORITHM])
        email = payload.get("sub")
        purpose = payload.get("purpose")
        if not email or purpose != "password_reset":
            raise HTTPException(status_code=400, detail="Invalid reset token")
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid reset token")

    new_password = body.new_password or ""
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password too short")

    user = crud.get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid reset token")

    crud.set_user_password(db, user, new_password)
    return {"ok": True}


@app.get("/users/me", response_model=schemas.UserOut)
def read_users_me(current_user = Depends(get_current_user)):
    return current_user


@app.get('/users/me/phone', response_model=schemas.MyPhoneOut)
def get_my_phone(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    data = crud.get_my_phone(db, current_user.id)
    if not data:
        raise HTTPException(status_code=404, detail='Not found')
    return data


@app.put('/users/me/phone', response_model=schemas.MyPhoneOut)
def set_my_phone(body: schemas.MyPhoneUpdate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    phone = (body.phone_number or '').strip()
    if len(phone) < 6:
        raise HTTPException(status_code=400, detail='Invalid phone number')
    data = crud.set_my_phone(db, current_user.id, phone)
    if not data:
        raise HTTPException(status_code=404, detail='Not found')
    return data


@app.put('/users/me', response_model=schemas.UserOut)
def update_profile(up: schemas.UserUpdate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    user = crud.get_user_by_email(db, current_user.email)
    if not user:
        raise HTTPException(status_code=404, detail='Not found')
    user = crud.update_user(db, user, up.dict())
    return user


@app.post('/users/me/password')
def change_password(body: schemas.PasswordChange, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    user = crud.get_user_by_email(db, current_user.email)
    if not user:
        raise HTTPException(status_code=404, detail='Not found')
    updated = crud.change_user_password(db, user, body.current_password, body.new_password)
    if not updated:
        raise HTTPException(status_code=400, detail='Current password incorrect')
    return {'ok': True}


@app.post("/apartments", response_model=schemas.ApartmentOut)
def create_apartment(apartment: schemas.ApartmentCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    ap = crud.create_apartment(db, apartment, owner_id=current_user.id)
    owner = db.query(models.User).filter(models.User.id == ap.owner_id).first()
    return {
        'id': ap.id,
        'title': ap.title,
        'description': ap.description,
        'location': ap.location,
        'rooms': ap.rooms,
        'rent': ap.rent,
        'listing_type': ap.listing_type if hasattr(ap, 'listing_type') else 'offer',
        'gender': getattr(ap, 'gender', None),
        'shomer_shabbos': bool(getattr(ap, 'shomer_shabbos', False)),
        'shomer_kashrut': bool(getattr(ap, 'shomer_kashrut', False)),
        'opposite_gender_allowed': bool(getattr(ap, 'opposite_gender_allowed', False)),
        'smoking_allowed': bool(getattr(ap, 'smoking_allowed', False)),
        'owner_id': ap.owner_id,
        'owner_name': owner.full_name if owner else None,
    }


@app.get("/apartments", response_model=list[schemas.ApartmentOut])
def list_apartments(db: Session = Depends(get_db)):
    aps = crud.list_apartments(db)
    out = []
    for a in aps:
        owner = db.query(models.User).filter(models.User.id == a.owner_id).first() if a.owner_id else None
        out.append({
            'id': a.id,
            'title': a.title,
            'description': a.description,
            'location': a.location,
            'rooms': a.rooms,
            'rent': a.rent,
            'listing_type': a.listing_type if hasattr(a, 'listing_type') else 'offer',
            'gender': getattr(a, 'gender', None),
            'shomer_shabbos': bool(getattr(a, 'shomer_shabbos', False)),
            'shomer_kashrut': bool(getattr(a, 'shomer_kashrut', False)),
            'opposite_gender_allowed': bool(getattr(a, 'opposite_gender_allowed', False)),
            'smoking_allowed': bool(getattr(a, 'smoking_allowed', False)),
            'owner_id': a.owner_id,
            'owner_name': owner.full_name if owner else None,
        })
    return out


@app.get("/apartments/{apartment_id}", response_model=schemas.ApartmentOut)
def get_apartment(apartment_id: int, db: Session = Depends(get_db)):
    ap = crud.get_apartment(db, apartment_id)
    if not ap:
        raise HTTPException(status_code=404, detail="Not found")
    owner = db.query(models.User).filter(models.User.id == ap.owner_id).first() if ap.owner_id else None
    return {
        'id': ap.id,
        'title': ap.title,
        'description': ap.description,
        'location': ap.location,
        'rooms': ap.rooms,
        'rent': ap.rent,
        'listing_type': ap.listing_type if hasattr(ap, 'listing_type') else 'offer',
        'gender': getattr(ap, 'gender', None),
        'shomer_shabbos': bool(getattr(ap, 'shomer_shabbos', False)),
        'shomer_kashrut': bool(getattr(ap, 'shomer_kashrut', False)),
        'opposite_gender_allowed': bool(getattr(ap, 'opposite_gender_allowed', False)),
        'smoking_allowed': bool(getattr(ap, 'smoking_allowed', False)),
        'owner_id': ap.owner_id,
        'owner_name': owner.full_name if owner else None,
    }


@app.delete("/apartments/{apartment_id}")
def delete_apartment(apartment_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    ap = db.query(models.Apartment).filter(models.Apartment.id == apartment_id).first()
    if not ap:
        raise HTTPException(status_code=404, detail="Apartment not found")
    # Only owner (or admin) can delete
    if (ap.owner_id != current_user.id) and (not getattr(current_user, 'is_admin', False)):
        raise HTTPException(status_code=403, detail="Not authorized")
    # Remove related applications first to avoid FK constraint issues
    db.query(models.Application).filter(models.Application.apartment_id == apartment_id).delete(synchronize_session=False)
    db.delete(ap)
    db.commit()
    return {"ok": True}


@app.post("/apartments/{apartment_id}/apply", response_model=schemas.ApplicationOut)
def apply_apartment(apartment_id: int, application: schemas.ApplicationCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    ap = crud.get_apartment(db, apartment_id)
    if not ap:
        raise HTTPException(status_code=404, detail="Apartment not found")
    # prevent owners from applying to their own listing
    if ap.owner_id and ap.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot apply to your own apartment")
    # prevent admin users from applying
    if getattr(current_user, 'is_admin', False):
        raise HTTPException(status_code=403, detail="Admins cannot apply to apartments")
    # prevent duplicate applications by same user
    existing = db.query(models.Application).filter(models.Application.apartment_id==apartment_id, models.Application.applicant_id==current_user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already applied to this apartment")
    a = crud.apply_to_apartment(db, applicant_id=current_user.id, apartment_id=apartment_id, message=application.message)
    # return richer application output
    user = crud.get_user_by_email(db, current_user.email)

    # Best-effort email notification to the apartment owner
    try:
        owner = db.query(models.User).filter(models.User.id == ap.owner_id).first() if ap.owner_id else None
        if owner and owner.email:
            applicant_name = (user.full_name if user and user.full_name else f"User #{current_user.id}")
            msg = (application.message or "").strip()
            body = (
                f"You have a new application for your listing: {ap.title}\n\n"
                f"From: {applicant_name} ({user.email if user else current_user.email})\n"
            )
            if msg:
                body += f"\nMessage:\n{msg}\n"
            body += "\nLog in to Soldier Housing to view/manage applications."
            send_email(owner.email, f"New application for '{ap.title}'", body)
    except Exception as e:
        print(f"[email] apply notification failed: {e}")

    return {
        'id': a.id,
        'message': a.message,
        'status': a.status,
        'applicant_id': a.applicant_id,
        'applicant_name': user.full_name if user else None,
        'applicant_phone': None,
        'apartment_id': a.apartment_id,
    }


@app.get('/apartments/{apartment_id}/applied')
def apartment_applied(apartment_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    # returns whether the authenticated user has already applied to this apartment
    a = db.query(models.Application).filter(models.Application.apartment_id==apartment_id, models.Application.applicant_id==current_user.id).first()
    return {'applied': True if a else False}


@app.post('/apartments/applied')
def apartments_applied(payload: dict, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    # Expect payload: { "ids": [1,2,3] }
    ids = payload.get('ids') if isinstance(payload, dict) else None
    if not ids or not isinstance(ids, list):
        return {'applied': {}}
    # query for applications by this user for the given apartment ids
    rows = db.query(models.Application.apartment_id).filter(models.Application.apartment_id.in_(ids), models.Application.applicant_id==current_user.id).all()
    applied_ids = {r[0] for r in rows}
    mapping = {i: (i in applied_ids) for i in ids}
    return {'applied': mapping}


@app.get('/owner/applications')
def owner_applications(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    return crud.list_applications_for_owner(db, current_user.id)


@app.post('/applications/{application_id}/accept')
def accept_application(application_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    a = crud.accept_application(db, application_id, current_user.id)
    if not a:
        raise HTTPException(status_code=404, detail='Not found or not authorized')

    # Best-effort email notification to applicant (accepted)
    try:
        ap = crud.get_apartment(db, a.apartment_id)
        applicant = db.query(models.User).filter(models.User.id == a.applicant_id).first() if a.applicant_id else None
        owner = db.query(models.User).filter(models.User.id == current_user.id).first() if current_user and getattr(current_user, 'id', None) else None
        if applicant and applicant.email:
            apt_title = ap.title if ap else f"Apartment #{a.apartment_id}"
            owner_name = (owner.full_name if owner and owner.full_name else "the owner")
            body = (
                f"Good news — your application to '{apt_title}' was accepted.\n\n"
                f"Accepted by: {owner_name}\n"
            )
            if owner and owner.phone:
                body += f"Owner phone: {owner.phone}\n"
            body += "\nLog in to Soldier Housing to view full details."
            send_email(applicant.email, f"Application accepted: '{apt_title}'", body)
    except Exception as e:
        print(f"[email] accept notification failed: {e}")

    return {'ok': True}


@app.get('/notifications')
def get_notifications(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    notes = crud.list_notifications(db, current_user.id)
    return [{'id': n.id, 'message': n.message, 'is_read': n.is_read, 'created_at': n.created_at} for n in notes]


@app.post('/notifications/{notification_id}/read')
def read_notification(notification_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    n = crud.mark_notification_read(db, notification_id, current_user.id)
    if not n:
        raise HTTPException(status_code=404, detail='Not found')
    return {'ok': True}


@app.get('/applications/{application_id}', response_model=schemas.ApplicationDetailOut)
def get_application_detail(application_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    a = crud.get_application(db, application_id)
    if not a:
        raise HTTPException(status_code=404, detail='Not found')
    ap = crud.get_apartment(db, a.apartment_id)
    applicant = db.query(models.User).filter(models.User.id==a.applicant_id).first() if a.applicant_id else None
    # fetch owner
    owner = None
    if ap and ap.owner_id:
        owner = db.query(models.User).filter(models.User.id==ap.owner_id).first()

    return {
        'id': a.id,
        'message': a.message,
        'status': a.status,
        'applicant_id': a.applicant_id,
        'applicant_name': applicant.full_name if applicant else None,
        'owner_id': owner.id if owner else None,
        'owner_name': owner.full_name if owner else None,
        'apartment_id': a.apartment_id,
        'apartment_title': ap.title if ap else None,
    }


@app.post('/external-listings', response_model=schemas.ExternalListingOut)
def create_external_listing(body: schemas.ExternalListingCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if not body.url or not str(body.url).strip():
        raise HTTPException(status_code=400, detail='URL is required')
    if not body.source or str(body.source).strip().lower() not in {'yad2', 'facebook', 'other'}:
        raise HTTPException(status_code=400, detail='Invalid source')
    listing = crud.create_external_listing(db, current_user.id, body)
    return {
        **listing.__dict__,
        'created_by_user_id': listing.created_by_user_id,
        'interest_count': 0,
        'is_interested': False,
    }


@app.get('/external-listings', response_model=schemas.ExternalListingListOut)
def list_external_listings(skip: int = 0, limit: int = 20, q: str | None = None, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    limit = min(max(int(limit), 1), 100)
    skip = max(int(skip), 0)
    items, total = crud.list_external_listings(db, skip=skip, limit=limit, search=q)
    ids = [i.id for i in items]
    counts = crud.get_interest_counts(db, ids)
    interested_set = crud.get_user_interests_map(db, current_user.id, ids) if current_user else set()
    out = []
    for i in items:
        out.append({
            'id': i.id,
            'created_by_user_id': i.created_by_user_id,
            'source': i.source,
            'url': i.url,
            'title': i.title,
            'price': i.price,
            'location': i.location,
            'notes': i.notes,
            'created_at': i.created_at,
            'interest_count': int(counts.get(i.id, 0)),
            'is_interested': True if i.id in interested_set else False,
        })
    return {'items': out, 'total': int(total)}


@app.get('/external-listings/{listing_id}', response_model=schemas.ExternalListingOut)
def get_external_listing(listing_id: UUID, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    listing = crud.get_external_listing(db, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail='Not found')
    counts = crud.get_interest_counts(db, [listing.id])
    interested = crud.get_user_interests_map(db, current_user.id, [listing.id])
    return {
        'id': listing.id,
        'created_by_user_id': listing.created_by_user_id,
        'source': listing.source,
        'url': listing.url,
        'title': listing.title,
        'price': listing.price,
        'location': listing.location,
        'notes': listing.notes,
        'created_at': listing.created_at,
        'interest_count': int(counts.get(listing.id, 0)),
        'is_interested': True if listing.id in interested else False,
    }


@app.post('/external-listings/{listing_id}/interest')
def add_external_interest(listing_id: UUID, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    listing = crud.get_external_listing(db, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail='Not found')
    crud.add_interest(db, listing_id, current_user.id)
    counts = crud.get_interest_counts(db, [listing_id])
    return {'ok': True, 'interest_count': int(counts.get(listing_id, 0))}


@app.delete('/external-listings/{listing_id}/interest')
def remove_external_interest(listing_id: UUID, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    listing = crud.get_external_listing(db, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail='Not found')
    crud.remove_interest(db, listing_id, current_user.id)
    counts = crud.get_interest_counts(db, [listing_id])
    return {'ok': True, 'interest_count': int(counts.get(listing_id, 0))}


@app.post('/contact-requests', response_model=schemas.ContactRequestOut)
def create_contact_request(body: schemas.ContactRequestCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    try:
        cr = crud.create_contact_request(db, current_user.id, body.target_user_id, body.listing_id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return cr


@app.get('/contact-requests/incoming', response_model=list[schemas.IncomingContactRequestOut])
def incoming_contact_requests(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    items = crud.list_incoming_contact_requests(db, current_user.id)
    out = []
    for cr in items:
        requester = db.query(models.User).filter(models.User.id == cr.requester_user_id).first()
        listing = crud.get_external_listing(db, cr.listing_id)
        out.append({
            'id': cr.id,
            'requester_user_id': cr.requester_user_id,
            'target_user_id': cr.target_user_id,
            'listing_id': cr.listing_id,
            'status': cr.status,
            'created_at': cr.created_at,
            'requester_name': requester.full_name if requester else None,
            'requester_email': requester.email if requester else None,
            'listing_title': listing.title if listing else None,
            'listing_url': listing.url if listing else None,
        })
    return out


@app.post('/contact-requests/{request_id}/accept', response_model=schemas.ContactRequestOut)
def accept_contact_request(request_id: UUID, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    try:
        cr = crud.accept_contact_request(db, request_id, current_user.id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not cr:
        raise HTTPException(status_code=404, detail='Not found')
    return cr


@app.post('/contact-requests/{request_id}/decline', response_model=schemas.ContactRequestOut)
def decline_contact_request(request_id: UUID, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    cr = crud.decline_contact_request(db, request_id, current_user.id)
    if not cr:
        raise HTTPException(status_code=404, detail='Not found')
    return cr


@app.get('/contact-requests/{request_id}/contact', response_model=schemas.ContactInfoOut)
def get_contact_info(request_id: UUID, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    cr = crud.get_contact_request(db, request_id)
    if not cr:
        raise HTTPException(status_code=404, detail='Not found')
    if current_user.id not in {cr.requester_user_id, cr.target_user_id}:
        raise HTTPException(status_code=403, detail='Not authorized')
    if cr.status != 'accepted':
        raise HTTPException(status_code=403, detail='Contact not exchanged')

    requester = db.query(models.User).filter(models.User.id == cr.requester_user_id).first()
    target = db.query(models.User).filter(models.User.id == cr.target_user_id).first()
    if not requester or not target:
        raise HTTPException(status_code=400, detail='User not found')
    if not getattr(requester, 'phone_verified', False) or not getattr(target, 'phone_verified', False):
        raise HTTPException(status_code=403, detail='Both users must have verified phone numbers')
    if not requester.phone_number or not target.phone_number:
        raise HTTPException(status_code=403, detail='Missing phone number')

    return {
        'listing_id': cr.listing_id,
        'requester_user_id': cr.requester_user_id,
        'target_user_id': cr.target_user_id,
        'requester_phone_number': requester.phone_number,
        'target_phone_number': target.phone_number,
    }


# -----------------------------
# Community app
# -----------------------------


@app.get('/community/posts', response_model=list[schemas.CommunityPostOut])
def community_list_posts(skip: int = 0, limit: int = 50, q: str | None = None, _community=Depends(_require_community_enabled), db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    limit = min(int(limit or 50), 100)
    skip = max(int(skip or 0), 0)

    qry = db.query(models.CommunityPost)
    s = (q or '').strip()
    if s:
        like = f"%{s}%"
        qry = qry.filter(or_(models.CommunityPost.title.ilike(like), models.CommunityPost.body.ilike(like)))

    posts = (
        qry.order_by(models.CommunityPost.is_pinned.desc(), models.CommunityPost.created_at.desc(), models.CommunityPost.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    post_ids = [p.id for p in posts]
    counts = {}
    if post_ids:
        rows = (
            db.query(models.CommunityComment.post_id, func.count(models.CommunityComment.id))
            .filter(models.CommunityComment.post_id.in_(post_ids))
            .group_by(models.CommunityComment.post_id)
            .all()
        )
        counts = {int(r[0]): int(r[1]) for r in rows}

    out = []
    for p in posts:
        u = db.query(models.User).filter(models.User.id == p.created_by_user_id).first()
        out.append({
            'id': p.id,
            'created_by_user_id': p.created_by_user_id,
            'created_by_name': u.full_name if u else None,
            'title': p.title,
            'body': p.body,
            'is_pinned': bool(getattr(p, 'is_pinned', False)),
            'created_at': p.created_at,
            'comments_count': int(counts.get(int(p.id), 0)),
        })
    return out


@app.post('/community/posts', response_model=schemas.CommunityPostOut)
def community_create_post(body: schemas.CommunityPostCreate, _community=Depends(_require_community_enabled), db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    text_body = (body.body or '').strip()
    title = (body.title or '').strip() or None
    if not text_body:
        raise HTTPException(status_code=400, detail='body is required')
    if len(text_body) > 5000:
        raise HTTPException(status_code=400, detail='body too long')

    post = models.CommunityPost(created_by_user_id=current_user.id, title=title, body=text_body, is_pinned=False)
    db.add(post)
    db.commit()
    db.refresh(post)
    return {
        'id': post.id,
        'created_by_user_id': post.created_by_user_id,
        'created_by_name': current_user.full_name,
        'title': post.title,
        'body': post.body,
        'is_pinned': bool(getattr(post, 'is_pinned', False)),
        'created_at': post.created_at,
        'comments_count': 0,
    }


@app.get('/community/posts/{post_id}/comments', response_model=list[schemas.CommunityCommentOut])
def community_list_comments(post_id: int, _community=Depends(_require_community_enabled), db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    post = db.query(models.CommunityPost).filter(models.CommunityPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail='Not found')

    comments = (
        db.query(models.CommunityComment)
        .filter(models.CommunityComment.post_id == post_id)
        .order_by(models.CommunityComment.created_at.asc(), models.CommunityComment.id.asc())
        .all()
    )
    out = []
    for c in comments:
        u = db.query(models.User).filter(models.User.id == c.created_by_user_id).first()
        out.append({
            'id': c.id,
            'post_id': c.post_id,
            'created_by_user_id': c.created_by_user_id,
            'created_by_name': u.full_name if u else None,
            'body': c.body,
            'created_at': c.created_at,
        })
    return out


@app.post('/community/posts/{post_id}/comments', response_model=schemas.CommunityCommentOut)
def community_add_comment(post_id: int, body: schemas.CommunityCommentCreate, _community=Depends(_require_community_enabled), db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    post = db.query(models.CommunityPost).filter(models.CommunityPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail='Not found')

    text_body = (body.body or '').strip()
    if not text_body:
        raise HTTPException(status_code=400, detail='body is required')
    if len(text_body) > 2000:
        raise HTTPException(status_code=400, detail='body too long')

    c = models.CommunityComment(post_id=post_id, created_by_user_id=current_user.id, body=text_body)
    db.add(c)
    db.commit()
    db.refresh(c)
    return {
        'id': c.id,
        'post_id': c.post_id,
        'created_by_user_id': c.created_by_user_id,
        'created_by_name': current_user.full_name,
        'body': c.body,
        'created_at': c.created_at,
    }


@app.get('/community/events', response_model=list[schemas.CommunityEventOut])
def community_list_events(q: str | None = None, _community=Depends(_require_community_enabled), db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    qry = db.query(models.CommunityEvent).filter(
        or_(models.CommunityEvent.status == 'approved', models.CommunityEvent.created_by_user_id == current_user.id)
    )
    s = (q or '').strip()
    if s:
        like = f"%{s}%"
        qry = qry.filter(
            or_(
                models.CommunityEvent.title.ilike(like),
                models.CommunityEvent.description.ilike(like),
                models.CommunityEvent.location.ilike(like),
            )
        )
    events = qry.order_by(models.CommunityEvent.starts_at.asc(), models.CommunityEvent.id.asc()).all()
    out = []
    for ev in events:
        u = db.query(models.User).filter(models.User.id == ev.created_by_user_id).first()
        out.append({
            'id': ev.id,
            'created_by_user_id': ev.created_by_user_id,
            'created_by_name': u.full_name if u else None,
            'title': ev.title,
            'description': ev.description,
            'location': ev.location,
            'starts_at': ev.starts_at,
            'status': ev.status,
            'created_at': ev.created_at,
        })
    return out


@app.post('/community/events', response_model=schemas.CommunityEventOut)
def community_create_event(body: schemas.CommunityEventCreate, _community=Depends(_require_community_enabled), db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    title = (body.title or '').strip()
    if not title:
        raise HTTPException(status_code=400, detail='title is required')
    ev = models.CommunityEvent(
        created_by_user_id=current_user.id,
        title=title,
        description=(body.description or None),
        location=(body.location or None),
        starts_at=body.starts_at,
        status='pending',
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return {
        'id': ev.id,
        'created_by_user_id': ev.created_by_user_id,
        'created_by_name': current_user.full_name,
        'title': ev.title,
        'description': ev.description,
        'location': ev.location,
        'starts_at': ev.starts_at,
        'status': ev.status,
        'created_at': ev.created_at,
    }


@app.get('/community/users', response_model=list[schemas.CommunityUserOut])
def community_list_users(_community=Depends(_require_community_enabled), db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    raise HTTPException(status_code=403, detail='Direct messaging is disabled')


@app.get('/community/messages/inbox', response_model=list[schemas.CommunityMessageOut])
def community_inbox(_community=Depends(_require_community_enabled), db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    raise HTTPException(status_code=403, detail='Direct messaging is disabled')


@app.get('/community/messages/sent', response_model=list[schemas.CommunityMessageOut])
def community_sent(_community=Depends(_require_community_enabled), db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    raise HTTPException(status_code=403, detail='Direct messaging is disabled')


@app.post('/community/messages', response_model=schemas.CommunityMessageOut)
def community_send_message(body: schemas.CommunityMessageSendIn, _community=Depends(_require_community_enabled), db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    raise HTTPException(status_code=403, detail='Direct messaging is disabled')


@app.post('/community/messages/{message_id}/read')
def community_mark_message_read(message_id: int, _community=Depends(_require_community_enabled), db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    raise HTTPException(status_code=403, detail='Direct messaging is disabled')


# -----------------------------
# Resources app
# -----------------------------


@app.get('/resources/items', response_model=list[schemas.ResourceItemOut])
def resources_list_items(category: str | None = None, q: str | None = None, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    qry = db.query(models.ResourceItem)
    if category:
        qry = qry.filter(models.ResourceItem.category == category)
    qry = qry.filter(or_(models.ResourceItem.status == 'approved', models.ResourceItem.created_by_user_id == current_user.id))
    s = (q or '').strip()
    if s:
        like = f"%{s}%"
        qry = qry.filter(
            or_(
                models.ResourceItem.title.ilike(like),
                models.ResourceItem.category.ilike(like),
                models.ResourceItem.description.ilike(like),
                models.ResourceItem.url.ilike(like),
            )
        )
    items = qry.order_by(models.ResourceItem.created_at.desc(), models.ResourceItem.id.desc()).all()

    saved_ids = set(
        r[0] for r in (
            db.query(models.ResourceSave.resource_id)
            .filter(models.ResourceSave.user_id == current_user.id)
            .all()
        )
    )
    out = []
    for it in items:
        u = db.query(models.User).filter(models.User.id == it.created_by_user_id).first()
        out.append({
            'id': it.id,
            'created_by_user_id': it.created_by_user_id,
            'created_by_name': u.full_name if u else None,
            'title': it.title,
            'category': it.category,
            'description': it.description,
            'url': it.url,
            'status': it.status,
            'created_at': it.created_at,
            'is_saved': bool(it.id in saved_ids),
        })
    return out


@app.post('/resources/items', response_model=schemas.ResourceItemOut)
def resources_create_item(body: schemas.ResourceItemCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    title = (body.title or '').strip()
    if not title:
        raise HTTPException(status_code=400, detail='title is required')
    it = models.ResourceItem(
        created_by_user_id=current_user.id,
        title=title,
        category=(body.category or None),
        description=(body.description or None),
        url=(body.url or None),
        status='pending',
    )
    db.add(it)
    db.commit()
    db.refresh(it)
    return {
        'id': it.id,
        'created_by_user_id': it.created_by_user_id,
        'created_by_name': current_user.full_name,
        'title': it.title,
        'category': it.category,
        'description': it.description,
        'url': it.url,
        'status': it.status,
        'created_at': it.created_at,
        'is_saved': False,
    }


@app.post('/resources/items/{resource_id}/save')
def resources_save(resource_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    it = db.query(models.ResourceItem).filter(models.ResourceItem.id == resource_id).first()
    if not it:
        raise HTTPException(status_code=404, detail='Not found')
    # Only approved (or your own) can be saved
    if it.status != 'approved' and it.created_by_user_id != current_user.id:
        raise HTTPException(status_code=403, detail='Not authorized')
    try:
        row = models.ResourceSave(user_id=current_user.id, resource_id=resource_id)
        db.add(row)
        db.commit()
    except IntegrityError:
        db.rollback()
    return {'ok': True}


@app.delete('/resources/items/{resource_id}/save')
def resources_unsave(resource_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    db.query(models.ResourceSave).filter(and_(models.ResourceSave.user_id == current_user.id, models.ResourceSave.resource_id == resource_id)).delete()
    db.commit()
    return {'ok': True}


@app.get('/resources/saved', response_model=list[schemas.ResourceItemOut])
def resources_saved(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    saved_rows = db.query(models.ResourceSave.resource_id).filter(models.ResourceSave.user_id == current_user.id).all()
    ids = [int(r[0]) for r in saved_rows]
    if not ids:
        return []
    items = db.query(models.ResourceItem).filter(models.ResourceItem.id.in_(ids)).order_by(models.ResourceItem.created_at.desc()).all()
    out = []
    for it in items:
        u = db.query(models.User).filter(models.User.id == it.created_by_user_id).first()
        out.append({
            'id': it.id,
            'created_by_user_id': it.created_by_user_id,
            'created_by_name': u.full_name if u else None,
            'title': it.title,
            'category': it.category,
            'description': it.description,
            'url': it.url,
            'status': it.status,
            'created_at': it.created_at,
            'is_saved': True,
        })
    return out


# -----------------------------
# Jobs app
# -----------------------------


@app.get('/jobs/listings', response_model=list[schemas.JobListingOut])
def jobs_list_listings(q: str | None = None, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    qry = db.query(models.JobListing).filter(
        or_(models.JobListing.status == 'approved', models.JobListing.created_by_user_id == current_user.id)
    )
    s = (q or '').strip()
    if s:
        like = f"%{s}%"
        qry = qry.filter(
            or_(
                models.JobListing.title.ilike(like),
                models.JobListing.company.ilike(like),
                models.JobListing.location.ilike(like),
                models.JobListing.description.ilike(like),
                models.JobListing.apply_url.ilike(like),
                models.JobListing.salary.ilike(like),
            )
        )
    listings = qry.order_by(models.JobListing.created_at.desc(), models.JobListing.id.desc()).all()
    saved_ids = set(
        r[0] for r in (
            db.query(models.JobSave.job_id)
            .filter(models.JobSave.user_id == current_user.id)
            .all()
        )
    )
    out = []
    for j in listings:
        u = db.query(models.User).filter(models.User.id == j.created_by_user_id).first()
        out.append({
            'id': j.id,
            'created_by_user_id': j.created_by_user_id,
            'created_by_name': u.full_name if u else None,
            'title': j.title,
            'company': j.company,
            'location': j.location,
            'description': j.description,
            'apply_url': j.apply_url,
            'salary': j.salary,
            'status': j.status,
            'created_at': j.created_at,
            'is_saved': bool(j.id in saved_ids),
        })
    return out


@app.post('/jobs/listings', response_model=schemas.JobListingOut)
def jobs_create_listing(body: schemas.JobListingCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    title = (body.title or '').strip()
    if not title:
        raise HTTPException(status_code=400, detail='title is required')
    j = models.JobListing(
        created_by_user_id=current_user.id,
        title=title,
        company=(body.company or None),
        location=(body.location or None),
        description=(body.description or None),
        apply_url=(body.apply_url or None),
        salary=(body.salary or None),
        status='pending',
    )
    db.add(j)
    db.commit()
    db.refresh(j)
    return {
        'id': j.id,
        'created_by_user_id': j.created_by_user_id,
        'created_by_name': current_user.full_name,
        'title': j.title,
        'company': j.company,
        'location': j.location,
        'description': j.description,
        'apply_url': j.apply_url,
        'salary': j.salary,
        'status': j.status,
        'created_at': j.created_at,
        'is_saved': False,
    }


@app.post('/jobs/listings/{job_id}/save')
def jobs_save(job_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    j = db.query(models.JobListing).filter(models.JobListing.id == job_id).first()
    if not j:
        raise HTTPException(status_code=404, detail='Not found')
    if j.status != 'approved' and j.created_by_user_id != current_user.id:
        raise HTTPException(status_code=403, detail='Not authorized')
    try:
        row = models.JobSave(user_id=current_user.id, job_id=job_id)
        db.add(row)
        db.commit()
    except IntegrityError:
        db.rollback()
    return {'ok': True}


@app.delete('/jobs/listings/{job_id}/save')
def jobs_unsave(job_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    db.query(models.JobSave).filter(and_(models.JobSave.user_id == current_user.id, models.JobSave.job_id == job_id)).delete()
    db.commit()
    return {'ok': True}


@app.get('/jobs/saved', response_model=list[schemas.JobListingOut])
def jobs_saved(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    saved_rows = db.query(models.JobSave.job_id).filter(models.JobSave.user_id == current_user.id).all()
    ids = [int(r[0]) for r in saved_rows]
    if not ids:
        return []
    listings = db.query(models.JobListing).filter(models.JobListing.id.in_(ids)).order_by(models.JobListing.created_at.desc()).all()
    out = []
    for j in listings:
        u = db.query(models.User).filter(models.User.id == j.created_by_user_id).first()
        out.append({
            'id': j.id,
            'created_by_user_id': j.created_by_user_id,
            'created_by_name': u.full_name if u else None,
            'title': j.title,
            'company': j.company,
            'location': j.location,
            'description': j.description,
            'apply_url': j.apply_url,
            'salary': j.salary,
            'status': j.status,
            'created_at': j.created_at,
            'is_saved': True,
        })
    return out


@app.post('/jobs/listings/{job_id}/apply', response_model=schemas.JobApplicationOut)
def jobs_apply(job_id: int, body: schemas.JobApplicationCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    j = db.query(models.JobListing).filter(models.JobListing.id == job_id).first()
    if not j:
        raise HTTPException(status_code=404, detail='Not found')
    if j.status != 'approved' and j.created_by_user_id != current_user.id:
        raise HTTPException(status_code=403, detail='Not authorized')
    try:
        app_row = models.JobApplication(job_id=job_id, user_id=current_user.id, message=(body.message or None))
        db.add(app_row)
        db.commit()
        db.refresh(app_row)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail='Already applied')

    # Notify job poster
    try:
        note = models.Notification(
            user_id=j.created_by_user_id,
            message=f"New job application for '{j.title}' from {current_user.full_name or current_user.email}",
            is_read=False,
            created_at=datetime.utcnow().isoformat(),
        )
        db.add(note)
        db.commit()
        try:
            push.send_push_to_user(db, j.created_by_user_id, title="Soldier Housing", message=note.message, url="/jobs")
        except Exception:
            pass
    except Exception:
        db.rollback()

    return {
        'id': app_row.id,
        'job_id': app_row.job_id,
        'user_id': app_row.user_id,
        'user_name': current_user.full_name,
        'message': app_row.message,
        'created_at': app_row.created_at,
    }


@app.get('/jobs/listings/{job_id}/applications', response_model=list[schemas.JobApplicationOut])
def jobs_list_applications(job_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    j = db.query(models.JobListing).filter(models.JobListing.id == job_id).first()
    if not j:
        raise HTTPException(status_code=404, detail='Not found')
    if (j.created_by_user_id != current_user.id) and (not getattr(current_user, 'is_admin', False)):
        raise HTTPException(status_code=403, detail='Not authorized')
    apps = (
        db.query(models.JobApplication)
        .filter(models.JobApplication.job_id == job_id)
        .order_by(models.JobApplication.created_at.desc(), models.JobApplication.id.desc())
        .all()
    )
    out = []
    for a in apps:
        u = db.query(models.User).filter(models.User.id == a.user_id).first()
        out.append({
            'id': a.id,
            'job_id': a.job_id,
            'user_id': a.user_id,
            'user_name': u.full_name if u else None,
            'message': a.message,
            'created_at': a.created_at,
        })
    return out


@app.get('/jobs/my-applications', response_model=list[schemas.JobApplicationOut])
def jobs_my_applications(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    apps = (
        db.query(models.JobApplication)
        .filter(models.JobApplication.user_id == current_user.id)
        .order_by(models.JobApplication.created_at.desc(), models.JobApplication.id.desc())
        .all()
    )
    return [
        {
            'id': a.id,
            'job_id': a.job_id,
            'user_id': a.user_id,
            'user_name': current_user.full_name,
            'message': a.message,
            'created_at': a.created_at,
        }
        for a in apps
    ]


@app.get('/admin/users')
def admin_list_users(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    _require_admin(current_user)
    users = db.query(models.User).all()
    return [{'id': u.id, 'email': u.email, 'full_name': u.full_name, 'is_admin': u.is_admin} for u in users]


@app.get('/admin/apartments')
def admin_list_apartments(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    _require_admin(current_user)
    aps = db.query(models.Apartment).all()
    out = []
    for a in aps:
        owner = db.query(models.User).filter(models.User.id == a.owner_id).first() if a.owner_id else None
        out.append({'id': a.id, 'title': a.title, 'description': a.description, 'owner_id': a.owner_id, 'owner_email': owner.email if owner else None})
    return out


@app.delete('/admin/users/{user_id}')
def admin_delete_user(user_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    _require_admin(current_user)
    # prevent deleting self
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail='Cannot delete self')
    u = db.query(models.User).filter(models.User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail='User not found')

    # Remove side-app rows to satisfy FK constraints
    db.query(models.CommunityComment).filter(models.CommunityComment.created_by_user_id == user_id).delete(synchronize_session=False)
    db.query(models.CommunityPost).filter(models.CommunityPost.created_by_user_id == user_id).delete(synchronize_session=False)
    db.query(models.CommunityEvent).filter(models.CommunityEvent.created_by_user_id == user_id).delete(synchronize_session=False)
    db.query(models.CommunityMessage).filter(or_(models.CommunityMessage.sender_user_id == user_id, models.CommunityMessage.recipient_user_id == user_id)).delete(synchronize_session=False)

    db.query(models.ResourceSave).filter(models.ResourceSave.user_id == user_id).delete(synchronize_session=False)
    db.query(models.ResourceItem).filter(models.ResourceItem.created_by_user_id == user_id).delete(synchronize_session=False)

    db.query(models.JobSave).filter(models.JobSave.user_id == user_id).delete(synchronize_session=False)
    db.query(models.JobApplication).filter(models.JobApplication.user_id == user_id).delete(synchronize_session=False)
    db.query(models.JobListing).filter(models.JobListing.created_by_user_id == user_id).delete(synchronize_session=False)

    # Existing housing-related rows
    db.query(models.Application).filter(models.Application.applicant_id == user_id).delete(synchronize_session=False)
    db.query(models.Apartment).filter(models.Apartment.owner_id == user_id).delete(synchronize_session=False)
    db.query(models.Notification).filter(models.Notification.user_id == user_id).delete(synchronize_session=False)
    db.delete(u)
    db.commit()
    return {'ok': True}


@app.delete('/admin/apartments/{apartment_id}')
def admin_delete_apartment(apartment_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    _require_admin(current_user)
    ap = db.query(models.Apartment).filter(models.Apartment.id==apartment_id).first()
    if not ap:
        raise HTTPException(status_code=404, detail='Apartment not found')
    # remove related applications
    db.query(models.Application).filter(models.Application.apartment_id==apartment_id).delete()
    db.delete(ap)
    db.commit()
    return {'ok': True}


@app.get('/admin/applications')
def admin_list_applications(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    _require_admin(current_user)
    apps = db.query(models.Application).order_by(models.Application.id.desc()).all()
    out = []
    for a in apps:
        applicant = db.query(models.User).filter(models.User.id==a.applicant_id).first() if a.applicant_id else None
        ap = db.query(models.Apartment).filter(models.Apartment.id==a.apartment_id).first() if a.apartment_id else None
        out.append({
            'id': a.id,
            'message': a.message,
            'status': a.status,
            'applicant_id': a.applicant_id,
            'applicant_name': applicant.full_name if applicant else None,
            'apartment_id': a.apartment_id,
            'apartment_title': ap.title if ap else None
        })
    return out


@app.delete('/admin/applications/{application_id}')
def admin_delete_application(application_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    _require_admin(current_user)
    a = db.query(models.Application).filter(models.Application.id==application_id).first()
    if not a:
        raise HTTPException(status_code=404, detail='Not found')
    db.delete(a)
    db.commit()
    return {'ok': True}


@app.post('/admin/clean')
def admin_clean_db(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    _require_admin(current_user)
    # Delete non-admin users, their apartments, applications, and notifications. Keep admin users.
    admin_ids = [u.id for u in db.query(models.User).filter(models.User.is_admin==True).all()]

    # Side apps
    db.query(models.CommunityComment).filter(~models.CommunityComment.created_by_user_id.in_(admin_ids)).delete(synchronize_session=False)
    db.query(models.CommunityPost).filter(~models.CommunityPost.created_by_user_id.in_(admin_ids)).delete(synchronize_session=False)
    db.query(models.CommunityEvent).filter(~models.CommunityEvent.created_by_user_id.in_(admin_ids)).delete(synchronize_session=False)
    db.query(models.CommunityMessage).filter(~models.CommunityMessage.sender_user_id.in_(admin_ids)).delete(synchronize_session=False)
    db.query(models.CommunityMessage).filter(~models.CommunityMessage.recipient_user_id.in_(admin_ids)).delete(synchronize_session=False)

    db.query(models.ResourceSave).filter(~models.ResourceSave.user_id.in_(admin_ids)).delete(synchronize_session=False)
    db.query(models.ResourceItem).filter(~models.ResourceItem.created_by_user_id.in_(admin_ids)).delete(synchronize_session=False)

    db.query(models.JobSave).filter(~models.JobSave.user_id.in_(admin_ids)).delete(synchronize_session=False)
    db.query(models.JobApplication).filter(~models.JobApplication.user_id.in_(admin_ids)).delete(synchronize_session=False)
    db.query(models.JobListing).filter(~models.JobListing.created_by_user_id.in_(admin_ids)).delete(synchronize_session=False)

    # delete applications not related to admins
    db.query(models.Application).filter(~models.Application.applicant_id.in_(admin_ids)).delete(synchronize_session=False)
    # delete apartments not owned by admins
    db.query(models.Apartment).filter(~models.Apartment.owner_id.in_(admin_ids)).delete(synchronize_session=False)
    # delete notifications not for admins
    db.query(models.Notification).filter(~models.Notification.user_id.in_(admin_ids)).delete(synchronize_session=False)
    # delete users who are not admins
    db.query(models.User).filter(models.User.is_admin==False).delete(synchronize_session=False)
    db.commit()
    return {'ok': True}


@app.post('/admin/email')
def admin_send_email(payload: schemas.AdminSendEmailRequest, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    _require_admin(current_user)

    target = (payload.target or '').strip().lower()
    subject = (payload.subject or '').strip()
    message = (payload.message or '').strip()
    include_admins = bool(payload.include_admins)

    if target not in {'all', 'user'}:
        raise HTTPException(status_code=400, detail="target must be 'all' or 'user'")
    if not subject:
        raise HTTPException(status_code=400, detail='subject is required')
    if not message:
        raise HTTPException(status_code=400, detail='message is required')

    recipients = []
    if target == 'user':
        if not payload.user_id:
            raise HTTPException(status_code=400, detail='user_id is required when target=user')
        u = db.query(models.User).filter(models.User.id == payload.user_id).first()
        if not u or not u.email:
            raise HTTPException(status_code=404, detail='User not found')
        recipients = [u]
    else:
        q = db.query(models.User)
        if not include_admins:
            q = q.filter(models.User.is_admin == False)  # noqa: E712
        recipients = q.all()

    # Guardrail: avoid accidentally blasting huge lists
    if len(recipients) > 500:
        raise HTTPException(status_code=400, detail='Too many recipients (max 500)')

    sent = 0
    failed = 0
    for u in recipients:
        try:
            ok = send_email(u.email, subject, message)
            if ok:
                sent += 1
            else:
                failed += 1
        except Exception as e:
            failed += 1
            print(f"[admin-email] failed to send to {getattr(u, 'email', None)}: {e}")

    return {'ok': True, 'sent': sent, 'failed': failed}


@app.post('/admin/notifications')
def admin_send_notification(payload: schemas.AdminSendNotificationRequest, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    _require_admin(current_user)

    target = (payload.target or '').strip().lower()
    title = (payload.title or '').strip()
    message = (payload.message or '').strip()
    include_admins = bool(payload.include_admins)

    if target not in {'all', 'user'}:
        raise HTTPException(status_code=400, detail="target must be 'all' or 'user'")
    if not message:
        raise HTTPException(status_code=400, detail='message is required')

    final_message = f"{title}: {message}" if title else message

    recipients = []
    if target == 'user':
        if not payload.user_id:
            raise HTTPException(status_code=400, detail='user_id is required when target=user')
        u = db.query(models.User).filter(models.User.id == payload.user_id).first()
        if not u:
            raise HTTPException(status_code=404, detail='User not found')
        recipients = [u]
    else:
        q = db.query(models.User)
        if not include_admins:
            q = q.filter(models.User.is_admin == False)  # noqa: E712
        recipients = q.all()

    # Guardrail: avoid accidentally blasting huge lists
    if len(recipients) > 500:
        raise HTTPException(status_code=400, detail='Too many recipients (max 500)')

    created = 0
    for u in recipients:
        n = models.Notification(
            user_id=u.id,
            message=final_message,
            is_read=False,
            created_at=datetime.utcnow().isoformat(),
        )
        db.add(n)
        created += 1

    db.commit()

    # Best-effort push to each recipient (does not affect API success)
    for u in recipients:
        try:
            push.send_push_to_user(db, u.id, title="Soldier Housing", message=final_message, url="/")
        except Exception:
            pass
    return {'ok': True, 'created': created}


@app.get('/push/vapid-public-key', response_model=schemas.VapidPublicKeyOut)
def get_vapid_public_key():
    key = push.get_vapid_public_key()
    if not key:
        raise HTTPException(status_code=503, detail='Push notifications are not configured')
    return {'public_key': key}


@app.post('/push/subscribe')
def push_subscribe(body: schemas.PushSubscriptionIn, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    try:
        sub = crud.upsert_push_subscription(
            db,
            current_user.id,
            endpoint=body.endpoint,
            p256dh=body.keys.p256dh,
            auth=body.keys.auth,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {'ok': True, 'id': sub.id}


@app.post('/push/unsubscribe')
def push_unsubscribe(body: schemas.PushUnsubscribeIn, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    ok = crud.delete_push_subscription(db, current_user.id, endpoint=body.endpoint)
    return {'ok': True, 'deleted': bool(ok)}


# -----------------------------
# Admin moderation for side apps
# -----------------------------


@app.get('/admin/community/posts', response_model=list[schemas.CommunityPostOut])
def admin_community_posts(_community=Depends(_require_community_enabled), db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _require_admin(current_user)
    posts = (
        db.query(models.CommunityPost)
        .order_by(models.CommunityPost.is_pinned.desc(), models.CommunityPost.created_at.desc(), models.CommunityPost.id.desc())
        .limit(200)
        .all()
    )
    post_ids = [p.id for p in posts]
    counts = {}
    if post_ids:
        rows = (
            db.query(models.CommunityComment.post_id, func.count(models.CommunityComment.id))
            .filter(models.CommunityComment.post_id.in_(post_ids))
            .group_by(models.CommunityComment.post_id)
            .all()
        )
        counts = {int(r[0]): int(r[1]) for r in rows}

    out = []
    for p in posts:
        u = db.query(models.User).filter(models.User.id == p.created_by_user_id).first()
        out.append({
            'id': p.id,
            'created_by_user_id': p.created_by_user_id,
            'created_by_name': u.full_name if u else None,
            'title': p.title,
            'body': p.body,
            'is_pinned': bool(getattr(p, 'is_pinned', False)),
            'created_at': p.created_at,
            'comments_count': int(counts.get(int(p.id), 0)),
        })
    return out


@app.get('/admin/community/events', response_model=list[schemas.CommunityEventOut])
def admin_community_events(status: str | None = None, _community=Depends(_require_community_enabled), db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _require_admin(current_user)
    q = db.query(models.CommunityEvent)
    if status:
        q = q.filter(models.CommunityEvent.status == status)
    events = q.order_by(models.CommunityEvent.created_at.desc(), models.CommunityEvent.id.desc()).all()
    out = []
    for ev in events:
        u = db.query(models.User).filter(models.User.id == ev.created_by_user_id).first()
        out.append({
            'id': ev.id,
            'created_by_user_id': ev.created_by_user_id,
            'created_by_name': u.full_name if u else None,
            'title': ev.title,
            'description': ev.description,
            'location': ev.location,
            'starts_at': ev.starts_at,
            'status': ev.status,
            'created_at': ev.created_at,
        })
    return out


@app.post('/admin/community/events/{event_id}/approve')
def admin_approve_event(event_id: int, _community=Depends(_require_community_enabled), db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _require_admin(current_user)
    ev = db.query(models.CommunityEvent).filter(models.CommunityEvent.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail='Not found')
    ev.status = 'approved'
    db.add(ev)
    db.commit()
    return {'ok': True}


@app.post('/admin/community/events/{event_id}/reject')
def admin_reject_event(event_id: int, _community=Depends(_require_community_enabled), db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _require_admin(current_user)
    ev = db.query(models.CommunityEvent).filter(models.CommunityEvent.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail='Not found')
    ev.status = 'rejected'
    db.add(ev)
    db.commit()
    return {'ok': True}


@app.post('/admin/community/posts/{post_id}/pin')
def admin_pin_post(post_id: int, body: dict, _community=Depends(_require_community_enabled), db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _require_admin(current_user)
    post = db.query(models.CommunityPost).filter(models.CommunityPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail='Not found')
    is_pinned = bool(body.get('is_pinned')) if isinstance(body, dict) else False
    post.is_pinned = is_pinned
    db.add(post)
    db.commit()
    return {'ok': True}


@app.delete('/admin/community/posts/{post_id}')
def admin_delete_post(post_id: int, _community=Depends(_require_community_enabled), db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _require_admin(current_user)
    post = db.query(models.CommunityPost).filter(models.CommunityPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail='Not found')
    db.query(models.CommunityComment).filter(models.CommunityComment.post_id == post_id).delete(synchronize_session=False)
    db.delete(post)
    db.commit()
    return {'ok': True}


@app.get('/admin/resources/items', response_model=list[schemas.ResourceItemOut])
def admin_resources_items(status: str | None = None, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _require_admin(current_user)
    q = db.query(models.ResourceItem)
    if status:
        q = q.filter(models.ResourceItem.status == status)
    items = q.order_by(models.ResourceItem.created_at.desc(), models.ResourceItem.id.desc()).all()
    out = []
    for it in items:
        u = db.query(models.User).filter(models.User.id == it.created_by_user_id).first()
        out.append({
            'id': it.id,
            'created_by_user_id': it.created_by_user_id,
            'created_by_name': u.full_name if u else None,
            'title': it.title,
            'category': it.category,
            'description': it.description,
            'url': it.url,
            'status': it.status,
            'created_at': it.created_at,
            'is_saved': False,
        })
    return out


@app.post('/admin/resources/items/{resource_id}/approve')
def admin_approve_resource(resource_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _require_admin(current_user)
    it = db.query(models.ResourceItem).filter(models.ResourceItem.id == resource_id).first()
    if not it:
        raise HTTPException(status_code=404, detail='Not found')
    it.status = 'approved'
    db.add(it)
    db.commit()
    return {'ok': True}


@app.post('/admin/resources/items/{resource_id}/reject')
def admin_reject_resource(resource_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _require_admin(current_user)
    it = db.query(models.ResourceItem).filter(models.ResourceItem.id == resource_id).first()
    if not it:
        raise HTTPException(status_code=404, detail='Not found')
    it.status = 'rejected'
    db.add(it)
    db.commit()
    return {'ok': True}


@app.delete('/admin/resources/items/{resource_id}')
def admin_delete_resource(resource_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _require_admin(current_user)
    db.query(models.ResourceSave).filter(models.ResourceSave.resource_id == resource_id).delete(synchronize_session=False)
    it = db.query(models.ResourceItem).filter(models.ResourceItem.id == resource_id).first()
    if not it:
        raise HTTPException(status_code=404, detail='Not found')
    db.delete(it)
    db.commit()
    return {'ok': True}


@app.get('/admin/jobs/listings', response_model=list[schemas.JobListingOut])
def admin_jobs_listings(status: str | None = None, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _require_admin(current_user)
    q = db.query(models.JobListing)
    if status:
        q = q.filter(models.JobListing.status == status)
    listings = q.order_by(models.JobListing.created_at.desc(), models.JobListing.id.desc()).all()
    out = []
    for j in listings:
        u = db.query(models.User).filter(models.User.id == j.created_by_user_id).first()
        out.append({
            'id': j.id,
            'created_by_user_id': j.created_by_user_id,
            'created_by_name': u.full_name if u else None,
            'title': j.title,
            'company': j.company,
            'location': j.location,
            'description': j.description,
            'apply_url': j.apply_url,
            'salary': j.salary,
            'status': j.status,
            'created_at': j.created_at,
            'is_saved': False,
        })
    return out


@app.post('/admin/jobs/listings/{job_id}/approve')
def admin_approve_job(job_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _require_admin(current_user)
    j = db.query(models.JobListing).filter(models.JobListing.id == job_id).first()
    if not j:
        raise HTTPException(status_code=404, detail='Not found')
    j.status = 'approved'
    db.add(j)
    db.commit()
    return {'ok': True}


@app.post('/admin/jobs/listings/{job_id}/reject')
def admin_reject_job(job_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _require_admin(current_user)
    j = db.query(models.JobListing).filter(models.JobListing.id == job_id).first()
    if not j:
        raise HTTPException(status_code=404, detail='Not found')
    j.status = 'rejected'
    db.add(j)
    db.commit()
    return {'ok': True}


@app.delete('/admin/jobs/listings/{job_id}')
def admin_delete_job(job_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _require_admin(current_user)
    db.query(models.JobSave).filter(models.JobSave.job_id == job_id).delete(synchronize_session=False)
    db.query(models.JobApplication).filter(models.JobApplication.job_id == job_id).delete(synchronize_session=False)
    j = db.query(models.JobListing).filter(models.JobListing.id == job_id).first()
    if not j:
        raise HTTPException(status_code=404, detail='Not found')
    db.delete(j)
    db.commit()
    return {'ok': True}


