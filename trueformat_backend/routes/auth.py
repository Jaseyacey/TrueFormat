from fastapi import APIRouter, Depends, HTTPException

from trueformat_backend.auth import (
    get_current_user_unpaid_allowed,
    get_user_profile,
    normalize_email,
    normalize_otp_code,
    resend_signup_code,
    send_signup_code,
    verify_signup_code_and_create_user,
)
from trueformat_backend.schemas import SignupResendRequest, SignupStartRequest, SignupVerifyRequest

router = APIRouter()


@router.post("/auth/signup/start")
async def auth_signup_start(payload: SignupStartRequest):
    email = normalize_email(payload.email)
    password = (payload.password or "").strip()
    if len(password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters.")

    send_signup_code(email)
    return {"status": "ok", "message": "Verification code sent."}


@router.post("/auth/signup/resend")
async def auth_signup_resend(payload: SignupResendRequest):
    email = normalize_email(payload.email)
    resend_signup_code(email)
    return {"status": "ok", "message": "A new verification code was sent."}


@router.post("/auth/signup/verify")
async def auth_signup_verify(payload: SignupVerifyRequest):
    email = normalize_email(payload.email)
    password = (payload.password or "").strip()
    code = normalize_otp_code(payload.code)
    if len(password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters.")

    verify_signup_code_and_create_user(email, password, code)
    return {"status": "ok", "message": "Email verified. Account created."}


@router.get("/auth/payment-status")
async def auth_payment_status(current_user: str = Depends(get_current_user_unpaid_allowed)):
    profile = get_user_profile(current_user)
    return {
        "status": "ok",
        "payment_processed": bool(profile and profile.get("payment_processed")),
        "has_profile": bool(profile),
    }
