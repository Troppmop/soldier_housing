from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from . import models, schemas
from passlib.context import CryptContext
from datetime import datetime
from . import push

# Support both Argon2 and bcrypt so existing bcrypt-hashed passwords still verify.
# Prefer Argon2 for new hashes but accept bcrypt for legacy users during migration.
pwd_context = CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")

# user
def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user: schemas.UserCreate, is_admin: bool=False):
    # bcrypt has a 72-byte input limit; guard against longer passwords coming from envs
    pw = user.password or ""
    try:
        pw_bytes = pw.encode('utf-8')
    except Exception:
        pw_bytes = str(pw).encode('utf-8', errors='ignore')
    if len(pw_bytes) > 72:
        # truncate to 72 bytes and decode safely
        truncated = pw_bytes[:72].decode('utf-8', errors='ignore')
        hashed = pwd_context.hash(truncated)
        import warnings
        warnings.warn("Password exceeded bcrypt 72-byte limit; truncated before hashing.")
    else:
        hashed = pwd_context.hash(pw)
    # Store phone number privately (not returned in normal user responses)
    phone_number = getattr(user, 'phone_number', None)
    db_user = models.User(
        email=user.email,
        full_name=user.full_name,
        hashed_password=hashed,
        is_admin=is_admin,
        phone_number=phone_number,
        phone_verified=True if phone_number else False,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def authenticate_user(db: Session, email: str, password: str):
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not pwd_context.verify(password, user.hashed_password):
        return None
    return user

# apartments
def create_apartment(db: Session, apartment: schemas.ApartmentCreate, owner_id: int):
    ap = models.Apartment(**apartment.dict(), owner_id=owner_id)
    db.add(ap)
    db.commit()
    db.refresh(ap)
    return ap

def list_apartments(db: Session, skip: int=0, limit: int=100):
    return db.query(models.Apartment).offset(skip).limit(limit).all()

def get_apartment(db: Session, apartment_id: int):
    return db.query(models.Apartment).filter(models.Apartment.id==apartment_id).first()

# applications
def apply_to_apartment(db: Session, applicant_id: int, apartment_id: int, message: str=None):
    app = models.Application(message=message, applicant_id=applicant_id, apartment_id=apartment_id, status='pending')
    db.add(app)
    db.commit()
    db.refresh(app)
    # create notification for apartment owner
    apartment = get_apartment(db, apartment_id)
    if apartment and apartment.owner_id:
        note = models.Notification(
            user_id=apartment.owner_id,
            message=f"New application for '{apartment.title}' from user#{applicant_id}",
            created_at=datetime.utcnow().isoformat(),
        )
        db.add(note)
        db.commit()
        try:
            push.send_push_to_user(
                db,
                apartment.owner_id,
                title="Soldier Housing",
                message=note.message,
                url="/",
            )
        except Exception:
            pass
    return app

def list_applications_for_owner(db: Session, owner_id: int):
    # return all applications for apartments owned by owner
    aps = db.query(models.Apartment).filter(models.Apartment.owner_id==owner_id).all()
    result = []
    for ap in aps:
        apps = db.query(models.Application).filter(models.Application.apartment_id==ap.id).all()
        apps_out = []
        for a in apps:
            applicant = db.query(models.User).filter(models.User.id==a.applicant_id).first()
            apps_out.append({
                'id': a.id,
                'message': a.message,
                'status': a.status,
                'applicant_id': a.applicant_id,
                'applicant_name': applicant.full_name if applicant else None,
                'applicant_phone': None,
                'apartment_id': a.apartment_id,
            })
        result.append({'apartment': {'id': ap.id, 'title': ap.title}, 'applications': apps_out})
    return result

def accept_application(db: Session, application_id: int, owner_id: int):
    a = db.query(models.Application).filter(models.Application.id==application_id).first()
    if not a:
        return None
    # verify owner
    ap = get_apartment(db, a.apartment_id)
    if not ap or ap.owner_id != owner_id:
        return None
    a.status = 'accepted'
    db.add(a)
    db.commit()
    db.refresh(a)
    # notify applicant
    note = models.Notification(
        user_id=a.applicant_id,
        message=f"Your application to '{ap.title}' was accepted",
        created_at=datetime.utcnow().isoformat(),
    )
    db.add(note)
    db.commit()
    try:
        push.send_push_to_user(
            db,
            a.applicant_id,
            title="Soldier Housing",
            message=note.message,
            url="/",
        )
    except Exception:
        pass
    return a


def upsert_push_subscription(db: Session, user_id: int, endpoint: str, p256dh: str, auth: str):
    endpoint = (endpoint or '').strip()
    p256dh = (p256dh or '').strip()
    auth = (auth or '').strip()
    if not endpoint or not p256dh or not auth:
        raise ValueError('Invalid subscription')

    existing = db.query(models.PushSubscription).filter(models.PushSubscription.endpoint == endpoint).first()
    if existing:
        existing.user_id = user_id
        existing.p256dh = p256dh
        existing.auth = auth
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing

    sub = models.PushSubscription(user_id=user_id, endpoint=endpoint, p256dh=p256dh, auth=auth)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


def delete_push_subscription(db: Session, user_id: int, endpoint: str) -> bool:
    endpoint = (endpoint or '').strip()
    if not endpoint:
        return False
    sub = (
        db.query(models.PushSubscription)
        .filter(models.PushSubscription.user_id == user_id)
        .filter(models.PushSubscription.endpoint == endpoint)
        .first()
    )
    if not sub:
        return False
    db.delete(sub)
    db.commit()
    return True

def list_applications_for_apartment(db: Session, apartment_id: int):
    return db.query(models.Application).filter(models.Application.apartment_id==apartment_id).all()

def list_notifications(db: Session, user_id: int):
    return db.query(models.Notification).filter(models.Notification.user_id==user_id).order_by(models.Notification.id.desc()).all()

def mark_notification_read(db: Session, notification_id: int, user_id: int):
    n = db.query(models.Notification).filter(models.Notification.id==notification_id, models.Notification.user_id==user_id).first()
    if not n:
        return None
    n.is_read = True
    db.add(n)
    db.commit()
    db.refresh(n)
    return n


def get_application(db: Session, application_id: int):
    return db.query(models.Application).filter(models.Application.id==application_id).first()


# user updates
def update_user(db: Session, user_obj: models.User, updates: dict):
    if 'full_name' in updates:
        user_obj.full_name = updates.get('full_name')
    db.add(user_obj)
    db.commit()
    db.refresh(user_obj)
    return user_obj


def get_my_phone(db: Session, user_id: int):
    u = db.query(models.User).filter(models.User.id == user_id).first()
    if not u:
        return None
    return {"phone_number": u.phone_number, "phone_verified": bool(getattr(u, 'phone_verified', False))}


def set_my_phone(db: Session, user_id: int, phone_number: str):
    u = db.query(models.User).filter(models.User.id == user_id).first()
    if not u:
        return None
    # Minimal "verification" for now: treat a provided number as verified.
    # If you later add real SMS verification, set phone_verified only after code confirm.
    u.phone_number = (phone_number or '').strip()
    u.phone_verified = True if u.phone_number else False
    db.add(u)
    db.commit()
    db.refresh(u)
    return {"phone_number": u.phone_number, "phone_verified": bool(getattr(u, 'phone_verified', False))}


def create_external_listing(db: Session, created_by_user_id: int, payload: schemas.ExternalListingCreate):
    listing = models.ExternalListing(
        created_by_user_id=created_by_user_id,
        source=(payload.source or '').strip().lower(),
        url=(payload.url or '').strip(),
        title=(payload.title or None),
        price=payload.price,
        location=(payload.location or None),
        notes=(payload.notes or None),
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return listing


def list_external_listings(db: Session, skip: int = 0, limit: int = 20, search: str | None = None):
    q = db.query(models.ExternalListing)
    s = (search or '').strip()
    if s:
        like = f"%{s}%"
        q = q.filter(
            or_(
                models.ExternalListing.title.ilike(like),
                models.ExternalListing.url.ilike(like),
                models.ExternalListing.location.ilike(like),
                models.ExternalListing.notes.ilike(like),
                models.ExternalListing.source.ilike(like),
            )
        )
    q = q.order_by(models.ExternalListing.created_at.desc())
    total = q.count()
    items = q.offset(skip).limit(limit).all()
    return items, total


def get_external_listing(db: Session, listing_id):
    return db.query(models.ExternalListing).filter(models.ExternalListing.id == listing_id).first()


def get_interest_counts(db: Session, listing_ids: list):
    if not listing_ids:
        return {}
    rows = (
        db.query(models.ExternalListingInterest.listing_id, func.count(models.ExternalListingInterest.id))
        .filter(models.ExternalListingInterest.listing_id.in_(listing_ids))
        .group_by(models.ExternalListingInterest.listing_id)
        .all()
    )
    return {r[0]: int(r[1]) for r in rows}


def get_user_interests_map(db: Session, user_id: int, listing_ids: list):
    if not listing_ids:
        return set()
    rows = (
        db.query(models.ExternalListingInterest.listing_id)
        .filter(models.ExternalListingInterest.user_id == user_id)
        .filter(models.ExternalListingInterest.listing_id.in_(listing_ids))
        .all()
    )
    return {r[0] for r in rows}


def add_interest(db: Session, listing_id, user_id: int) -> bool:
    try:
        row = models.ExternalListingInterest(listing_id=listing_id, user_id=user_id)
        db.add(row)
        db.commit()
        return True
    except IntegrityError:
        db.rollback()
        return False


def remove_interest(db: Session, listing_id, user_id: int) -> bool:
    deleted = (
        db.query(models.ExternalListingInterest)
        .filter(models.ExternalListingInterest.listing_id == listing_id)
        .filter(models.ExternalListingInterest.user_id == user_id)
        .delete()
    )
    db.commit()
    return bool(deleted)


def _user_phone_ready(u: models.User) -> bool:
    return bool(getattr(u, 'phone_number', None)) and bool(getattr(u, 'phone_verified', False))


def create_contact_request(db: Session, requester_user_id: int, target_user_id: int, listing_id):
    if requester_user_id == target_user_id:
        raise ValueError('Cannot request contact with yourself')

    requester = db.query(models.User).filter(models.User.id == requester_user_id).first()
    target = db.query(models.User).filter(models.User.id == target_user_id).first()
    if not requester or not target:
        raise ValueError('User not found')

    if not _user_phone_ready(requester) or not _user_phone_ready(target):
        raise PermissionError('Both users must have a verified phone number')

    listing = get_external_listing(db, listing_id)
    if not listing:
        raise ValueError('Listing not found')
    if listing.created_by_user_id != target_user_id:
        # keep it tight: contact exchange is only with the user who posted the listing
        raise PermissionError('Target user must be the listing creator')

    existing = (
        db.query(models.ContactRequest)
        .filter(models.ContactRequest.requester_user_id == requester_user_id)
        .filter(models.ContactRequest.target_user_id == target_user_id)
        .filter(models.ContactRequest.listing_id == listing_id)
        .first()
    )
    if existing:
        return existing

    cr = models.ContactRequest(
        requester_user_id=requester_user_id,
        target_user_id=target_user_id,
        listing_id=listing_id,
        status='pending',
    )
    db.add(cr)
    db.commit()
    db.refresh(cr)
    return cr


def list_incoming_contact_requests(db: Session, user_id: int):
    return (
        db.query(models.ContactRequest)
        .filter(models.ContactRequest.target_user_id == user_id)
        .filter(models.ContactRequest.status == 'pending')
        .order_by(models.ContactRequest.created_at.desc())
        .all()
    )


def accept_contact_request(db: Session, request_id, current_user_id: int):
    cr = db.query(models.ContactRequest).filter(models.ContactRequest.id == request_id).first()
    if not cr or cr.target_user_id != current_user_id:
        return None

    target = db.query(models.User).filter(models.User.id == cr.target_user_id).first()
    requester = db.query(models.User).filter(models.User.id == cr.requester_user_id).first()
    if not target or not requester:
        raise ValueError('User not found')
    if not _user_phone_ready(target) or not _user_phone_ready(requester):
        raise PermissionError('Both users must have a verified phone number')

    cr.status = 'accepted'
    db.add(cr)
    db.commit()
    db.refresh(cr)
    return cr


def decline_contact_request(db: Session, request_id, current_user_id: int):
    cr = db.query(models.ContactRequest).filter(models.ContactRequest.id == request_id).first()
    if not cr or cr.target_user_id != current_user_id:
        return None
    cr.status = 'declined'
    db.add(cr)
    db.commit()
    db.refresh(cr)
    return cr


def get_contact_request(db: Session, request_id):
    return db.query(models.ContactRequest).filter(models.ContactRequest.id == request_id).first()


def change_user_password(db: Session, user_obj: models.User, current_password: str, new_password: str):
    # verify current
    if not pwd_context.verify(current_password, user_obj.hashed_password):
        return None
    # hash new
    hashed = pwd_context.hash(new_password)
    user_obj.hashed_password = hashed
    db.add(user_obj)
    db.commit()
    db.refresh(user_obj)
    return user_obj


def set_user_password(db: Session, user_obj: models.User, new_password: str):
    hashed = pwd_context.hash(new_password)
    user_obj.hashed_password = hashed
    db.add(user_obj)
    db.commit()
    db.refresh(user_obj)
    return user_obj
