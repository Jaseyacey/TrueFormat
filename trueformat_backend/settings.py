from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

DEFAULT_CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

cors_allowed_origins_env = os.getenv("CORS_ALLOWED_ORIGINS", "")
configured_origins = [
    origin.strip().rstrip("/")
    for origin in cors_allowed_origins_env.split(",")
    if origin.strip()
]
CORS_ALLOWED_ORIGINS = sorted({*DEFAULT_CORS_ALLOWED_ORIGINS, *configured_origins})

DB_PATH = os.getenv("DB_PATH", str(BASE_DIR / "trueformat.db"))
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
SUPABASE_AUTH_AUD = os.getenv("SUPABASE_AUTH_AUD", "authenticated")
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY_TEST", "") or os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173").rstrip("/")
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "")
OTP_HASH_SECRET = os.getenv("OTP_HASH_SECRET", SUPABASE_JWT_SECRET or "dev-otp-secret")

try:
    OTP_EXPIRY_SECONDS = max(60, int(os.getenv("OTP_EXPIRY_SECONDS", "600")))
except ValueError:
    OTP_EXPIRY_SECONDS = 600

try:
    OTP_RESEND_COOLDOWN_SECONDS = max(5, int(os.getenv("OTP_RESEND_COOLDOWN_SECONDS", "60")))
except ValueError:
    OTP_RESEND_COOLDOWN_SECONDS = 60

try:
    OTP_MAX_ATTEMPTS = max(1, int(os.getenv("OTP_MAX_ATTEMPTS", "5")))
except ValueError:
    OTP_MAX_ATTEMPTS = 5

SUPABASE_DEV_TRUST_CLAIMS = os.getenv("SUPABASE_DEV_TRUST_CLAIMS", "").lower() in {"1", "true", "yes"}

try:
    UPLOAD_PAGE_LIMIT = max(1, int(os.getenv("UPLOAD_PAGE_LIMIT", "2")))
except ValueError:
    UPLOAD_PAGE_LIMIT = 2

ALLOW_SCANNED_PDFS = os.getenv("ALLOW_SCANNED_PDFS", "false").lower() in {"1", "true", "yes"}
