from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime
from uuid import UUID

class MedicineCreate(BaseModel):
    patient_id: UUID
    name: str = Field(..., description="Name of the medication")
    dosage: Optional[str] = Field(None, description="e.g. 500mg")
    frequency: Optional[str] = Field(None, description="e.g. Twice a day")
    expiry_date: Optional[date] = Field(None, description="YYYY-MM-DD")

class MedicineResponse(MedicineCreate):
    id: UUID
    created_at: datetime
    
    # Calculated field for convenience in the frontend
    days_to_expiry: Optional[int] = None
    
    model_config = {"from_attributes": True}
