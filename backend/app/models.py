from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False)
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
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="apartments")
    applications = relationship("Application", back_populates="apartment")

class Application(Base):
    __tablename__ = "applications"
    id = Column(Integer, primary_key=True, index=True)
    message = Column(Text)
    applicant_id = Column(Integer, ForeignKey("users.id"))
    apartment_id = Column(Integer, ForeignKey("apartments.id"))
    applicant = relationship("User", back_populates="applications")
    apartment = relationship("Apartment", back_populates="applications")
