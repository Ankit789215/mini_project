from fastapi import APIRouter, Depends, HTTPException, status
from app.middleware.auth import verify_jwt
from app.models.reminder import ReminderCreate, ReminderResponse
from app.database import supabase
from uuid import uuid4

router = APIRouter(prefix="/reminders", tags=["Reminders"])

async def verify_patient_ownership(patient_id: str, user_id: str):
    check = supabase.table("patients").select("id").eq("id", patient_id).eq("user_id", user_id).execute()
    if not check.data:
        raise HTTPException(status_code=403, detail="Not authorized to access reminders for this patient.")

@router.get("/patient/{patient_id}", response_model=list[ReminderResponse])
async def get_reminders_for_patient(patient_id: str, user: dict = Depends(verify_jwt)):
    await verify_patient_ownership(patient_id, user["user_id"])
    try:
        response = supabase.table("reminders").select("*").eq("patient_id", patient_id).order("reminder_time", desc=False).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("", response_model=ReminderResponse, status_code=status.HTTP_201_CREATED)
async def create_reminder(body: ReminderCreate, user: dict = Depends(verify_jwt)):
    await verify_patient_ownership(str(body.patient_id), user["user_id"])
    
    record = {
        "id": str(uuid4()),
        "patient_id": str(body.patient_id),
        "reminder_time": body.reminder_time.isoformat(),
        "repeat_type": body.repeat_type
    }
    try:
        response = supabase.table("reminders").insert(record).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reminder(reminder_id: str, user: dict = Depends(verify_jwt)):
    rem_check = supabase.table("reminders").select("patient_id").eq("id", reminder_id).execute()
    if not rem_check.data:
        raise HTTPException(status_code=404, detail="Reminder not found.")
        
    await verify_patient_ownership(rem_check.data[0]["patient_id"], user["user_id"])
    
    try:
        supabase.table("reminders").delete().eq("id", reminder_id).execute()
        return None
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
