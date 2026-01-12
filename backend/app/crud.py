from sqlalchemy.orm import Session
from . import models, schemas
from passlib.context import CryptContext

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
    db_user = models.User(email=user.email, full_name=user.full_name, phone=getattr(user, 'phone', None), hashed_password=hashed, is_admin=is_admin)
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
        note = models.Notification(user_id=apartment.owner_id, message=f"New application for '{apartment.title}' from user#{applicant_id}")
        db.add(note)
        db.commit()
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
                'applicant_phone': applicant.phone if applicant and a.status=='accepted' else None,
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
    note = models.Notification(user_id=a.applicant_id, message=f"Your application to '{ap.title}' was accepted")
    db.add(note)
    db.commit()
    return a

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
    if 'phone' in updates:
        user_obj.phone = updates.get('phone')
    db.add(user_obj)
    db.commit()
    db.refresh(user_obj)
    return user_obj


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
