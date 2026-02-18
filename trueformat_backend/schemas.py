from pydantic import BaseModel, Field

TARGET_SCHEMA = ["transaction_id", "date", "description", "quantity", "amount", "line_total", "customer_name"]


class InterestRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str
    company: str = Field(default="", max_length=200)
    message: str = Field(default="", max_length=3000)


class SignupStartRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)


class SignupResendRequest(BaseModel):
    email: str


class SignupVerifyRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)
    code: str = Field(min_length=6, max_length=6)


class BillingCheckoutRequest(BaseModel):
    email: str
    billing_cycle: str = Field(pattern="^(monthly|annual)$")
