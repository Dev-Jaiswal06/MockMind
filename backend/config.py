# backend/config.py
import os
from dotenv import load_dotenv
load_dotenv()

class Config:
    JWT_SECRET_KEY           = os.getenv("JWT_SECRET_KEY", "dev-secret")
    JWT_ACCESS_TOKEN_EXPIRES = 86400
    MONGODB_URI              = os.getenv("MONGODB_URI", "")
    GEMINI_API_KEY           = os.getenv("GEMINI_API_KEY", "")