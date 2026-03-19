from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, timezone
from app.database import get_db
from app.models.db import MedicationLog, Patient
from app.middleware.auth import verify_jwt

router = APIRouter(prefix="/report", tags=["Reports"])

class LogCreate(BaseModel):
    patient_id: str
    medicine_name: str
    scheduled_time: str  # ISO datetime string
    taken: bool = False

@router.post("/log")
def log_dose(data: LogCreate, db: Session = Depends(get_db), user=Depends(verify_jwt)):
    patient = db.query(Patient).filter(Patient.id == data.patient_id, Patient.user_id == user["sub"]).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    try:
        scheduled_dt = datetime.fromisoformat(data.scheduled_time)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid scheduled_time format. Use ISO format.")

    log = MedicationLog(
        patient_id=data.patient_id,
        medicine_name=data.medicine_name,
        scheduled_time=scheduled_dt,
        taken=data.taken,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return {"id": log.id, "taken": log.taken}

@router.get("/weekly/{patient_id}")
def weekly_report(patient_id: str, db: Session = Depends(get_db), user=Depends(verify_jwt)):
    patient = db.query(Patient).filter(Patient.id == patient_id, Patient.user_id == user["sub"]).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    since = datetime.now(timezone.utc) - timedelta(days=7)
    logs = db.query(MedicationLog).filter(
        MedicationLog.patient_id == patient_id,
        MedicationLog.timestamp >= since
    ).all()

    total = len(logs)
    taken = sum(1 for l in logs if l.taken)
    missed = total - taken
    adherence_pct = round((taken / total) * 100, 1) if total > 0 else 0

    if adherence_pct >= 90:
        suggestion = "Excellent adherence! Keep it up. 💪"
    elif adherence_pct >= 70:
        suggestion = "Good job, but try to avoid missing doses. Set reminders!"
    elif adherence_pct >= 50:
        suggestion = "Adherence is below average. Consider setting alarms for each medicine."
    else:
        suggestion = "Critical: Very low adherence. Please consult your doctor. 🚨"

    by_medicine: dict = {}
    for log in logs:
        name = log.medicine_name
        if name not in by_medicine:
            by_medicine[name] = {"taken": 0, "missed": 0}
        if log.taken:
            by_medicine[name]["taken"] += 1
        else:
            by_medicine[name]["missed"] += 1

    return {
        "period": "Last 7 days",
        "total_doses": total,
        "taken": taken,
        "missed": missed,
        "adherence_percentage": adherence_pct,
        "suggestion": suggestion,
        "by_medicine": by_medicine
    }
