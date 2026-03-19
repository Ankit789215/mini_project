from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.middleware.auth import verify_jwt
from app.models.patient import PatientCreate, PatientResponse
from app.models.db import Patient as PatientDB
from app.database import get_db

router = APIRouter(prefix="/patients", tags=["Patients"])

@router.get("", response_model=list[PatientResponse])
def get_patients(limit: int = 20, offset: int = 0, user: dict = Depends(verify_jwt), db: Session = Depends(get_db)):
    """Fetch all patients belonging to the authenticated user with pagination."""
    user_id = user["user_id"]
    try:
        patients = db.query(PatientDB).filter(PatientDB.user_id == user_id).order_by(PatientDB.created_at.desc()).offset(offset).limit(limit).all()
        return patients
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
def create_patient(body: PatientCreate, user: dict = Depends(verify_jwt), db: Session = Depends(get_db)):
    """Create a new patient linked to the authenticated user."""
    try:
        new_patient = PatientDB(
            user_id=user["user_id"],
            patient_name=body.patient_name,
            age=body.age,
            relation=body.relation,
            email=body.email
        )
        db.add(new_patient)
        db.commit()
        db.refresh(new_patient)
        return new_patient
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient(patient_id: str, user: dict = Depends(verify_jwt), db: Session = Depends(get_db)):
    """Delete a patient (only if owned by the user)."""
    patient = db.query(PatientDB).filter(PatientDB.id == patient_id, PatientDB.user_id == user["user_id"]).first()
    if not patient:
        raise HTTPException(status_code=403, detail="Not authorized to delete this patient or it does not exist.")
    
    try:
        db.delete(patient)
        db.commit()
        return None
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
