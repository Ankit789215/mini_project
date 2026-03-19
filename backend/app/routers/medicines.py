from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.middleware.auth import verify_jwt
from app.models.medicine import MedicineCreate, MedicineResponse
from app.models.db import Medicine as MedicineDB, Patient as PatientDB
from app.database import get_db
from datetime import date

router = APIRouter(prefix="/medicines", tags=["Medicines"])

def verify_patient_ownership(patient_id: str, user_id: str, db: Session):
    patient = db.query(PatientDB).filter(PatientDB.id == patient_id, PatientDB.user_id == user_id).first()
    if not patient:
        raise HTTPException(status_code=403, detail="Not authorized to access medicines for this patient.")

@router.get("/patient/{patient_id}", response_model=list[MedicineResponse])
def get_medicines_for_patient(patient_id: str, limit: int = 50, offset: int = 0, user: dict = Depends(verify_jwt), db: Session = Depends(get_db)):
    verify_patient_ownership(patient_id, user["user_id"], db)
    try:
        meds_db = db.query(MedicineDB).filter(MedicineDB.patient_id == patient_id).order_by(MedicineDB.created_at.desc()).offset(offset).limit(limit).all()
        
        today = date.today()
        for med in meds_db:
            if med.expiry_date:
                med.days_to_expiry = (med.expiry_date - today).days
            else:
                med.days_to_expiry = None
                
        return meds_db
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("", response_model=MedicineResponse, status_code=status.HTTP_201_CREATED)
def create_medicine(body: MedicineCreate, user: dict = Depends(verify_jwt), db: Session = Depends(get_db)):
    verify_patient_ownership(str(body.patient_id), user["user_id"], db)
    try:
        new_med = MedicineDB(
            patient_id=str(body.patient_id),
            name=body.name,
            dosage=body.dosage,
            frequency=body.frequency,
            expiry_date=body.expiry_date
        )
        db.add(new_med)
        db.commit()
        db.refresh(new_med)
        
        if new_med.expiry_date:
            new_med.days_to_expiry = (new_med.expiry_date - date.today()).days
        else:
            new_med.days_to_expiry = None
            
        return new_med
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{medicine_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_medicine(medicine_id: str, user: dict = Depends(verify_jwt), db: Session = Depends(get_db)):
    med = db.query(MedicineDB).filter(MedicineDB.id == medicine_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medicine not found.")
        
    verify_patient_ownership(med.patient_id, user["user_id"], db)
    
    try:
        db.delete(med)
        db.commit()
        return None
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
