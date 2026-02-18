from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from trueformat_backend.db import init_db
from trueformat_backend.routes import auth_router, billing_router, health_router, interest_router, transform_router
from trueformat_backend.settings import CORS_ALLOWED_ORIGINS

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(interest_router)
app.include_router(auth_router)
app.include_router(billing_router)
app.include_router(transform_router)
app.include_router(health_router)

init_db()
