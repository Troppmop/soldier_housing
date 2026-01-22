from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, BigInteger
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False)

    # Password reset (6-digit code) support
    reset_code_hash = Column(String, nullable=True)
    reset_code_expires_at = Column(BigInteger, nullable=True)  # unix epoch seconds

    apartments = relationship("Apartment", back_populates="owner")
    applications = relationship("Application", back_populates="applicant")

class Apartment(Base):
    __tablename__ = "apartments"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text)
    location = Column(String, index=True)
    rooms = Column(Integer, default=1)
    rent = Column(Integer)
    listing_type = Column(String, default='offer', index=True)

    # Listing attributes / filters
    gender = Column(String, nullable=True)  # 'male' | 'female'
    shomer_shabbos = Column(Boolean, default=False)
    shomer_kashrut = Column(Boolean, default=False)
    opposite_gender_allowed = Column(Boolean, default=False)
    smoking_allowed = Column(Boolean, default=False)

    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="apartments")
    applications = relationship("Application", back_populates="apartment")

class Application(Base):
    __tablename__ = "applications"
    id = Column(Integer, primary_key=True, index=True)
    message = Column(Text)
    status = Column(String, default="pending")
    applicant_id = Column(Integer, ForeignKey("users.id"))
    apartment_id = Column(Integer, ForeignKey("apartments.id"))
    applicant = relationship("User", back_populates="applications")
    apartment = relationship("Apartment", back_populates="applications")


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    message = Column(Text)
    is_read = Column(Boolean, default=False)
    created_at = Column(String, nullable=True)
    user = relationship("User")
