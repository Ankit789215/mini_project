from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from app.middleware.auth import verify_jwt
import io
import re
import json
from app.config import settings

router = APIRouter(prefix="/ocr", tags=["OCR"])

def parse_prescription_text(text: str) -> dict:
    """Attempt to extract structured medicine info from raw OCR text."""
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    medicines = []
    dosage_pattern = re.compile(r'\d+\s*mg|\d+\s*ml|\d+\s*mcg', re.I)
    freq_keywords = ["once", "twice", "daily", "bd", "tds", "od", "hs", "morning", "evening", "night", "qid"]

    for line in lines:
        has_dosage = bool(dosage_pattern.search(line))
        has_freq = any(kw in line.lower() for kw in freq_keywords)
        if has_dosage or has_freq:
            dosage_match = dosage_pattern.search(line)
            medicines.append({
                "raw_line": line,
                "dosage": dosage_match.group(0) if dosage_match else None,
                "frequency": next((kw for kw in freq_keywords if kw in line.lower()), None),
            })

    return {"extracted_medicines": medicines, "total_lines": len(lines)}

@router.post("/prescription")
async def ocr_prescription(file: UploadFile = File(...), user=Depends(verify_jwt)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    contents = await file.read()

    try:
        import cv2
        import numpy as np
        import pytesseract
        from PIL import Image
        from groq import Groq

        # Load image from bytes
        np_arr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        # Preprocessing pipeline
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        denoised = cv2.fastNlMeansDenoising(gray, h=30)
        _, thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 1))
        cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

        # 1. Standard OCR
        pil_img = Image.fromarray(cleaned)
        raw_text = pytesseract.image_to_string(pil_img, config="--psm 6")

        # 2. Mandatory LLM Extraction
        if settings.groq_api:
            try:
                client = Groq(api_key=settings.groq_api)
                prompt = f"""
                Extract a structured list of medicines from this prescription text.
                For each medicine, identify:
                - Name (Medicine name)
                - Dosage (e.g., 500mg)
                - Frequency (Daily, Twice a day, etc.)

                Text:
                {raw_text}

                Return ONLY a JSON object with a "medicines" list. 
                Example: {{"medicines": [{{"raw_line": "Paracetamol", "dosage": "500mg", "frequency": "twice daily"}}]}}
                If no medicines found, return {{"medicines": []}}.
                """
                completion = client.chat.completions.create(
                    model="llama-3.1-8b-instant",
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"}
                )
                llm_data = json.loads(completion.choices[0].message.content)
                parsed_meds = llm_data.get("medicines", [])
                
                return {
                    "success": True,
                    "raw_text": raw_text,
                    "parsed": {
                        "extracted_medicines": parsed_meds,
                        "method": "llm_extraction",
                        "total_lines": len(raw_text.split("\n"))
                    }
                }
            except Exception as llm_err:
                # Basic regex fallback if LLM fails
                regex_parsed = parse_prescription_text(raw_text)
                return {
                    "success": True,
                    "raw_text": raw_text,
                    "parsed": {
                        **regex_parsed,
                        "method": "regex_fallback_llm_failed",
                        "error": str(llm_err)
                    }
                }
        else:
            # No LLM configured, use regex
            return {
                "success": True,
                "raw_text": raw_text,
                "parsed": {**parse_prescription_text(raw_text), "method": "regex_only"}
            }

    except Exception as e:
        # Fallback to LLM even if OCR fails completely (e.g. Tesseract not installed)
        if settings.groq_api:
             try:
                from groq import Groq
                client = Groq(api_key=settings.groq_api)
                # Since we don't have text, we can't do much without a vision model,
                # but we can at least return a structured empty response or try to explain.
                # However, the user said "after scanning the ocr llm should be the fall back".
                # If Tesseract fails, we might still want to try LLM if we have some raw text from other sources.
                # But here 'raw_text' is not available. 
                return {
                    "success": False,
                    "error": str(e),
                    "raw_text": "",
                    "parsed": {"extracted_medicines": [], "total_lines": 0, "method": "fail_no_ocr"}
                }
             except:
                 pass
        
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")
