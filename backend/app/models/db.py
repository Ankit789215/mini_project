from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Date, Boolean, Float
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.mysql import CHAR
from app.database import Base
from datetime import datetime, timezone
import uuid

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    
    id = Column(CHAR(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    patients = relationship("Patient", back_populates="user", cascade="all, delete-orphan")

class Patient(Base):
    __tablename__ = "patients"
    
    id = Column(CHAR(36), primary_key=True, default=generate_uuid)
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    patient_name = Column(String(255), nullable=False)
    age = Column(Integer, nullable=True)
    relation = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    user = relationship("User", back_populates="patients")
    medicines = relationship("Medicine", back_populates="patient", cascade="all, delete-orphan")
    reminders = relationship("Reminder", back_populates="patient", cascade="all, delete-orphan")
    insurance = relationship("InsuranceDetail", back_populates="patient", uselist=False, cascade="all, delete-orphan")
    medication_logs = relationship("MedicationLog", back_populates="patient", cascade="all, delete-orphan")
    vitals = relationship("Vital", back_populates="patient", cascade="all, delete-orphan")

class Medicine(Base):
    __tablename__ = "medicines"
    
    id = Column(CHAR(36), primary_key=True, default=generate_uuid)
    patient_id = Column(CHAR(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    dosage = Column(String(255), nullable=True)
    frequency = Column(String(255), nullable=True)
    expiry_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    patient = relationship("Patient", back_populates="medicines")

class Reminder(Base):
    __tablename__ = "reminders"
    
    id = Column(CHAR(36), primary_key=True, default=generate_uuid)
    patient_id = Column(CHAR(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    reminder_time = Column(DateTime, nullable=False)
    repeat_type = Column(String(50), default="none")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    patient = relationship("Patient", back_populates="reminders")

class InsuranceDetail(Base):
    __tablename__ = "insurance_details"

    id = Column(CHAR(36), primary_key=True, default=generate_uuid)
    patient_id = Column(CHAR(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, unique=True)
    insurance_company = Column(String(255), nullable=False)
    policy_number = Column(String(255), nullable=False)
    hospital_name = Column(String(255), nullable=False)
    is_verified = Column(Boolean, default=False)
    is_connected = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    patient = relationship("Patient", back_populates="insurance")

class MedicationLog(Base):
    __tablename__ = "medication_logs"

    id = Column(CHAR(36), primary_key=True, default=generate_uuid)
    patient_id = Column(CHAR(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    medicine_name = Column(String(255), nullable=False)
    scheduled_time = Column(DateTime, nullable=False)
    taken = Column(Boolean, default=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    patient = relationship("Patient", back_populates="medication_logs")

class Vital(Base):
    __tablename__ = "vitals"

    id = Column(CHAR(36), primary_key=True, default=generate_uuid)
    patient_id = Column(CHAR(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    heart_rate = Column(Integer, nullable=True)
    steps = Column(Integer, nullable=True)
    activity_level = Column(String(50), nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    patient = relationship("Patient", back_populates="vitals")
