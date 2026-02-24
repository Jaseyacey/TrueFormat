from __future__ import annotations

import re

from fastapi import APIRouter, File, HTTPException, UploadFile

from trueformat_backend.transformation import clean_and_load

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "online", "version": "MVP-1.0"}


DATE_TOKEN_PATTERNS = (
    re.compile(r"^\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?$"),
    re.compile(r"^\d{1,2}-[A-Za-z]{3}$"),
    re.compile(r"^[A-Za-z]{3}-\d{1,2}$"),
    re.compile(r"^\d{4}-\d{2}-\d{2}$"),
)
SCIENTIFIC_PATTERN = re.compile(r"^[+-]?\d+(\.\d+)?[Ee][+-]?\d+$")
MONTH_TOKEN_PATTERN = re.compile(r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)", re.IGNORECASE)


def _normalize_col(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value).strip().lower())


def _pick_transaction_column(source_columns: list[str]) -> str | None:
    for col in source_columns:
        normalized = _normalize_col(col)
        if normalized in {"sku", "partnumber", "partno", "itemcode", "productcode", "code"}:
            return col
    for col in source_columns:
        normalized = _normalize_col(col)
        if any(token in normalized for token in ("sku", "part", "itemcode", "productcode", "transaction", "code")):
            return col
    return None


def _pick_batch_column(source_columns: list[str]) -> str | None:
    for col in source_columns:
        normalized = _normalize_col(col)
        if normalized in {"batch", "batchno", "batchnumber"}:
            return col
    for col in source_columns:
        if "batch" in _normalize_col(col):
            return col
    return None


def _is_probable_date_token(value: str) -> bool:
    token = value.strip()
    if not token:
        return False
    if any(pattern.match(token) for pattern in DATE_TOKEN_PATTERNS):
        return True
    if MONTH_TOKEN_PATTERN.search(token) and any(ch.isdigit() for ch in token):
        return True
    return False


@router.post("/health-check")
async def health_check(file: UploadFile = File(...)):
    try:
        df = clean_and_load(file, max_pages=2, enable_ocr_fallback=False)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {exc}") from exc

    source_columns = list(df.columns)
    transaction_column = _pick_transaction_column(source_columns)
    batch_column = _pick_batch_column(source_columns)

    sku_corruption_count = 0
    sku_examples: list[str] = []
    checked_rows = 0
    if transaction_column:
        for raw in df[transaction_column].fillna("").astype(str).tolist():
            value = raw.strip()
            if not value:
                continue
            checked_rows += 1
            if _is_probable_date_token(value) or SCIENTIFIC_PATTERN.match(value):
                sku_corruption_count += 1
                if len(sku_examples) < 3 and value not in sku_examples:
                    sku_examples.append(value)

    missing_zero_count = 0
    batch_examples: list[str] = []
    if batch_column:
        batch_values = [v.strip() for v in df[batch_column].fillna("").astype(str).tolist() if v.strip().isdigit()]
        if batch_values:
            max_len = max(len(v) for v in batch_values)
            if max_len >= 3:
                short_values = [v for v in batch_values if len(v) < max_len]
                missing_zero_count = len(short_values)
                batch_examples = short_values[:3]

    issue_count = sku_corruption_count + missing_zero_count
    return {
        "status": "ok",
        "summary": {
            "rows_checked": checked_rows or len(df),
            "issue_count": issue_count,
            "sku_corruption_count": sku_corruption_count,
            "missing_leading_zero_count": missing_zero_count,
        },
        "columns": {
            "transaction_id": transaction_column,
            "batch": batch_column,
        },
        "examples": {
            "sku": sku_examples,
            "batch": batch_examples,
        },
    }
