from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID

class ReminderCreate(BaseModel):
    patient_id: UUID
    reminder_time: datetime
    repeat_type: str = Field("none", pattern="^(daily|weekly|monthly|none)$")

class ReminderResponse(ReminderCreate):
    id: UUID
    created_at: datetime
    
    model_config = {"from_attributes": True}
