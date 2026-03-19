from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from app.middleware.auth import verify_jwt
import re
import traceback
import cv2
import numpy as np

router = APIRouter(prefix="/ocr", tags=["OCR"])

# Lazy-initialize PaddleOCR so server doesn't crash on startup if it fails
_ocr_engine = None

def get_ocr_engine():
    global _ocr_engine
    if _ocr_engine is None:
        try:
            from paddleocr import PaddleOCR
            _ocr_engine = PaddleOCR(use_angle_cls=True, lang='en')
            print("PaddleOCR engine initialized successfully.")
        except Exception as e:
            print(f"PaddleOCR Initialization Error: {e}")
            traceback.print_exc()
    return _ocr_engine

def extract_hospital_insurance(text: str) -> dict:
    """Basic regex to find Hospital and Insurance names."""
    hospital_pattern = re.compile(r'(?:Hospital|Clinic|Medical\s*Center|Health\s*Care)\b', re.I)
    insurance_pattern = re.compile(r'(?:Insurance|Assurance|Health\s*Plan)\b', re.I)
    lines = text.split("\n")
    hospital, insurance = "", ""
    for line in lines:
        if not hospital and hospital_pattern.search(line):
            hospital = line.strip()
        if not insurance and insurance_pattern.search(line):
            insurance = line.strip()
    return {"hospital": hospital, "insurance": insurance}

def parse_prescription_text(text: str) -> list:
    """Extract structured medicine info from raw OCR text using regex."""
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
                "name": line,
                "dosage": dosage_match.group(0) if dosage_match else "",
                "frequency": next((kw for kw in freq_keywords if kw in line.lower()), ""),
            })
    return medicines

@router.post("/prescription")
async def ocr_prescription(file: UploadFile = File(...), user=Depends(verify_jwt)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    contents = await file.read()
    raw_lines = []
    error_detail = None

    try:
        engine = get_ocr_engine()
        if engine is None:
            error_detail = "PaddleOCR engine could not be initialized. Try restarting the server."
            raise RuntimeError(error_detail)

        np_arr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if img is None:
            error_detail = "Failed to decode image. Please upload a valid JPG, PNG, or WEBP."
            raise ValueError(error_detail)

        result = engine.ocr(img, cls=True)
        print(f"PaddleOCR result: {result}")

        if result and result[0]:
            for res in result:
                if res:
                    for line in res:
                        if line and len(line) > 1 and line[1]:
                            raw_lines.append(str(line[1][0]))

        print(f"Extracted {len(raw_lines)} text lines.")

    except Exception as e:
        print(f"OCR Error: {e}")
        traceback.print_exc()
        return {
            "success": False,
            "error": error_detail or str(e),
            "raw_text": [],
            "combined_text": "",
            "parsed": {
                "extracted_medicines": [],
                "hospital": "",
                "insurance": "",
                "method": "failed"
            }
        }

    combined_text = "\n".join(raw_lines)
    medicines = parse_prescription_text(combined_text)
    info = extract_hospital_insurance(combined_text)

    return {
        "success": True,
        "raw_text": raw_lines,
        "combined_text": combined_text,
        "parsed": {
            "extracted_medicines": medicines,
            "hospital": info["hospital"],
            "insurance": info["insurance"],
            "method": "paddle_ocr"
        }
    }
