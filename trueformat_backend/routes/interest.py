from fastapi import APIRouter

from trueformat_backend.leads import submit_interest_lead
from trueformat_backend.schemas import InterestRequest

router = APIRouter()


@router.post("/interest")
async def submit_interest(payload: InterestRequest):
    submit_interest_lead(payload.name, payload.email, payload.company, payload.message)
    return {"status": "ok", "message": "Thanks. We received your interest form."}
