from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID

class PatientCreate(BaseModel):
    patient_name: str = Field(..., description="Name of the patient")
    age: Optional[int] = Field(None, ge=0, description="Age in years")
    relation: Optional[str] = Field(None, description="Relation to the user (e.g. Self, Parent, Child)")
    email: Optional[str] = Field(None, description="Contact email for the patient")

class PatientResponse(PatientCreate):
    id: UUID
    user_id: UUID
    created_at: datetime
    
    model_config = {"from_attributes": True}
