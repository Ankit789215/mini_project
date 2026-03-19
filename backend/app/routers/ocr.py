from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from app.middleware.auth import verify_jwt
from app.config import settings
import google.generativeai as genai
import json
import re
import traceback

router = APIRouter(prefix="/ocr", tags=["OCR"])

if settings.gemini_api:
    genai.configure(api_key=settings.gemini_api)

SYSTEM_PROMPT = """You are a medical prescription reader. Analyze the prescription image and extract medication information.

Return ONLY a valid JSON object in this exact format (no markdown, no explanation):
{
  "medicines": [
    {
      "name": "Medicine Name",
      "dosage": "e.g. 500mg or empty string",
      "frequency": "e.g. twice daily or empty string",
      "notes": "any other relevant notes or empty string"
    }
  ],
  "raw_text": "all text you can read from the prescription"
}

Rules:
- Extract ALL medicines mentioned in the prescription
- If dosage or frequency is not clear, use an empty string (never guess)
- Return raw_text with everything readable from the image
- Return at minimum: {"medicines": [], "raw_text": ""}"""

@router.post("/prescription")
async def ocr_prescription(file: UploadFile = File(...), user=Depends(verify_jwt)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    if not settings.gemini_api:
        return {
            "success": False,
            "error": "Gemini API key not configured.",
            "raw_text": "",
            "combined_text": "",
            "parsed": {"extracted_medicines": [], "hospital": "", "insurance": "", "method": "failed"}
        }

    contents = await file.read()
    
    try:
        # Initializing Gemini 3.1 Flash Lite (per user request)
        model = genai.GenerativeModel('gemini-3.1-flash-lite-preview')
        
        # Prepare image parts
        image_parts = [
            {
                "mime_type": file.content_type,
                "data": contents
            }
        ]

        # Generate content
        response = model.generate_content([SYSTEM_PROMPT, image_parts[0]])
        
        raw_response = response.text.strip()
        print(f"Gemini Response: {raw_response[:200]}")

        # Strip markdown code blocks if present
        raw_response = re.sub(r"^```(?:json)?\s*", "", raw_response)
        raw_response = re.sub(r"\s*```$", "", raw_response.strip())

        # Parse JSON
        parsed = json.loads(raw_response)
        medicines_raw = parsed.get("medicines", [])
        raw_text = parsed.get("raw_text", "")

        # Normalize medicine fields
        medicines = []
        for m in medicines_raw:
            name = str(m.get("name", "")).strip()
            if name:
                medicines.append({
                    "name": name,
                    "dosage": str(m.get("dosage", "")).strip(),
                    "frequency": str(m.get("frequency", "")).strip(),
                    "notes": str(m.get("notes", "")).strip(),
                })

        return {
            "success": True,
            "raw_text": raw_text.split("\n") if raw_text else [],
            "combined_text": raw_text,
            "parsed": {
                "extracted_medicines": medicines,
                "hospital": "",
                "insurance": "",
                "method": "gemini_vision"
            }
        }

    except Exception as e:
        print(f"Gemini Error: {e}")
        traceback.print_exc()
        return {
            "success": False,
            "error": f"Gemini vision failed: {str(e)}",
            "raw_text": [],
            "combined_text": "",
            "parsed": {"extracted_medicines": [], "hospital": "", "insurance": "", "method": "failed"}
        }
