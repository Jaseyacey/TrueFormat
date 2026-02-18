from fastapi import APIRouter, Request as FastAPIRequest

from trueformat_backend.billing import apply_webhook_event, create_checkout_session, read_checkout_session_paid
from trueformat_backend.schemas import BillingCheckoutRequest

router = APIRouter()


@router.post("/billing/create-checkout-session")
async def billing_create_checkout_session(payload: BillingCheckoutRequest):
    checkout_url = create_checkout_session(payload.email, payload.billing_cycle)
    return {"status": "ok", "checkout_url": checkout_url}


@router.get("/billing/checkout-session")
async def billing_checkout_session(session_id: str):
    paid = read_checkout_session_paid(session_id)
    return {
        "status": "ok",
        "payment_processed": paid,
    }


@router.post("/billing/webhook")
async def billing_webhook(request: FastAPIRequest):
    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")
    apply_webhook_event(payload, signature)
    return {"status": "ok"}
