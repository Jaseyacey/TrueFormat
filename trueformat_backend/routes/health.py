from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "online", "version": "MVP-1.0"}
