from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from . import models, schemas, crud
from .database import engine, get_db
from .auth import create_access_token, get_current_user
from .config import SECRET_KEY

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Soldier Housing API")

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

@app.post("/apartments", response_model=schemas.ApartmentOut)
def create_apartment(apartment: schemas.ApartmentCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    return crud.create_apartment(db, apartment, owner_id=current_user.id)

@app.get("/apartments", response_model=list[schemas.ApartmentOut])
def list_apartments(db: Session = Depends(get_db)):
    return crud.list_apartments(db)

@app.get("/apartments/{apartment_id}", response_model=schemas.ApartmentOut)
def get_apartment(apartment_id: int, db: Session = Depends(get_db)):
    ap = crud.get_apartment(db, apartment_id)
    if not ap:
        raise HTTPException(status_code=404, detail="Not found")
    return ap

@app.post("/apartments/{apartment_id}/apply", response_model=schemas.ApplicationOut)
def apply_apartment(apartment_id: int, application: schemas.ApplicationCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    ap = crud.get_apartment(db, apartment_id)
    if not ap:
        raise HTTPException(status_code=404, detail="Apartment not found")
    return crud.apply_to_apartment(db, applicant_id=current_user.id, apartment_id=apartment_id, message=application.message)

