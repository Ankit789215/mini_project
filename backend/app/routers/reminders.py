from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.middleware.auth import verify_jwt
from app.models.reminder import ReminderCreate, ReminderResponse
from app.models.db import Reminder as ReminderDB, Patient as PatientDB
from app.database import get_db

router = APIRouter(prefix="/reminders", tags=["Reminders"])

def verify_patient_ownership(patient_id: str, user_id: str, db: Session):
    patient = db.query(PatientDB).filter(PatientDB.id == patient_id, PatientDB.user_id == user_id).first()
    if not patient:
        raise HTTPException(status_code=403, detail="Not authorized to access reminders for this patient.")

@router.get("/patient/{patient_id}", response_model=list[ReminderResponse])
def get_reminders_for_patient(patient_id: str, user: dict = Depends(verify_jwt), db: Session = Depends(get_db)):
    verify_patient_ownership(patient_id, user["user_id"], db)
    try:
        rems = db.query(ReminderDB).filter(ReminderDB.patient_id == patient_id).order_by(ReminderDB.reminder_time.asc()).all()
        return rems
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("", response_model=ReminderResponse, status_code=status.HTTP_201_CREATED)
def create_reminder(body: ReminderCreate, user: dict = Depends(verify_jwt), db: Session = Depends(get_db)):
    verify_patient_ownership(str(body.patient_id), user["user_id"], db)
    try:
        new_rem = ReminderDB(
            patient_id=str(body.patient_id),
            reminder_time=body.reminder_time,
            repeat_type=body.repeat_type
        )
        db.add(new_rem)
        db.commit()
        db.refresh(new_rem)
        return new_rem
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reminder(reminder_id: str, user: dict = Depends(verify_jwt), db: Session = Depends(get_db)):
    rem = db.query(ReminderDB).filter(ReminderDB.id == reminder_id).first()
    if not rem:
        raise HTTPException(status_code=404, detail="Reminder not found.")
        
    verify_patient_ownership(rem.patient_id, user["user_id"], db)
    
    try:
        db.delete(rem)
        db.commit()
        return None
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
