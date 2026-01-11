from sqlalchemy.orm import Session
from . import models, schemas
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# user
def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user: schemas.UserCreate, is_admin: bool=False):
    hashed = pwd_context.hash(user.password)
    db_user = models.User(email=user.email, full_name=user.full_name, hashed_password=hashed, is_admin=is_admin)
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
    app = models.Application(message=message, applicant_id=applicant_id, apartment_id=apartment_id)
    db.add(app)
    db.commit()
    db.refresh(app)
    return app

def list_applications_for_apartment(db: Session, apartment_id: int):
    return db.query(models.Application).filter(models.Application.apartment_id==apartment_id).all()
