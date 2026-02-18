from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import secrets
import time
import urllib.parse
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .db import db_conn
from .settings import (
    OTP_EXPIRY_SECONDS,
    OTP_HASH_SECRET,
    OTP_MAX_ATTEMPTS,
    OTP_RESEND_COOLDOWN_SECONDS,
    RESEND_API_KEY,
    RESEND_FROM_EMAIL,
    SUPABASE_ANON_KEY,
    SUPABASE_AUTH_AUD,
    SUPABASE_DEV_TRUST_CLAIMS,
    SUPABASE_JWT_SECRET,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL,
)

auth_scheme = HTTPBearer(auto_error=False)


def normalize_email(raw: str) -> str:
    email = (raw or "").strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=422, detail="Valid email is required.")
    return email


def normalize_otp_code(raw: str) -> str:
    code = (raw or "").strip()
    if not re.fullmatch(r"\d{6}", code):
        raise HTTPException(status_code=422, detail="Code must be a 6-digit number.")
    return code


def otp_hash(email: str, code: str) -> str:
    payload = f"{email}:{code}".encode("utf-8")
    return hmac.new(OTP_HASH_SECRET.encode("utf-8"), payload, hashlib.sha256).hexdigest()


def send_signup_otp_email(email: str, code: str) -> None:
    if not RESEND_API_KEY:
        raise HTTPException(status_code=500, detail="RESEND_API_KEY is not configured on backend.")
    if not RESEND_FROM_EMAIL:
        raise HTTPException(status_code=500, detail="RESEND_FROM_EMAIL is not configured on backend.")

    payload = {
        "from": RESEND_FROM_EMAIL,
        "to": [email],
        "subject": "Your TrueFormat verification code",
        "text": (
            f"Your TrueFormat verification code is {code}. "
            f"It expires in {max(1, OTP_EXPIRY_SECONDS // 60)} minutes."
        ),
        "html": (
            f"<p>Your TrueFormat verification code is "
            f"<strong style='font-size:20px;letter-spacing:2px'>{code}</strong>.</p>"
            f"<p>This code expires in {max(1, OTP_EXPIRY_SECONDS // 60)} minutes.</p>"
        ),
    }
    req = Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "TrueFormatAPI/1.0 (+https://trueformat.onrender.com)",
        },
        method="POST",
    )
    try:
        with urlopen(req, timeout=10) as resp:
            if resp.status < 200 or resp.status >= 300:
                raise HTTPException(status_code=502, detail=f"Resend email failed with status {resp.status}.")
    except HTTPError as e:
        try:
            message = e.read().decode("utf-8")
        except Exception:
            message = ""
        raise HTTPException(status_code=502, detail=f"Resend email failed ({e.code}). {message[:200]}".strip())
    except URLError as e:
        raise HTTPException(status_code=502, detail=f"Resend email failed: {e.reason}")
    except TimeoutError:
        raise HTTPException(status_code=502, detail="Resend email request timed out.")


def create_supabase_user(email: str, password: str) -> tuple[str, str | None]:
    if not SUPABASE_URL:
        raise HTTPException(status_code=500, detail="SUPABASE_URL is not configured on backend.")
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_ROLE_KEY is not configured on backend.")

    req = Request(
        f"{SUPABASE_URL}/auth/v1/admin/users",
        data=json.dumps(
            {
                "email": email,
                "password": password,
                "email_confirm": True,
            }
        ).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(req, timeout=10) as resp:
            if resp.status < 200 or resp.status >= 300:
                raise HTTPException(status_code=502, detail=f"Supabase user creation failed with status {resp.status}.")
            user_payload = json.loads(resp.read().decode("utf-8") or "{}")
            user_id = user_payload.get("id") if isinstance(user_payload, dict) else None
            return "created", user_id
    except HTTPError as e:
        try:
            body = e.read().decode("utf-8")
        except Exception:
            body = ""
        body_lower = body.lower()
        if e.code in (400, 409, 422) and ("already" in body_lower and "register" in body_lower):
            return "exists", None
        raise HTTPException(status_code=502, detail=f"Supabase user creation failed ({e.code}). {body[:200]}".strip())
    except URLError as e:
        raise HTTPException(status_code=502, detail=f"Supabase user creation failed: {e.reason}")
    except TimeoutError:
        raise HTTPException(status_code=502, detail="Supabase user creation request timed out.")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * ((4 - len(value) % 4) % 4)
    return base64.urlsafe_b64decode((value + padding).encode("utf-8"))


def parse_supabase_token(token: str) -> dict | None:
    if not SUPABASE_JWT_SECRET:
        return None
    try:
        header_b64, payload_b64, sig_b64 = token.split(".", 2)
        signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
        signature = _b64url_decode(sig_b64)
        expected = hmac.new(
            SUPABASE_JWT_SECRET.encode("utf-8"),
            signing_input,
            digestmod="sha256",
        ).digest()
        if not hmac.compare_digest(signature, expected):
            return None
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
        exp = int(payload.get("exp", 0))
        if exp <= int(time.time()):
            return None
        aud = payload.get("aud")
        if isinstance(aud, list):
            if SUPABASE_AUTH_AUD not in aud:
                return None
        elif aud and aud != SUPABASE_AUTH_AUD:
            return None
        return payload
    except Exception:
        return None


def decode_unverified_jwt_claims(token: str) -> dict | None:
    try:
        _header_b64, payload_b64, _sig_b64 = token.split(".", 2)
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
        return payload if isinstance(payload, dict) else None
    except Exception:
        return None


def validate_supabase_token_remote(token: str) -> tuple[dict | None, str | None]:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return None, "SUPABASE_URL/SUPABASE_ANON_KEY not configured on backend"

    req = Request(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={
            "Authorization": f"Bearer {token}",
            "apikey": SUPABASE_ANON_KEY,
        },
        method="GET",
    )
    try:
        with urlopen(req, timeout=8) as resp:
            if resp.status != 200:
                return None, f"Supabase /auth/v1/user returned status {resp.status}"
            payload = json.loads(resp.read().decode("utf-8"))
            return (payload if isinstance(payload, dict) else None), None
    except HTTPError as e:
        return None, f"Supabase auth HTTPError {e.code}"
    except URLError as e:
        return None, f"Supabase auth URLError: {e.reason}"
    except (TimeoutError, ValueError):
        return None, "Supabase auth request failed"


def supabase_rest_request(
    path: str,
    method: str = "GET",
    body: dict | list | None = None,
    extra_headers: dict | None = None,
) -> object:
    if not SUPABASE_URL:
        raise HTTPException(status_code=500, detail="SUPABASE_URL is not configured on backend.")
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_ROLE_KEY is not configured on backend.")

    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Accept": "application/json",
    }
    payload = None
    if body is not None:
        payload = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if extra_headers:
        headers.update(extra_headers)

    req = Request(
        f"{SUPABASE_URL}/rest/v1/{path.lstrip('/')}",
        data=payload,
        headers=headers,
        method=method.upper(),
    )
    try:
        with urlopen(req, timeout=10) as resp:
            raw = resp.read().decode("utf-8")
            if not raw:
                return None
            return json.loads(raw)
    except HTTPError as e:
        body_text = ""
        try:
            body_text = e.read().decode("utf-8")
        except Exception:
            pass
        raise HTTPException(
            status_code=502,
            detail=f"Supabase REST {method.upper()} /{path} failed ({e.code}). {body_text[:220]}".strip(),
        )
    except URLError as e:
        raise HTTPException(status_code=502, detail=f"Supabase REST request failed: {e.reason}")
    except TimeoutError:
        raise HTTPException(status_code=502, detail="Supabase REST request timed out.")


def get_user_profile(email: str) -> dict | None:
    query = urllib.parse.quote(email, safe="")
    rows = supabase_rest_request(
        f"user_profile?email=eq.{query}&select=email,payment_processed&limit=1",
        method="GET",
    )
    if isinstance(rows, list) and rows:
        row = rows[0]
        return row if isinstance(row, dict) else None
    return None


def ensure_user_profile(email: str, payment_processed: bool) -> None:
    if not payment_processed:
        supabase_rest_request(
            "user_profile?on_conflict=email",
            method="POST",
            body=[{"email": email, "payment_processed": False}],
            extra_headers={"Prefer": "resolution=ignore-duplicates,return=minimal"},
        )
        return

    supabase_rest_request(
        "user_profile?on_conflict=email",
        method="POST",
        body=[{"email": email, "payment_processed": True}],
        extra_headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
    )


def set_payment_processed(email: str, payment_processed: bool) -> None:
    ensure_user_profile(email, payment_processed=payment_processed)


def get_current_user_claims(
    credentials: HTTPAuthorizationCredentials = Depends(auth_scheme),
) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required.")

    token = credentials.credentials
    payload = parse_supabase_token(token)
    if not payload:
        payload, remote_error = validate_supabase_token_remote(token)
    else:
        remote_error = None

    email = normalize_email(payload.get("email", "")) if payload else None
    if not email:
        claims = decode_unverified_jwt_claims(token) or {}
        exp = int(claims.get("exp", 0)) if claims.get("exp") else 0
        if exp and exp <= int(time.time()):
            raise HTTPException(status_code=401, detail="Supabase token expired. Please log in again.")
        if SUPABASE_DEV_TRUST_CLAIMS and claims.get("email"):
            email = normalize_email(claims.get("email", ""))
            return {"email": email}
        raise HTTPException(
            status_code=401,
            detail=(
                "Invalid or expired Supabase token. "
                f"{remote_error or 'Token verification failed'}."
            ),
        )
    return payload


def get_current_user_unpaid_allowed(
    claims: dict = Depends(get_current_user_claims),
) -> str:
    email = normalize_email(claims.get("email", ""))
    if not email:
        raise HTTPException(status_code=401, detail="Authentication required.")
    return email


def get_current_user(
    email: str = Depends(get_current_user_unpaid_allowed),
) -> str:
    profile = get_user_profile(email)
    if profile is None:
        raise HTTPException(status_code=403, detail="No user profile found. Complete signup first.")
    if not bool(profile.get("payment_processed")):
        raise HTTPException(status_code=403, detail="Payment required. Complete your subscription first.")
    return email


def send_signup_code(email: str) -> None:
    now = int(time.time())
    with db_conn() as conn:
        existing = conn.execute(
            "SELECT email, last_sent_at FROM signup_otp_codes WHERE email = ?",
            (email,),
        ).fetchone()
        if existing:
            seconds_remaining = OTP_RESEND_COOLDOWN_SECONDS - max(0, now - int(existing["last_sent_at"]))
            if seconds_remaining > 0:
                raise HTTPException(
                    status_code=429,
                    detail=f"Please wait {seconds_remaining}s before requesting another code.",
                )

    code = f"{secrets.randbelow(1_000_000):06d}"
    send_signup_otp_email(email, code)
    with db_conn() as conn:
        conn.execute(
            """
            INSERT INTO signup_otp_codes (email, code_hash, expires_at, last_sent_at, attempts, created_at)
            VALUES (?, ?, ?, ?, 0, ?)
            ON CONFLICT(email) DO UPDATE SET
                code_hash = excluded.code_hash,
                expires_at = excluded.expires_at,
                last_sent_at = excluded.last_sent_at,
                attempts = 0
            """,
            (
                email,
                otp_hash(email, code),
                now + OTP_EXPIRY_SECONDS,
                now,
                now,
            ),
        )
        conn.commit()


def resend_signup_code(email: str) -> None:
    now = int(time.time())
    with db_conn() as conn:
        existing = conn.execute(
            "SELECT email, last_sent_at FROM signup_otp_codes WHERE email = ?",
            (email,),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=400, detail="Start signup before requesting a resend.")
        seconds_remaining = OTP_RESEND_COOLDOWN_SECONDS - max(0, now - int(existing["last_sent_at"]))
        if seconds_remaining > 0:
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {seconds_remaining}s before requesting another code.",
            )

    code = f"{secrets.randbelow(1_000_000):06d}"
    send_signup_otp_email(email, code)
    with db_conn() as conn:
        conn.execute(
            """
            UPDATE signup_otp_codes
            SET code_hash = ?, expires_at = ?, last_sent_at = ?, attempts = 0
            WHERE email = ?
            """,
            (otp_hash(email, code), now + OTP_EXPIRY_SECONDS, now, email),
        )
        conn.commit()


def verify_signup_code_and_create_user(email: str, password: str, code: str) -> None:
    now = int(time.time())
    with db_conn() as conn:
        row = conn.execute(
            """
            SELECT email, code_hash, expires_at, attempts
            FROM signup_otp_codes
            WHERE email = ?
            """,
            (email,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=400, detail="No active verification code found. Start signup again.")
        if int(row["expires_at"]) <= now:
            conn.execute("DELETE FROM signup_otp_codes WHERE email = ?", (email,))
            conn.commit()
            raise HTTPException(status_code=400, detail="Verification code expired. Request a new code.")
        if int(row["attempts"]) >= OTP_MAX_ATTEMPTS:
            conn.execute("DELETE FROM signup_otp_codes WHERE email = ?", (email,))
            conn.commit()
            raise HTTPException(status_code=429, detail="Too many failed attempts. Start signup again.")

        expected_hash = row["code_hash"]
        received_hash = otp_hash(email, code)
        if not hmac.compare_digest(expected_hash, received_hash):
            conn.execute(
                "UPDATE signup_otp_codes SET attempts = attempts + 1 WHERE email = ?",
                (email,),
            )
            conn.commit()
            raise HTTPException(status_code=400, detail="Invalid verification code.")

    user_result, _user_id = create_supabase_user(email, password)
    if user_result == "exists":
        with db_conn() as conn:
            conn.execute("DELETE FROM signup_otp_codes WHERE email = ?", (email,))
            conn.commit()
        raise HTTPException(status_code=409, detail="Account already exists. Log in instead.")

    ensure_user_profile(email, payment_processed=False)

    with db_conn() as conn:
        conn.execute("DELETE FROM signup_otp_codes WHERE email = ?", (email,))
        conn.commit()
