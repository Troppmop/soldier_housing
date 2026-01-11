from app.database import engine
from app import models
from app.config import ADMIN_EMAIL, ADMIN_PASSWORD
from app import crud
from sqlalchemy.orm import Session
from app.database import SessionLocal

# create tables
models.Base.metadata.create_all(bind=engine)

# create default admin if not exists
db: Session = SessionLocal()
try:
    admin = crud.get_user_by_email(db, ADMIN_EMAIL)
    if not admin:
        from pydantic import BaseModel
        class Admin(BaseModel):
            email: str
            password: str
            full_name: str | None = None
        crud.create_user(db, Admin(email=ADMIN_EMAIL, password=ADMIN_PASSWORD), is_admin=True)
        print("Default admin created:", ADMIN_EMAIL)
    else:
        print("Admin already exists")
finally:
    db.close()

if __name__ == '__main__':
    pass
