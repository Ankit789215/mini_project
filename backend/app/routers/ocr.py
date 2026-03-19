from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from app.middleware.auth import verify_jwt
import io
import re

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
            medicines.append({
                "raw_line": line,
                "dosage": dosage_pattern.search(line).group(0) if dosage_pattern.search(line) else None,
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

        # Load image from bytes
        np_arr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        # Preprocessing pipeline
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        denoised = cv2.fastNlMeansDenoising(gray, h=30)
        _, thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 1))
        cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

        # OCR
        pil_img = Image.fromarray(cleaned)
        raw_text = pytesseract.image_to_string(pil_img, config="--psm 6")

        parsed = parse_prescription_text(raw_text)

        return {
            "success": True,
            "raw_text": raw_text,
            "parsed": parsed
        }

    except ImportError:
        # Tesseract or opencv not available — return mock result
        return {
            "success": False,
            "raw_text": "OCR not available: Please install Tesseract and ensure pytesseract is configured.",
            "parsed": {"extracted_medicines": [], "total_lines": 0},
            "error": "tesseract_not_installed"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")
