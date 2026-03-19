from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.db import User
from pydantic import BaseModel
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from jose import jwt
from app.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AuthRequest(BaseModel):
    email: str
    password: str

def create_access_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm="HS256")

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(user_data: AuthRequest, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pw = pwd_context.hash(user_data.password)
    new_user = User(email=user_data.email, hashed_password=hashed_pw)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    token = create_access_token({"sub": new_user.id, "email": new_user.email}, timedelta(minutes=60*24*7)) # 7 days
    return {"access_token": token, "token_type": "bearer", "user_id": new_user.id}

@router.post("/login")
def login(user_data: AuthRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_data.email).first()
    if not user or not pwd_context.verify(user_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"sub": user.id, "email": user.email}, timedelta(minutes=60*24*7))
    return {"access_token": token, "token_type": "bearer", "user_id": user.id}
