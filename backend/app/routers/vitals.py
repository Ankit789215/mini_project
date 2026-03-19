from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, timezone
from app.database import get_db
from app.models.db import Vital, Patient
from app.middleware.auth import verify_jwt

router = APIRouter(prefix="/vitals", tags=["Vitals"])

class VitalCreate(BaseModel):
    patient_id: str
    heart_rate: Optional[int] = None
    steps: Optional[int] = None
    activity_level: Optional[str] = None

@router.post("")
def save_vitals(data: VitalCreate, db: Session = Depends(get_db), user=Depends(verify_jwt)):
    patient = db.query(Patient).filter(Patient.id == data.patient_id, Patient.user_id == user["user_id"]).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    vital = Vital(
        patient_id=data.patient_id,
        heart_rate=data.heart_rate,
        steps=data.steps,
        activity_level=data.activity_level,
    )
    db.add(vital)
    db.commit()
    db.refresh(vital)
    return {"id": vital.id, "timestamp": vital.timestamp}

@router.get("/{patient_id}")
def get_vitals(patient_id: str, db: Session = Depends(get_db), user=Depends(verify_jwt)):
    patient = db.query(Patient).filter(Patient.id == patient_id, Patient.user_id == user["user_id"]).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    since = datetime.now(timezone.utc) - timedelta(days=7)
    records = db.query(Vital).filter(
        Vital.patient_id == patient_id,
        Vital.timestamp >= since
    ).order_by(Vital.timestamp).all()

    return [
        {
            "id": v.id,
            "heart_rate": v.heart_rate,
            "steps": v.steps,
            "activity_level": v.activity_level,
            "timestamp": v.timestamp.isoformat() if v.timestamp else None
        }
        for v in records
    ]
