from fastapi import APIRouter, Depends, HTTPException, status
from app.middleware.auth import verify_jwt
from app.models.patient import PatientCreate, PatientResponse
from app.database import supabase
from uuid import uuid4

router = APIRouter(prefix="/patients", tags=["Patients"])

@router.get("", response_model=list[PatientResponse])
async def get_patients(limit: int = 20, offset: int = 0, user: dict = Depends(verify_jwt)):
    """Fetch all patients belonging to the authenticated user with pagination."""
    user_id = user["user_id"]
    try:
        response = supabase.table("patients").select("*")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .range(offset, offset + limit - 1)\
            .execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(body: PatientCreate, user: dict = Depends(verify_jwt)):
    """Create a new patient linked to the authenticated user."""
    record = {
        "id": str(uuid4()),
        "user_id": user["user_id"],
        "patient_name": body.patient_name,
        "age": body.age,
        "relation": body.relation
    }
    try:
        response = supabase.table("patients").insert(record).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Insertion failed")
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_patient(patient_id: str, user: dict = Depends(verify_jwt)):
    """Delete a patient (only if owned by the user). Because of RLS, we must manually verify ownership since we use the service role key."""
    # Verify ownership before deletion
    check = supabase.table("patients").select("id").eq("id", patient_id).eq("user_id", user["user_id"]).execute()
    if not check.data:
        raise HTTPException(status_code=403, detail="Not authorized to delete this patient or it does not exist.")
    
    try:
        supabase.table("patients").delete().eq("id", patient_id).execute()
        return None
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
