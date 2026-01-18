import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from . import models, schemas, crud
from .database import engine, get_db, SessionLocal
from sqlalchemy import text
from .auth import create_access_token, get_current_user
from . import config

app = FastAPI(title="Soldier Housing API")

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
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/users/me", response_model=schemas.UserOut)
def read_users_me(current_user = Depends(get_current_user)):
    return current_user


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
        'owner_id': ap.owner_id,
        'owner_name': owner.full_name if owner else None,
    }


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
    applicant = None
    from .crud import list_notifications
    # return richer application output
    user = crud.get_user_by_email(db, current_user.email)
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

    # determine visibility: phones visible to owner and applicant only when status == 'accepted'
    owner_phone = None
    applicant_phone = None
    if a.status == 'accepted' and current_user:
        if current_user.id == a.applicant_id or (ap and current_user.id == ap.owner_id):
            if owner:
                owner_phone = owner.phone
            if applicant:
                applicant_phone = applicant.phone

    return {
        'id': a.id,
        'message': a.message,
        'status': a.status,
        'applicant_id': a.applicant_id,
        'applicant_name': applicant.full_name if applicant else None,
        'applicant_phone': applicant_phone,
        'owner_id': owner.id if owner else None,
        'owner_name': owner.full_name if owner else None,
        'owner_phone': owner_phone,
        'apartment_id': a.apartment_id,
        'apartment_title': ap.title if ap else None,
    }


@app.get('/admin/users')
def admin_list_users(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if not getattr(current_user, 'is_admin', False):
        raise HTTPException(status_code=403, detail='Not authorized')
    users = db.query(models.User).all()
    return [{'id': u.id, 'email': u.email, 'full_name': u.full_name, 'phone': u.phone, 'is_admin': u.is_admin} for u in users]


@app.get('/admin/apartments')
def admin_list_apartments(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if not getattr(current_user, 'is_admin', False):
        raise HTTPException(status_code=403, detail='Not authorized')
    aps = db.query(models.Apartment).all()
    out = []
    for a in aps:
        owner = db.query(models.User).filter(models.User.id == a.owner_id).first() if a.owner_id else None
        out.append({'id': a.id, 'title': a.title, 'description': a.description, 'owner_id': a.owner_id, 'owner_email': owner.email if owner else None})
    return out


@app.delete('/admin/users/{user_id}')
def admin_delete_user(user_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if not getattr(current_user, 'is_admin', False):
        raise HTTPException(status_code=403, detail='Not authorized')
    # prevent deleting self
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail='Cannot delete self')
    u = db.query(models.User).filter(models.User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail='User not found')
    # cascade delete apartments and applications via DB defaults; here remove explicit relations
    # remove user's apartments
    db.query(models.Application).filter(models.Application.applicant_id==user_id).delete()
    db.query(models.Apartment).filter(models.Apartment.owner_id==user_id).delete()
    db.delete(u)
    db.commit()
    return {'ok': True}


@app.delete('/admin/apartments/{apartment_id}')
def admin_delete_apartment(apartment_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if not getattr(current_user, 'is_admin', False):
        raise HTTPException(status_code=403, detail='Not authorized')
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
    if not getattr(current_user, 'is_admin', False):
        raise HTTPException(status_code=403, detail='Not authorized')
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
            'applicant_phone': applicant.phone if applicant else None,
            'apartment_id': a.apartment_id,
            'apartment_title': ap.title if ap else None
        })
    return out


@app.delete('/admin/applications/{application_id}')
def admin_delete_application(application_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if not getattr(current_user, 'is_admin', False):
        raise HTTPException(status_code=403, detail='Not authorized')
    a = db.query(models.Application).filter(models.Application.id==application_id).first()
    if not a:
        raise HTTPException(status_code=404, detail='Not found')
    db.delete(a)
    db.commit()
    return {'ok': True}


@app.post('/admin/clean')
def admin_clean_db(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if not getattr(current_user, 'is_admin', False):
        raise HTTPException(status_code=403, detail='Not authorized')
    # Delete non-admin users, their apartments, applications, and notifications. Keep admin users.
    admin_ids = [u.id for u in db.query(models.User).filter(models.User.is_admin==True).all()]
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

