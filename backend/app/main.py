from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

from app.routers import patients, medicines, reminders, auth

app = FastAPI(
    title="Family Health & Medication Manager",
    description="API for managing family patient profiles, medications, and reminders.",
    version="1.0.0"
)
# Force reload - trigger 401 debug

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(medicines.router)
app.include_router(reminders.router)

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "Family Health API"}
