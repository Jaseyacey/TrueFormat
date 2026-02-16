from __future__ import annotations

import io
import json
import math
import os
import re
import sqlite3
import hmac
import base64
import time
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
import pandas as pd
import pdfplumber
from fastapi import FastAPI, UploadFile, File, Form, Response, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from dotenv import load_dotenv

try:
    import numpy as np
    import pypdfium2 as pdfium
    from rapidocr_onnxruntime import RapidOCR
except Exception:
    np = None
    pdfium = None
    RapidOCR = None

app = FastAPI()

# Load local backend env file when present.
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

cors_allowed_origins_env = os.getenv("CORS_ALLOWED_ORIGINS", "")
if cors_allowed_origins_env.strip():
    CORS_ALLOWED_ORIGINS = [
        origin.strip().rstrip("/")
        for origin in cors_allowed_origins_env.split(",")
        if origin.strip()
    ]
else:
    # Local development defaults.
    CORS_ALLOWED_ORIGINS = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# PM NOTE: Removed empty string to prevent KeyError during transformation
TARGET_SCHEMA = ["transaction_id", "date", "description", "quantity", "amount", "line_total", "customer_name"]

# Use a mounted persistent path in production (for Render: /var/data/trueformat.db).
DB_PATH = os.getenv("DB_PATH", os.path.join(os.path.dirname(__file__), "trueformat.db"))
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
SUPABASE_AUTH_AUD = os.getenv("SUPABASE_AUTH_AUD", "authenticated")
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_DEV_TRUST_CLAIMS = os.getenv("SUPABASE_DEV_TRUST_CLAIMS", "").lower() in {"1", "true", "yes"}
try:
    UPLOAD_PAGE_LIMIT = max(1, int(os.getenv("UPLOAD_PAGE_LIMIT", "2")))
except ValueError:
    UPLOAD_PAGE_LIMIT = 2
ALLOW_SCANNED_PDFS = os.getenv("ALLOW_SCANNED_PDFS", "false").lower() in {"1", "true", "yes"}
auth_scheme = HTTPBearer(auto_error=False)


class InterestRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str
    company: str = Field(default="", max_length=200)
    message: str = Field(default="", max_length=3000)


def _db_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _db_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS interest_leads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                company TEXT,
                message TEXT,
                created_at INTEGER NOT NULL
            )
            """
        )
        conn.commit()


def _normalize_email(raw: str) -> str:
    email = (raw or "").strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=422, detail="Valid email is required.")
    return email


def _b64url_decode(value: str) -> bytes:
    padding = "=" * ((4 - len(value) % 4) % 4)
    return base64.urlsafe_b64decode((value + padding).encode("utf-8"))


def _parse_supabase_token(token: str) -> dict | None:
    # Legacy/shared-secret verification path (HS256 projects).
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


def _decode_unverified_jwt_claims(token: str) -> dict | None:
    try:
        _header_b64, payload_b64, _sig_b64 = token.split(".", 2)
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
        return payload if isinstance(payload, dict) else None
    except Exception:
        return None


def _validate_supabase_token_remote(token: str) -> tuple[dict | None, str | None]:
    """
    Validate token via Supabase Auth API. Supports asymmetric JWT projects
    (e.g. ES256) where local HMAC verification is not applicable.
    """
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


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(auth_scheme),
) -> str:
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required.")

    token = credentials.credentials
    payload = _parse_supabase_token(token)
    if not payload:
        payload, remote_error = _validate_supabase_token_remote(token)
    else:
        remote_error = None

    email = _normalize_email(payload.get("email", "")) if payload else None
    if not email:
        claims = _decode_unverified_jwt_claims(token) or {}
        exp = int(claims.get("exp", 0)) if claims.get("exp") else 0
        if exp and exp <= int(time.time()):
            raise HTTPException(status_code=401, detail="Supabase token expired. Please log in again.")
        if SUPABASE_DEV_TRUST_CLAIMS and claims.get("email"):
            # Development-only fallback when backend cannot reach Supabase Auth.
            return _normalize_email(claims.get("email", ""))
        raise HTTPException(
            status_code=401,
            detail=(
                "Invalid or expired Supabase token. "
                f"{remote_error or 'Token verification failed'}."
            ),
        )
    return email


init_db()

# --- HELPER FUNCTIONS (The "Integrity Engine") ---

def extract_customer_name_from_pdf(contents: bytes, max_pages: int | None = None) -> str | None:
    """
    Extract customer name from PDF text by looking for common patterns
    like 'Bill To:', 'Customer:', or company names in the header area.
    """
    try:
        with pdfplumber.open(io.BytesIO(contents)) as pdf:
            for page_idx, page in enumerate(pdf.pages):
                if max_pages is not None and page_idx >= max_pages:
                    break
                text = page.extract_text()
                if not text:
                    continue
                
                # Look for common invoice patterns
                lines = text.split('\n')
                for i, line in enumerate(lines):
                    line_lower = line.lower().strip()
                    # Check for "Bill To", "Customer", "Sold To" patterns
                    if any(keyword in line_lower for keyword in ['bill to', 'customer:', 'sold to', 'client:']):
                        # Next line(s) often contain the customer name
                        for j in range(i + 1, min(i + 5, len(lines))):
                            potential_name = lines[j].strip()
                            # Skip empty lines, addresses, or very short lines
                            if len(potential_name) > 5 and not potential_name.lower().startswith(('address', 'phone', 'email')):
                                # Check if it looks like a company name (has letters, might have Ltd/Inc/etc)
                                if any(char.isalpha() for char in potential_name):
                                    return potential_name
                
                # Fallback: Look for company name patterns (Ltd, Inc, LLC, etc.)
                for line in lines[:30]:  # Check first 30 lines (header area)
                    line = line.strip()
                    if len(line) > 5 and any(suffix in line.lower() for suffix in ['ltd', 'inc', 'llc', 'corp', 'limited']):
                        # Extract just the company name part (before address details)
                        parts = line.split(',')
                        if parts:
                            return parts[0].strip()
    except Exception:
        pass  # If extraction fails, return None - customer_name will be null
    
    return None


def _parse_date_str(date_str: str) -> str | None:
    """Parse a date string and return ISO YYYY-MM-DD or None."""
    import re
    from datetime import datetime
    date_str = re.sub(r'\s+', ' ', date_str.strip())
    for fmt in ['%d/%m/%Y', '%d-%m-%Y', '%Y-%m-%d', '%d.%m.%Y', '%d/%m/%y', '%d-%m-%y', '%d %b %Y', '%d %B %Y']:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime('%Y-%m-%d')
        except ValueError:
            continue
    return date_str if date_str else None


def extract_invoice_date_from_pdf(contents: bytes, max_pages: int | None = None) -> str | None:
    """
    Extract invoice date from PDF text. Looks for date on same line as keywords
    (e.g. 'Invoice Date 10/02/2026') and in the first 50 lines.
    """
    try:
        with pdfplumber.open(io.BytesIO(contents)) as pdf:
            for page_idx, page in enumerate(pdf.pages):
                if max_pages is not None and page_idx >= max_pages:
                    break
                text = page.extract_text()
                if not text:
                    continue
                lines = text.split('\n')
                # Same-line and next-line: when we see a date keyword, look for date on same line first
                date_keywords = ['invoice date', 'date:', 'issued:', 'date issued', 'invoice date:', 'date of invoice']
                date_patterns = [
                    r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}',  # DD/MM/YYYY or DD-MM-YYYY
                    r'\d{4}[/-]\d{1,2}[/-]\d{1,2}',    # YYYY-MM-DD or YYYY/MM/DD
                    r'\d{1,2}\.\d{1,2}\.\d{2,4}',     # DD.MM.YYYY
                    r'\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}',  # "10 Feb 2026" or "10 February 2026"
                ]
                for i, line in enumerate(lines):
                    line_lower = line.lower().strip()
                    if any(kw in line_lower for kw in date_keywords):
                        # Check same line first - extract full date string after keyword
                        for kw in date_keywords:
                            if kw in line_lower:
                                # Get text after the keyword
                                kw_pos = line_lower.find(kw)
                                after_kw = line[kw_pos + len(kw):].strip()
                                # Try to extract date from the remaining text
                                for pattern in date_patterns:
                                    matches = re.findall(pattern, after_kw, re.IGNORECASE)
                                    if matches:
                                        parsed = _parse_date_str(matches[0])
                                        if parsed:
                                            return parsed
                        # Fallback: check next few lines
                        for j in range(i + 1, min(i + 4, len(lines))):
                            for pattern in date_patterns:
                                matches = re.findall(pattern, lines[j], re.IGNORECASE)
                                if matches:
                                    parsed = _parse_date_str(matches[0])
                                    if parsed:
                                        return parsed
                # Fallback: any date in first 50 lines (header area)
                for line in lines[:50]:
                    for pattern in date_patterns:
                        matches = re.findall(pattern, line)
                        if matches:
                            parsed = _parse_date_str(matches[0])
                            if parsed:
                                return parsed
    except Exception:
        pass
    return None


def _extract_ocr_tokens_from_pdf(contents: bytes, max_pages: int | None = None) -> list[dict]:
    """Extract OCR tokens with coordinates from an image-only PDF."""
    if np is None or pdfium is None or RapidOCR is None:
        return []

    tokens: list[dict] = []
    try:
        doc = pdfium.PdfDocument(contents)
        ocr = RapidOCR()
        page_count = len(doc) if max_pages is None else min(len(doc), max_pages)
        for page_num in range(page_count):
            page = doc[page_num]
            bitmap = page.render(scale=2.5)
            image = np.array(bitmap.to_pil())
            result, _ = ocr(image)
            for entry in result or []:
                box, text, *_ = entry
                text = str(text).strip()
                if not text:
                    continue
                xs = [p[0] for p in box]
                ys = [p[1] for p in box]
                tokens.append({
                    "page": page_num,
                    "text": text,
                    "x0": float(min(xs)),
                    "x1": float(max(xs)),
                    "y0": float(min(ys)),
                    "y1": float(max(ys)),
                    "x": float(sum(xs) / len(xs)),
                    "y": float(sum(ys) / len(ys)),
                })
    except Exception:
        return []
    return tokens


def _extract_metadata_from_ocr_tokens(tokens: list[dict]) -> tuple[str | None, str | None]:
    """Extract (customer_name, invoice_date) from OCR token stream."""
    if not tokens:
        return None, None
    tokens_sorted = sorted(tokens, key=lambda t: (t["page"], t["y"], t["x"]))
    lines = [t["text"] for t in tokens_sorted]
    invoice_date = None
    customer_name = None

    date_patterns = [
        r"\d{1,2}/\d{1,2}/\d{2,4}",
        r"\d{1,2}-\d{1,2}-\d{2,4}",
        r"\d{4}-\d{1,2}-\d{1,2}",
        r"\d{1,2}\.\d{1,2}\.\d{2,4}",
    ]
    for line in lines:
        for pattern in date_patterns:
            matches = re.findall(pattern, line)
            if matches:
                parsed = _parse_date_str(matches[0])
                if parsed:
                    invoice_date = parsed
                    break
        if invoice_date:
            break

    for i, line in enumerate(lines):
        ll = line.lower()
        if "invoice to" in ll or "bill to" in ll or "customer" in ll:
            for candidate in lines[i + 1:i + 7]:
                c = candidate.strip()
                cl = c.lower()
                if (
                    len(c) > 4
                    and any(ch.isalpha() for ch in c)
                    and not any(bad in cl for bad in ("deliver", "account", "operator", "tax", "vat", "page", "date"))
                ):
                    customer_name = c
                    break
            if customer_name:
                break

    return customer_name, invoice_date


def extract_pdf_tables_via_ocr(contents: bytes, max_pages: int | None = None) -> pd.DataFrame:
    """
    OCR fallback for scanned/image PDFs.
    Uses header X-positions to map row tokens into structured line-item columns.
    """
    tokens = _extract_ocr_tokens_from_pdf(contents, max_pages=max_pages)
    if not tokens:
        raise ValueError(
            "No readable text or table found. This appears to be a scanned PDF and OCR is unavailable."
        )

    customer_name, invoice_date = _extract_metadata_from_ocr_tokens(tokens)

    def _header_key(text: str) -> str | None:
        tl = text.strip().lower()
        if not tl:
            return None
        if any(k in tl for k in ("description", "details", "item", "product", "service")):
            return "description"
        if any(k in tl for k in ("qty", "quantity")):
            return "quantity"
        if any(k in tl for k in ("unit price", "price", "rate", "amount")):
            return "price"
        if any(k in tl for k in ("line total", "total", "net", "value")):
            return "total"
        if "code" in tl or tl in {"#", "no"}:
            return "code"
        return None

    page_tokens: list[dict] = []
    header_band: list[dict] = []
    header_y = 0.0

    pages = sorted({int(t["page"]) for t in tokens})
    for page_no in pages:
        current_page_tokens = [t for t in tokens if int(t["page"]) == page_no]
        current_page_tokens.sort(key=lambda t: (t["y"], t["x"]))
        if not current_page_tokens:
            continue

        candidate_headers = [t for t in current_page_tokens if _header_key(t["text"]) is not None]
        if not candidate_headers:
            continue

        # Find the densest header-like row by Y band.
        candidate_headers.sort(key=lambda t: t["y"])
        best_band = []
        best_keys: set[str] = set()
        for center in candidate_headers:
            band = [t for t in candidate_headers if abs(t["y"] - center["y"]) <= 18]
            keys = {_header_key(t["text"]) for t in band}
            keys.discard(None)
            if len(keys) > len(best_keys):
                best_band = band
                best_keys = set(keys)

        # Need at least two semantic headers (for example description + total).
        if len(best_keys) >= 2:
            page_tokens = current_page_tokens
            header_band = best_band
            header_y = sum(t["y"] for t in best_band) / len(best_band)
            break

    if not header_band:
        raise ValueError("OCR could not locate line-item headers in this scanned PDF.")

    anchors: dict[str, float] = {}
    for t in sorted(header_band, key=lambda x: x["x"]):
        key = _header_key(t["text"])
        if key and key not in anchors:
            anchors[key] = t["x"]

    stop_y = None
    for t in page_tokens:
        lower = t["text"].lower()
        if t["y"] > header_y and any(k in lower for k in ("subtotal", "sub total", "vat", "amount due")):
            stop_y = t["y"]
            break
    if stop_y is None:
        stop_y = max(t["y"] for t in page_tokens) + 1

    data_tokens = [
        t for t in page_tokens
        if (t["y"] > header_y + 20 and t["y"] < stop_y - 5)
    ]
    if not data_tokens:
        raise ValueError("OCR found headers but no line-item rows.")

    # Cluster OCR tokens into visual rows by Y coordinate.
    row_tolerance = 16.0
    rows: list[list[dict]] = []
    for tok in sorted(data_tokens, key=lambda t: (t["y"], t["x"])):
        if not rows:
            rows.append([tok])
            continue
        current_y = sum(t["y"] for t in rows[-1]) / len(rows[-1])
        if abs(tok["y"] - current_y) <= row_tolerance:
            rows[-1].append(tok)
        else:
            rows.append([tok])

    parsed_rows = []
    for row in rows:
        row = sorted(row, key=lambda t: t["x"])
        texts = [t["text"] for t in row]
        if not any(re.search(r"\d", txt) for txt in texts):
            continue

        record = {"#": "", "Description": "", "Qty": "", "Unit price": "", "Line total": ""}
        desc_parts = []
        qty_candidates = []
        price_candidates = []
        total_candidates = []

        for tok in row:
            tx = tok["text"].strip()
            tl = tx.lower()
            if any(k in tl for k in ("subtotal", "vat", "total")) and not re.search(r"\d", tx):
                continue
            if re.search(r"^[A-Za-z]\d+", tx) or re.search(r"^[A-Za-z]{1,3}\d{3,}$", tx):
                record["#"] = tx
                continue

            is_numeric = bool(re.search(r"\d", tx))
            x = tok["x"]

            # Use header x-anchors when available.
            if is_numeric and "quantity" in anchors and abs(x - anchors["quantity"]) < 90:
                qty_candidates.append(tx)
            elif is_numeric and "price" in anchors and abs(x - anchors["price"]) < 120:
                price_candidates.append(tx)
            elif is_numeric and "total" in anchors and abs(x - anchors["total"]) < 140:
                total_candidates.append(tx)
            else:
                desc_parts.append(tx)

        numeric_re = re.compile(r"[-+]?\d[\d,]*(?:\.\d+)?")
        if qty_candidates:
            q = qty_candidates[0]
            qn = "".join(numeric_re.findall(q)).replace(",", "")
            record["Qty"] = qn
        if price_candidates:
            p = price_candidates[0]
            pn = "".join(numeric_re.findall(p)).replace(",", "")
            record["Unit price"] = pn
        if total_candidates:
            t = total_candidates[0]
            tn = "".join(numeric_re.findall(t)).replace(",", "")
            record["Line total"] = tn

        # Fallback when header anchors are imperfect: infer from left-to-right numeric order.
        if not (record["Qty"] and record["Unit price"] and record["Line total"]):
            numeric_tokens = []
            for tok in row:
                nums = numeric_re.findall(tok["text"])
                if not nums:
                    continue
                cleaned = "".join(nums).replace(",", "")
                if cleaned:
                    numeric_tokens.append((tok["x"], cleaned))
            numeric_tokens.sort(key=lambda n: n[0])
            if numeric_tokens:
                if not record["Line total"]:
                    record["Line total"] = numeric_tokens[-1][1]
                if len(numeric_tokens) >= 2 and not record["Unit price"]:
                    record["Unit price"] = numeric_tokens[-2][1]
                if len(numeric_tokens) >= 3 and not record["Qty"]:
                    record["Qty"] = numeric_tokens[0][1]

        record["Description"] = " ".join(desc_parts).strip()
        if not any(record.values()):
            continue

        # Skip summary lines if they leaked through.
        if record["Description"].lower() in {"subtotal", "total", "vat"}:
            continue

        parsed_rows.append(record)

    if not parsed_rows:
        raise ValueError("OCR completed but no line items could be parsed.")

    df = pd.DataFrame(parsed_rows)
    df = df.map(lambda v: '' if isinstance(v, str) and v.strip().lower() in ('nan', 'none', 'null', '') else (v.strip() if isinstance(v, str) else v))

    if customer_name:
        df['_extracted_customer_name'] = customer_name
    if invoice_date:
        df['_extracted_invoice_date'] = invoice_date
    return df


def extract_pdf_tables(
    contents: bytes,
    max_pages: int | None = None,
    enable_ocr_fallback: bool = True,
) -> pd.DataFrame:
    """
    Targeted extraction: Only extract the Line Items table, not metadata.
    Uses keyword matching to identify the correct table.
    Also extracts customer name and invoice date from PDF text and broadcasts them.
    """
    all_tables = []
    customer_name = None
    invoice_date = None
    
    try:
        with pdfplumber.open(io.BytesIO(contents)) as pdf:
            # First pass: Extract metadata from text (customer name and invoice date)
            customer_name = extract_customer_name_from_pdf(contents, max_pages=max_pages)
            invoice_date = extract_invoice_date_from_pdf(contents, max_pages=max_pages)
            
            # Second pass: Extract line items table
            for page_idx, page in enumerate(pdf.pages):
                if max_pages is not None and page_idx >= max_pages:
                    break
                tables = page.extract_tables()
                if not tables:
                    continue
                
                for table in tables:
                    if not table or len(table) < 2:
                        continue
                    
                    # Create temporary DF to inspect headers
                    headers = [str(h).strip().lower() for h in table[0] if h]
                    
                    # TARGETED EXTRACTION: Only keep the table that looks like "Line Items"
                    # Keywords that indicate a line items table (not totals/metadata)
                    line_item_keywords = {
                        'description', 'qty', 'quantity', 'unit price', 'unit price', 
                        'line total', 'item', 'product', 'service'
                    }
                    
                    # Exclude metadata tables (totals, invoice details, etc.)
                    metadata_keywords = {
                        'invoice no', 'invoice number', 'invoice date', 'total', 
                        'subtotal', 'tax', 'amount due', 'due date'
                    }
                    
                    # Check if this looks like a line items table
                    has_line_item_keywords = any(keyword in ' '.join(headers) for keyword in line_item_keywords)
                    has_only_metadata = all(keyword in ' '.join(headers) for keyword in metadata_keywords) if metadata_keywords else False
                    
                    if has_line_item_keywords and not has_only_metadata:
                        # Create DataFrame and handle None/empty cells properly
                        df_page = pd.DataFrame(table[1:], columns=table[0])
                        # Replace None with empty string before string conversion
                        df_page = df_page.fillna('')
                        all_tables.append(df_page)

    except Exception as e:
        raise ValueError(f"Could not read PDF file. {e}")

    if not all_tables:
        if enable_ocr_fallback and ALLOW_SCANNED_PDFS:
            # Fallback for scanned/image-only PDFs.
            return extract_pdf_tables_via_ocr(contents, max_pages=max_pages)
        raise ValueError(
            "Scanned/image PDFs are not supported yet. Please upload a text-based PDF."
        )
    
    # Combine only the relevant line-item tables
    df = pd.concat(all_tables, ignore_index=True)
    
    # Standard TrueFormat Integrity Cleaning (String-First principle)
    # Fill NaN/None before converting to string to preserve empty cells
    df = df.fillna('')
    df = df.astype(str)
    df.columns = [str(col).strip() for col in df.columns]
    
    # Normalize column names: fix common PDF extraction issues
    def normalize_column_name(col_name: str) -> str:
        """Normalize column names to handle PDF extraction quirks."""
        col_lower = col_name.lower().strip()
        if not col_name:
            return ''
        # Handle "# Qty" or "1 O Qty" -> "Qty"
        if 'qty' in col_lower and ('#' in col_name or col_name[0].isdigit()):
            return 'Qty'
        # Handle "Unit price" variations
        if 'unit' in col_lower and 'price' in col_lower:
            return 'Unit price'
        # Handle "Line total" variations
        if 'line' in col_lower and 'total' in col_lower:
            return 'Line total'
        # Handle "#" column
        if col_name.strip() == '#' or col_name.strip().isdigit():
            return '#'
        return col_name.strip()
    
    df.columns = [normalize_column_name(col) for col in df.columns]

    def _is_blank(v) -> bool:
        if v is None:
            return True
        if isinstance(v, float) and math.isnan(v):
            return True
        return str(v).strip() == ''

    def _looks_like_continuation_row(row: pd.Series, numeric_cols: list[str], text_cols: list[str]) -> bool:
        has_text = any(not _is_blank(row.get(c, '')) for c in text_cols)
        has_numeric = any(not _is_blank(row.get(c, '')) for c in numeric_cols)
        return has_text and not has_numeric

    # Merge wrapped description rows emitted as separate PDF rows.
    description_like_cols = [
        c for c in df.columns
        if any(k in c.lower() for k in ('description', 'item', 'product', 'service'))
    ]
    numeric_like_cols = [
        c for c in df.columns
        if any(k in c.lower() for k in ('qty', 'quantity', 'unit price', 'line total', 'amount', '#'))
    ]
    if description_like_cols:
        merged_rows: list[dict] = []
        for _, row in df.iterrows():
            if all(_is_blank(v) for v in row.values):
                continue

            if merged_rows and _looks_like_continuation_row(row, numeric_like_cols, description_like_cols):
                for col in description_like_cols:
                    value = str(row.get(col, '')).strip()
                    if value:
                        prev = str(merged_rows[-1].get(col, '')).strip()
                        merged_rows[-1][col] = f"{prev} {value}".strip() if prev else value
                continue

            merged_rows.append(row.to_dict())

        if merged_rows:
            df = pd.DataFrame(merged_rows, columns=df.columns)
    
    # Strip whitespace and replace 'nan', 'None' strings with empty string
    df = df.map(lambda v: '' if isinstance(v, str) and v.strip().lower() in ('nan', 'none', 'null', '') else (v.strip() if isinstance(v, str) else v))
    
    # BROADCAST extracted metadata: Add as columns so they appear on every row
    if customer_name:
        df['_extracted_customer_name'] = customer_name
    
    if invoice_date:
        df['_extracted_invoice_date'] = invoice_date
    
    return df

def clean_and_load(
    file: UploadFile,
    max_pages: int | None = None,
    enable_ocr_fallback: bool = True,
) -> pd.DataFrame:
    """Loads file while preventing 15-digit rounding and date-flipping."""
    contents = file.file.read()
    
    if file.filename.lower().endswith(".pdf"):
        return extract_pdf_tables(
            contents,
            max_pages=max_pages,
            enable_ocr_fallback=enable_ocr_fallback,
        )
    
    # Read everything as string to prevent scientific notation on IDs
    if file.filename.endswith(".xlsx"):
        df = pd.read_excel(io.BytesIO(contents), dtype=str)
    else:
        df = pd.read_csv(io.BytesIO(contents), dtype=str)

    df.columns = [str(col).strip() for col in df.columns]
    df = df.map(lambda v: v.strip() if isinstance(v, str) else v)
    return df

def apply_transformation(file: UploadFile, mapping: dict) -> pd.DataFrame:
    """The 'Contract Enforcer' - Maps, Coerces, and Validates."""
    df = clean_and_load(file)

    # Filter out empty mappings and non-existent columns
    valid_mapping = {target: source for target, source in mapping.items() 
                     if source and source in df.columns}

    def _is_extracted_col(col: str) -> bool:
        return str(col).startswith('_extracted_')

    def _find_col_by_keywords(include: tuple[str, ...], exclude: tuple[str, ...] = ()) -> str | None:
        for col in df.columns:
            if _is_extracted_col(col):
                continue
            cl = str(col).lower().strip()
            if any(e in cl for e in exclude):
                continue
            if all(k in cl for k in include):
                return col
        return None

    # PDF guardrail: if amount/line_total collide on the same source column,
    # re-anchor line_total to a total-like column when available.
    if file.filename.lower().endswith(".pdf"):
        amount_src = valid_mapping.get("amount")
        line_total_src = valid_mapping.get("line_total")
        if amount_src and line_total_src and amount_src == line_total_src:
            better_total = _find_col_by_keywords(("line", "total")) or _find_col_by_keywords(("total",), ("sub", "due", "tax"))
            if better_total and better_total != amount_src:
                valid_mapping["line_total"] = better_total

        # If line_total is missing entirely, pick a best-effort total column.
        if "line_total" not in valid_mapping:
            better_total = _find_col_by_keywords(("line", "total")) or _find_col_by_keywords(("total",), ("sub", "due", "tax"))
            if better_total:
                valid_mapping["line_total"] = better_total

    # Build final dataframe to avoid SettingWithCopy warnings and column collisions
    final_df = pd.DataFrame()
    for target, source in valid_mapping.items():
        final_df[target] = df[source].copy()

    # Data Coercion with Integrity Checks
    def _coerce_currency(series):
        cleaned = (
            series.astype(str)
            .str.replace(r'[£$€¥₹,%\s]', '', regex=True)
            # Remove OCR/text noise while keeping numeric syntax.
            .str.replace(r'[^0-9.\-]', '', regex=True)
        )
        return pd.to_numeric(cleaned, errors="coerce")

    def _coerce_quantity(series):
        cleaned = (
            series.astype(str)
            .str.strip()
            .replace({'': pd.NA, 'nan': pd.NA, 'None': pd.NA, 'null': pd.NA})
            # Fix common PDF/OCR substitutions in numeric fields (e.g. "1 O" -> "10")
            .str.replace('O', '0', regex=False)
            .str.replace('o', '0', regex=False)
            .str.replace('I', '1', regex=False)
            .str.replace('l', '1', regex=False)
            .str.replace(r'\s+', '', regex=True)
            # Remove residual non-numeric OCR noise (e.g. "N1" -> "1").
            .str.replace(r'[^0-9.\-]', '', regex=True)
        )
        return pd.to_numeric(cleaned, errors="coerce")

    if "quantity" in final_df.columns:
        final_df["quantity"] = _coerce_quantity(final_df["quantity"])
    if "amount" in final_df.columns:
        final_df["amount"] = _coerce_currency(final_df["amount"])
    if "line_total" in final_df.columns:
        final_df["line_total"] = _coerce_currency(final_df["line_total"])
    # Derive missing line_total when qty + amount are present.
    if {"quantity", "amount", "line_total"}.issubset(final_df.columns):
        mask = (
            final_df["line_total"].isna()
            & final_df["quantity"].notna()
            & final_df["amount"].notna()
        )
        final_df.loc[mask, "line_total"] = final_df.loc[mask, "quantity"] * final_df.loc[mask, "amount"]
    # Derive missing amount when qty + line_total are present.
    if {"quantity", "amount", "line_total"}.issubset(final_df.columns):
        mask = (
            final_df["amount"].isna()
            & final_df["quantity"].notna()
            & final_df["line_total"].notna()
            & (final_df["quantity"] != 0)
        )
        final_df.loc[mask, "amount"] = final_df.loc[mask, "line_total"] / final_df.loc[mask, "quantity"]
    # Derive missing quantity when line_total + amount are present.
    if {"quantity", "amount", "line_total"}.issubset(final_df.columns):
        mask = (
            final_df["quantity"].isna()
            & final_df["line_total"].notna()
            & final_df["amount"].notna()
            & (final_df["amount"] != 0)
        )
        final_df.loc[mask, "quantity"] = final_df.loc[mask, "line_total"] / final_df.loc[mask, "amount"]
        final_df["quantity"] = final_df["quantity"].round(6)
    # Where amount is missing but line_total exists, use line_total so we don't lose values
    if "amount" in final_df.columns and "line_total" in final_df.columns:
        mask = final_df["amount"].isna() & final_df["line_total"].notna()
        final_df.loc[mask, "amount"] = final_df.loc[mask, "line_total"]

    if "date" in final_df.columns:
        # Standardize to ISO-8601; format='mixed' avoids inference warning, dayfirst for DD/MM
        final_df["date"] = pd.to_datetime(
            final_df["date"], errors="coerce", format="mixed", dayfirst=True
        ).dt.strftime("%Y-%m-%d")

    return final_df

# --- API ENDPOINTS ---

@app.post("/interest")
async def submit_interest(payload: InterestRequest):
    email = _normalize_email(payload.email)
    with _db_conn() as conn:
        conn.execute(
            """
            INSERT INTO interest_leads (name, email, company, message, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                payload.name.strip(),
                email,
                payload.company.strip(),
                payload.message.strip(),
                int(time.time()),
            ),
        )
        conn.commit()
    return {"status": "ok", "message": "Thanks. We received your interest form."}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), current_user: str = Depends(get_current_user)):
    """Initial upload to identify headers and suggest mapping."""
    try:
        # Fast path for mapping suggestion: sample first pages only.
        df = clean_and_load(
            file,
            max_pages=UPLOAD_PAGE_LIMIT,
            enable_ocr_fallback=False,
        )
        source_columns = list(df.columns)
        
        # Include all columns in the dropdown, including extracted metadata
        # The extracted columns will appear as options users can select
        
        # Simple fuzzy logic for MVP
        mapping = {}
        for target in TARGET_SCHEMA:
            if target == 'customer_name' and '_extracted_customer_name' in source_columns:
                mapping[target] = '_extracted_customer_name'
            elif target == 'date' and '_extracted_invoice_date' in source_columns:
                mapping[target] = '_extracted_invoice_date'
            elif target == 'description':
                # Prioritize common line-item text columns.
                desc_col = next(
                    (
                        s for s in source_columns
                        if s.strip().lower() in ('description', 'item', 'product', 'service', 'details')
                    ),
                    None,
                )
                if desc_col:
                    mapping[target] = desc_col
                else:
                    for source in source_columns:
                        if source.startswith('_extracted_'):
                            continue
                        sl = source.lower().strip()
                        if any(k in sl for k in ('description', 'item', 'product', 'service', 'details')):
                            mapping[target] = source
                            break
            elif target == 'quantity':
                # First try exact match
                qty_col = next((s for s in source_columns if s.strip().lower() in ('qty', 'quantity')), None)
                if qty_col:
                    mapping[target] = qty_col
                else:
                    # Then try partial match (handles "1 O Qty", "# Qty", etc.)
                    for source in source_columns:
                        if source.startswith('_extracted_'):
                            continue
                        sl = source.lower().strip()
                        # Match if contains 'qty' or 'quantity' (handles "1 O Qty" -> matches)
                        if 'qty' in sl or 'quantity' in sl:
                            mapping[target] = source
                            break
            elif target == 'line_total':
                # Keep line_total anchored to "Line total" when available.
                line_total_col = next((s for s in source_columns if s.strip().lower() == 'line total'), None)
                if line_total_col:
                    mapping[target] = line_total_col
                else:
                    for source in source_columns:
                        if source.startswith('_extracted_'):
                            continue
                        sl = source.lower()
                        if 'line total' in sl or ('total' in sl and 'sub' not in sl):
                            mapping[target] = source
                            break
            elif target == 'amount':
                # Prefer unit price for amount; otherwise amount-like columns.
                amount_col = next((s for s in source_columns if s.strip().lower() in ('unit price', 'amount', 'price')), None)
                if amount_col:
                    mapping[target] = amount_col
                else:
                    for source in source_columns:
                        if source.startswith('_extracted_'):
                            continue
                        sl = source.lower()
                        if 'unit price' in sl or 'amount' in sl or (sl == 'price'):
                            mapping[target] = source
                            break
            else:
                for source in source_columns:
                    if source.startswith('_extracted_'):
                        continue
                    if target.lower() in source.lower() or source.lower() in target.lower():
                        mapping[target] = source
                        break
        
        return {
            "sourceColumns": source_columns,  # Include all columns including extracted ones
            "targetFields": TARGET_SCHEMA,
            "suggestedMapping": mapping,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/transform")
async def transform_data(
    file: UploadFile = File(...),
    mapping: str = Form(...),
    current_user: str = Depends(get_current_user),
):
    """Applies mapping and returns a preview for the UI."""
    try:
        user_map = json.loads(mapping)
        df = apply_transformation(file, user_map)

        # JSON safety: Replace NaN with None
        preview_dict = df.to_dict(orient="records")
        preview_cleaned = [
            {k: (None if isinstance(v, float) and math.isnan(v) else v) 
             for k, v in row.items()} for row in preview_dict
        ]

        return {
            "status": "success",
            "preview": preview_cleaned,
            "null_count": df.isnull().sum().to_dict(),
            "row_count": len(df),
        }
    except Exception as e:
        return {"status": "error", "message": f"Transformation failed: {str(e)}"}

@app.post("/export-csv")
async def export_csv(
    file: UploadFile = File(...),
    mapping: str = Form(...),
    current_user: str = Depends(get_current_user),
):
    """The money shot: Returns the cleaned file to the user."""
    try:
        user_map = json.loads(mapping)
        df = apply_transformation(file, user_map)

        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        
        return Response(
            content=csv_buffer.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="trueformat-export.csv"'}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Export failed: {e}")

@app.get("/health")
async def health():
    return {"status": "online", "version": "MVP-1.0"}
