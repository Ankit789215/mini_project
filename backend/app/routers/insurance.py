from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models.db import InsuranceDetail, Patient
from app.middleware.auth import verify_jwt

router = APIRouter(prefix="/insurance", tags=["Insurance"])

# Mock hospital-insurance network mapping
# Format: {insurance_company_lower: [list of partnered hospital names (lowercase)]}
INSURANCE_NETWORK = {
    "star health": ["apollo hospital", "fortis hospital", "max hospital", "aiims", "manipal hospital"],
    "hdfc ergo": ["apollo hospital", "medanta", "columbia asia", "aster hospital"],
    "bajaj allianz": ["fortis hospital", "narayana hospital", "care hospital", "max hospital"],
    "new india assurance": ["government hospital", "aiims", "safdarjung", "apollo hospital"],
    "united india insurance": ["apollo hospital", "aiims", "fortis hospital", "government hospital"],
    "icici lombard": ["max hospital", "medanta", "apollo hospital", "fortis hospital", "narayana hospital"],
    "reliance health": ["care hospital", "columbia asia", "aster hospital"],
    "tata aig": ["apollo hospital", "fortis hospital", "max hospital", "medanta"],
    "care health": ["apollo hospital", "fortis hospital", "max hospital", "medanta", "aster hospital"],
}

def check_insurance_network(company: str, hospital: str) -> bool:
    company_key = company.lower().strip()
    hospital_key = hospital.lower().strip()
    partnered_hospitals = INSURANCE_NETWORK.get(company_key, [])
    # Allow partial match (e.g. "Apollo" matches "apollo hospital")
    return any(hospital_key in h or h in hospital_key for h in partnered_hospitals)

class InsuranceCreate(BaseModel):
    patient_id: str
    insurance_company: str
    policy_number: str
    hospital_name: str

@router.post("")
def save_insurance(data: InsuranceCreate, db: Session = Depends(get_db), user=Depends(verify_jwt)):
    # Verify patient belongs to user
    patient = db.query(Patient).filter(Patient.id == data.patient_id, Patient.user_id == user["user_id"]).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    is_connected = check_insurance_network(data.insurance_company, data.hospital_name)

    existing = db.query(InsuranceDetail).filter(InsuranceDetail.patient_id == data.patient_id).first()
    if existing:
        existing.insurance_company = data.insurance_company
        existing.policy_number = data.policy_number
        existing.hospital_name = data.hospital_name
        existing.is_verified = True
        existing.is_connected = is_connected
    else:
        ins = InsuranceDetail(
            patient_id=data.patient_id,
            insurance_company=data.insurance_company,
            policy_number=data.policy_number,
            hospital_name=data.hospital_name,
            is_verified=True,
            is_connected=is_connected
        )
        db.add(ins)

    db.commit()
    return {
        "insurance_company": data.insurance_company,
        "hospital_name": data.hospital_name,
        "policy_number": data.policy_number,
        "is_connected": is_connected,
        "status": "Connected ✅" if is_connected else "Not Connected ❌"
    }

@router.get("/{patient_id}")
def get_insurance(patient_id: str, db: Session = Depends(get_db), user=Depends(verify_jwt)):
    patient = db.query(Patient).filter(Patient.id == patient_id, Patient.user_id == user["user_id"]).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    ins = db.query(InsuranceDetail).filter(InsuranceDetail.patient_id == patient_id).first()
    if not ins:
        return {"has_insurance": False}

    return {
        "has_insurance": True,
        "insurance_company": ins.insurance_company,
        "policy_number": ins.policy_number,
        "hospital_name": ins.hospital_name,
        "is_connected": ins.is_connected,
        "status": "Connected ✅" if ins.is_connected else "Not Connected ❌"
    }
