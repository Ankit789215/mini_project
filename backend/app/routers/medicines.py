from fastapi import APIRouter, Depends, HTTPException, status
from app.middleware.auth import verify_jwt
from app.models.medicine import MedicineCreate, MedicineResponse
from app.database import supabase
from datetime import date
from uuid import uuid4

router = APIRouter(prefix="/medicines", tags=["Medicines"])

async def verify_patient_ownership(patient_id: str, user_id: str):
    """Helper: Ensure the user actually owns the patient_id they are trying to link medicines to."""
    check = supabase.table("patients").select("id").eq("id", patient_id).eq("user_id", user_id).execute()
    if not check.data:
        raise HTTPException(status_code=403, detail="Not authorized to access medicines for this patient.")

@router.get("/patient/{patient_id}", response_model=list[MedicineResponse])
async def get_medicines_for_patient(patient_id: str, limit: int = 50, offset: int = 0, user: dict = Depends(verify_jwt)):
    """Fetch all medicines for a specific patient with pagination, calculating expiry days."""
    await verify_patient_ownership(patient_id, user["user_id"])
    
    try:
        response = supabase.table("medicines").select("*")\
            .eq("patient_id", patient_id)\
            .order("created_at", desc=True)\
            .range(offset, offset + limit - 1)\
            .execute()
        meds = response.data
        
        # Calculate days_to_expiry dynamically
        today = date.today()
        for med in meds:
            if med.get("expiry_date"):
                # "2024-12-31" -> string to date object
                expiry = date.fromisoformat(med["expiry_date"])
                med["days_to_expiry"] = (expiry - today).days
                
        return meds
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("", response_model=MedicineResponse, status_code=status.HTTP_201_CREATED)
async def create_medicine(body: MedicineCreate, user: dict = Depends(verify_jwt)):
    """Create a new medicine under a patient."""
    await verify_patient_ownership(str(body.patient_id), user["user_id"])
    
    record = {
        "id": str(uuid4()),
        "patient_id": str(body.patient_id),
        "name": body.name,
        "dosage": body.dosage,
        "frequency": body.frequency,
        "expiry_date": body.expiry_date.isoformat() if body.expiry_date else None
    }
    try:
        response = supabase.table("medicines").insert(record).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{medicine_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_medicine(medicine_id: str, user: dict = Depends(verify_jwt)):
    """Delete a medicine. Strict joining constraint applied."""
    # First, who owns this medicine?
    med_check = supabase.table("medicines").select("patient_id").eq("id", medicine_id).execute()
    if not med_check.data:
        raise HTTPException(status_code=404, detail="Medicine not found.")
        
    await verify_patient_ownership(med_check.data[0]["patient_id"], user["user_id"])
    
    try:
        supabase.table("medicines").delete().eq("id", medicine_id).execute()
        return None
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
