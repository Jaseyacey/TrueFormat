from __future__ import annotations

import stripe
from fastapi import HTTPException

from .auth import get_user_profile, normalize_email, set_payment_processed
from .settings import FRONTEND_BASE_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET

stripe.api_key = STRIPE_SECRET_KEY


def stripe_line_item(billing_cycle: str) -> dict:
    if billing_cycle == "monthly":
        return {
            "price_data": {
                "currency": "gbp",
                "unit_amount": 50000,
                "recurring": {"interval": "month"},
                "product_data": {"name": "TrueFormat Monthly Subscription"},
            },
            "quantity": 1,
        }
    return {
        "price_data": {
            "currency": "gbp",
            "unit_amount": 500000,
            "recurring": {"interval": "year"},
            "product_data": {"name": "TrueFormat Annual Subscription"},
        },
        "quantity": 1,
    }


def create_checkout_session(email: str, billing_cycle: str) -> str:
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="STRIPE_SECRET_KEY is not configured on backend.")

    email = normalize_email(email)
    billing_cycle = billing_cycle.strip().lower()
    if billing_cycle not in {"monthly", "annual"}:
        raise HTTPException(status_code=422, detail="billing_cycle must be monthly or annual.")

    profile = get_user_profile(email)
    if profile is None:
        raise HTTPException(status_code=404, detail="No profile found for this email. Complete signup first.")
    if bool(profile.get("payment_processed")):
        raise HTTPException(status_code=409, detail="Payment already processed for this account.")

    success_url = f"{FRONTEND_BASE_URL}/subscription?success=1&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{FRONTEND_BASE_URL}/subscription?canceled=1"

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            customer_email=email,
            success_url=success_url,
            cancel_url=cancel_url,
            line_items=[stripe_line_item(billing_cycle)],
            metadata={"email": email, "billing_cycle": billing_cycle},
            allow_promotion_codes=True,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Stripe checkout session failed: {str(e)[:220]}")

    return session.url


def read_checkout_session_paid(session_id: str) -> bool:
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="STRIPE_SECRET_KEY is not configured on backend.")
    if not session_id:
        raise HTTPException(status_code=422, detail="session_id is required.")

    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch Stripe session: {str(e)[:220]}")

    return session.payment_status == "paid" and session.status == "complete"


def apply_webhook_event(payload: bytes, signature: str) -> None:
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="STRIPE_WEBHOOK_SECRET is not configured on backend.")

    try:
        event = stripe.Webhook.construct_event(payload, signature, STRIPE_WEBHOOK_SECRET)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid Stripe webhook signature: {str(e)[:180]}")

    event_type = event.get("type")
    event_data = (event.get("data") or {}).get("object") or {}

    if event_type in {"checkout.session.completed", "invoice.paid"}:
        metadata = event_data.get("metadata") or {}
        customer_email = (
            event_data.get("customer_email")
            or ((event_data.get("customer_details") or {}).get("email"))
            or metadata.get("email")
        )
        if customer_email:
            set_payment_processed(normalize_email(customer_email), True)
