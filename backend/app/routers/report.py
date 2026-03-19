from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone
from app.database import get_db
from app.models.db import MedicationLog, Patient, Medicine, Reminder, Vital, InsuranceDetail
from app.middleware.auth import verify_jwt
from app.config import settings

router = APIRouter(prefix="/report", tags=["Reports"])

class LogCreate(BaseModel):
    patient_id: str
    medicine_name: str
    scheduled_time: str
    taken: bool = False

@router.post("/log")
def log_dose(data: LogCreate, db: Session = Depends(get_db), user=Depends(verify_jwt)):
    patient = db.query(Patient).filter(Patient.id == data.patient_id, Patient.user_id == user["sub"]).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    try:
        scheduled_dt = datetime.fromisoformat(data.scheduled_time)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid scheduled_time format.")

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

@router.get("/ai-summary/{patient_id}")
def ai_summary(patient_id: str, db: Session = Depends(get_db), user=Depends(verify_jwt)):
    """Generate an AI-powered weekly health summary using Groq llama-3.1-8b-instant."""
    patient = db.query(Patient).filter(Patient.id == patient_id, Patient.user_id == user["sub"]).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if not settings.groq_api:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")

    since = datetime.now(timezone.utc) - timedelta(days=7)

    # Gather all patient data
    medicines = db.query(Medicine).filter(Medicine.patient_id == patient_id).all()
    reminders = db.query(Reminder).filter(Reminder.patient_id == patient_id).all()
    logs = db.query(MedicationLog).filter(
        MedicationLog.patient_id == patient_id,
        MedicationLog.timestamp >= since
    ).all()
    vitals = db.query(Vital).filter(
        Vital.patient_id == patient_id,
        Vital.timestamp >= since
    ).order_by(Vital.timestamp).all()
    insurance = db.query(InsuranceDetail).filter(InsuranceDetail.patient_id == patient_id).first()

    # Build medication adherence stats
    total = len(logs)
    taken = sum(1 for l in logs if l.taken)
    adherence_pct = round((taken / total) * 100, 1) if total > 0 else 0

    by_medicine: dict = {}
    for log in logs:
        n = log.medicine_name
        if n not in by_medicine:
            by_medicine[n] = {"taken": 0, "missed": 0}
        if log.taken:
            by_medicine[n]["taken"] += 1
        else:
            by_medicine[n]["missed"] += 1

    # Build vitals summary
    vitals_summary = []
    for v in vitals:
        entry = []
        if v.heart_rate:
            entry.append(f"HR={v.heart_rate}BPM")
        if v.steps:
            entry.append(f"Steps={v.steps}")
        if v.activity_level:
            entry.append(f"Activity={v.activity_level}")
        if entry:
            ts = v.timestamp.strftime("%b %d") if v.timestamp else ""
            vitals_summary.append(f"{ts}: {', '.join(entry)}")

    # Build context prompt
    med_list = ", ".join([
        f"{m.name} ({m.dosage or 'no dosage'}, {m.frequency or 'no frequency'}, expires {m.expiry_date or 'N/A'})"
        for m in medicines
    ]) or "None"

    reminder_list = ", ".join([
        f"{r.reminder_time.strftime('%H:%M')} ({r.repeat_type})" for r in reminders
    ]) or "None"

    adherence_detail = "; ".join([
        f"{name}: {s['taken']} taken, {s['missed']} missed"
        for name, s in by_medicine.items()
    ]) or "No logs this week"

    vitals_text = "; ".join(vitals_summary) or "No vitals recorded this week"

    insurance_text = "None"
    if insurance:
        status = "Connected ✅" if insurance.is_connected else "Not Connected ❌"
        insurance_text = f"{insurance.insurance_company}, Policy {insurance.policy_number}, Hospital: {insurance.hospital_name} — {status}"

    prompt = f"""You are a smart health assistant AI. Analyze the following weekly patient health data and generate a detailed, personalized health report in a friendly, clear tone.

PATIENT: {patient.patient_name} (Age: {patient.age or 'Unknown'}, Relation: {patient.relation or 'N/A'})

MEDICATIONS PRESCRIBED:
{med_list}

REMINDERS SET:
{reminder_list}

MEDICATION ADHERENCE (Last 7 Days):
Overall: {adherence_pct}% ({taken}/{total} doses taken)
Per medicine: {adherence_detail}

VITALS (Last 7 Days):
{vitals_text}

INSURANCE:
{insurance_text}

Please generate a comprehensive weekly health report. Include:
1. **Overall Health Summary** — mention patient name and key highlights
2. **Medication Adherence Analysis** — be specific per medicine, flag any missed doses
3. **Vitals Analysis** — identify any concerning trends in heart rate or activity
4. **Reminders Effectiveness** — are reminders well-spaced?
5. **Insurance Recommendation** — is their hospital covered?
6. **Action Items for Next Week** — 3–5 specific, actionable recommendations
7. **Motivational Message** — a short encouraging note

Keep the report concise but thorough. Use markdown formatting with headers and bullet points."""

    def stream_groq():
        try:
            from groq import Groq
            client = Groq(api_key=settings.groq_api)
            completion = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_completion_tokens=1024,
                top_p=1,
                stream=True,
            )
            for chunk in completion:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta
        except Exception as e:
            yield f"\n\n[Error generating AI report: {str(e)}]"

    return StreamingResponse(stream_groq(), media_type="text/plain")
