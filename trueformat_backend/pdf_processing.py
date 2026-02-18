from __future__ import annotations

import io
import math
import re

import pandas as pd
import pdfplumber

from .settings import ALLOW_SCANNED_PDFS

try:
    import numpy as np
    import pypdfium2 as pdfium
    from rapidocr_onnxruntime import RapidOCR
except Exception:
    np = None
    pdfium = None
    RapidOCR = None


def extract_customer_name_from_pdf(contents: bytes, max_pages: int | None = None) -> str | None:
    try:
        with pdfplumber.open(io.BytesIO(contents)) as pdf:
            for page_idx, page in enumerate(pdf.pages):
                if max_pages is not None and page_idx >= max_pages:
                    break
                text = page.extract_text()
                if not text:
                    continue

                lines = text.split("\n")
                for i, line in enumerate(lines):
                    line_lower = line.lower().strip()
                    if any(keyword in line_lower for keyword in ["bill to", "customer:", "sold to", "client:"]):
                        for j in range(i + 1, min(i + 5, len(lines))):
                            potential_name = lines[j].strip()
                            if len(potential_name) > 5 and not potential_name.lower().startswith(("address", "phone", "email")):
                                if any(char.isalpha() for char in potential_name):
                                    return potential_name

                for line in lines[:30]:
                    line = line.strip()
                    if len(line) > 5 and any(suffix in line.lower() for suffix in ["ltd", "inc", "llc", "corp", "limited"]):
                        parts = line.split(",")
                        if parts:
                            return parts[0].strip()
    except Exception:
        pass

    return None


def parse_date_str(date_str: str) -> str | None:
    from datetime import datetime

    date_str = re.sub(r"\s+", " ", date_str.strip())
    for fmt in [
        "%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%d.%m.%Y",
        "%d/%m/%y", "%d-%m-%y", "%d.%m.%y",
        "%d %b %Y", "%d %B %Y", "%d %b %y", "%d %B %y",
    ]:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def extract_invoice_date_from_pdf(contents: bytes, max_pages: int | None = None) -> str | None:
    try:
        with pdfplumber.open(io.BytesIO(contents)) as pdf:
            for page_idx, page in enumerate(pdf.pages):
                if max_pages is not None and page_idx >= max_pages:
                    break
                text = page.extract_text()
                if not text:
                    continue
                lines = text.split("\n")
                date_keywords = ["invoice date", "date:", "issued:", "date issued", "invoice date:", "date of invoice"]
                date_patterns = [
                    r"\d{1,2}[/-]\d{1,2}[/-]\d{2,4}",
                    r"\d{4}[/-]\d{1,2}[/-]\d{1,2}",
                    r"\d{1,2}\.\d{1,2}\.\d{2,4}",
                    r"\d{1,2}\s+(?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\s+\d{2,4}",
                ]
                for i, line in enumerate(lines):
                    line_lower = line.lower().strip()
                    if any(kw in line_lower for kw in date_keywords):
                        for kw in date_keywords:
                            if kw in line_lower:
                                kw_pos = line_lower.find(kw)
                                after_kw = line[kw_pos + len(kw):].strip()
                                for pattern in date_patterns:
                                    matches = re.findall(pattern, after_kw, re.IGNORECASE)
                                    if matches:
                                        parsed = parse_date_str(matches[0])
                                        if parsed:
                                            return parsed
                        for j in range(i + 1, min(i + 4, len(lines))):
                            for pattern in date_patterns:
                                matches = re.findall(pattern, lines[j], re.IGNORECASE)
                                if matches:
                                    parsed = parse_date_str(matches[0])
                                    if parsed:
                                        return parsed
                for line in lines[:50]:
                    for pattern in date_patterns:
                        matches = re.findall(pattern, line)
                        if matches:
                            parsed = parse_date_str(matches[0])
                            if parsed:
                                return parsed
    except Exception:
        pass
    return None


def _extract_ocr_tokens_from_pdf(contents: bytes, max_pages: int | None = None) -> list[dict]:
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
                parsed = parse_date_str(matches[0])
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


def extract_pdf_line_items_from_text(contents: bytes, max_pages: int | None = None) -> pd.DataFrame:
    customer_name = extract_customer_name_from_pdf(contents, max_pages=max_pages)
    invoice_date = extract_invoice_date_from_pdf(contents, max_pages=max_pages)

    line_items: list[dict[str, str]] = []
    in_line_items_section = False

    qty_rate_amount_re = re.compile(
        r"(\d+(?:\.\d+)?)\s*\+\s*\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)"
    )
    footer_markers = (
        "challan no",
        "gross amount",
        "no of items",
        "net amt",
        "all subject to",
        "for new",
        "[rupees",
        "add cgst",
        "add sgst",
        "continued from",
        "less discount",
        "round off",
    )
    summary_markers = ("total b/f", "total bf", "total b / f", "subtotal", "grand total")

    try:
        with pdfplumber.open(io.BytesIO(contents)) as pdf:
            for page_idx, page in enumerate(pdf.pages):
                if max_pages is not None and page_idx >= max_pages:
                    break

                text = page.extract_text() or ""
                if not text.strip():
                    continue

                for raw_line in text.split("\n"):
                    line = re.sub(r"\s+", " ", raw_line).strip()
                    if not line:
                        continue
                    lower = line.lower()

                    if "particulars" in lower and "qty" in lower and "rate" in lower and "amount" in lower:
                        in_line_items_section = True
                        continue

                    if not in_line_items_section:
                        continue

                    if any(marker in lower for marker in footer_markers):
                        in_line_items_section = False
                        continue
                    if any(marker in lower for marker in summary_markers):
                        continue

                    match = qty_rate_amount_re.search(line)
                    if not match:
                        continue

                    qty, rate, amount = match.groups()
                    left_segment = line[:match.start()].strip(" -:;,.")
                    if not left_segment:
                        continue

                    hsn_match = re.search(r"\b\d{6,8}\b", left_segment)
                    if hsn_match and hsn_match.start() > 2:
                        description = left_segment[:hsn_match.start()].strip(" -:;,.#")
                    else:
                        description = left_segment

                    description = re.sub(r"\s+", " ", description).strip()
                    if not description or description.lower() in {"continued", "particulars"}:
                        continue

                    line_items.append(
                        {
                            "Description": description,
                            "Qty": qty,
                            "Rate": rate,
                            "Amount": amount,
                        }
                    )
    except Exception:
        return pd.DataFrame()

    if not line_items:
        return pd.DataFrame()

    df = pd.DataFrame(line_items)
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
    all_tables = []
    customer_name = None
    invoice_date = None
    saw_text_layer = False

    line_item_keywords = {
        "description", "item", "item name", "product", "service",
        "qty", "quantity", "unit price", "price", "rate", "amount", "line total", "total",
        "sn", "sno", "sr no", "hsn", "batch",
    }
    metadata_keywords = {
        "invoice no", "invoice number", "invoice date", "subtotal", "tax", "amount due", "due date"
    }

    def _split_lines(cell: object) -> list[str]:
        if cell is None:
            return [""]
        text = str(cell).replace("\r", "\n")
        parts = [part.strip() for part in text.split("\n")]
        return parts if parts else [""]

    def _header_score(row: list[object]) -> int:
        joined = " ".join(str(c or "").strip().lower() for c in row)
        if not joined:
            return 0
        return sum(1 for kw in line_item_keywords if kw in joined)

    def _normalize_header(raw: object, idx: int) -> str:
        val = str(raw or "").strip()
        if not val:
            return f"col_{idx+1}"
        lower = val.lower()
        if lower in {"sn.", "sn", "sr", "sno", "s.no"}:
            return "Sn"
        if "item" in lower and "name" in lower:
            return "Item Name"
        if "qty" in lower or "quantity" in lower:
            return "Qty"
        if "line" in lower and "total" in lower:
            return "Line total"
        if "unit" in lower and "price" in lower:
            return "Unit price"
        if lower == "rate":
            return "Rate"
        if lower == "amount":
            return "Amount"
        return val

    def _expand_multiline_rows(df_page: pd.DataFrame) -> pd.DataFrame:
        expanded_rows: list[dict] = []
        for _, row in df_page.iterrows():
            cells = {col: _split_lines(row.get(col, "")) for col in df_page.columns}
            max_lines = max(len(lines) for lines in cells.values()) if cells else 1
            multiline_cols = sum(1 for lines in cells.values() if len(lines) > 1)
            if max_lines <= 1 or multiline_cols <= 1:
                expanded_rows.append({col: str(row.get(col, "") or "").strip() for col in df_page.columns})
                continue
            for i in range(max_lines):
                expanded_rows.append(
                    {
                        col: (cells[col][i] if i < len(cells[col]) else "").strip()
                        for col in df_page.columns
                    }
                )
        return pd.DataFrame(expanded_rows, columns=df_page.columns) if expanded_rows else df_page

    try:
        with pdfplumber.open(io.BytesIO(contents)) as pdf:
            customer_name = extract_customer_name_from_pdf(contents, max_pages=max_pages)
            invoice_date = extract_invoice_date_from_pdf(contents, max_pages=max_pages)

            for page_idx, page in enumerate(pdf.pages):
                if max_pages is not None and page_idx >= max_pages:
                    break
                page_text = (page.extract_text() or "").strip()
                if page_text:
                    saw_text_layer = True

                tables = []
                for settings in (
                    None,
                    {
                        "vertical_strategy": "text",
                        "horizontal_strategy": "text",
                        "snap_tolerance": 3,
                        "join_tolerance": 3,
                    },
                ):
                    try:
                        extracted = page.extract_tables(table_settings=settings) if settings else page.extract_tables()
                    except Exception:
                        extracted = []
                    if extracted:
                        tables.extend(extracted)

                if not tables:
                    continue

                for table in tables:
                    if not table or len(table) < 2:
                        continue

                    header_row_idx = max(
                        range(min(12, len(table))),
                        key=lambda idx: _header_score(table[idx] or []),
                    )
                    score = _header_score(table[header_row_idx] or [])
                    if score < 2:
                        continue

                    header_joined = " ".join(str(c or "").strip().lower() for c in table[header_row_idx])
                    if any(meta in header_joined for meta in metadata_keywords) and not any(
                        item in header_joined for item in ("item", "qty", "quantity", "amount", "rate")
                    ):
                        continue

                    header_row = table[header_row_idx]
                    normalized_headers = [_normalize_header(cell, i) for i, cell in enumerate(header_row)]
                    data_rows = table[header_row_idx + 1:]
                    if not data_rows:
                        continue

                    df_page = pd.DataFrame(data_rows, columns=normalized_headers).fillna("")
                    df_page = _expand_multiline_rows(df_page)
                    if df_page.empty:
                        continue
                    all_tables.append(df_page)

    except Exception as e:
        raise ValueError(f"Could not read PDF file. {e}")

    if not all_tables:
        if saw_text_layer:
            text_fallback_df = extract_pdf_line_items_from_text(contents, max_pages=max_pages)
            if not text_fallback_df.empty:
                return text_fallback_df
            raise ValueError(
                "This PDF has text, but no line-item table could be detected. "
                "Please upload a version with clear line-item columns "
                "(e.g., Description, Qty, Unit Price, Line Total)."
            )
        if enable_ocr_fallback and ALLOW_SCANNED_PDFS:
            return extract_pdf_tables_via_ocr(contents, max_pages=max_pages)
        raise ValueError(
            "Scanned/image PDFs are not supported yet. Please upload a text-based PDF."
        )

    df = pd.concat(all_tables, ignore_index=True)
    df = df.fillna("")
    df = df.astype(str)
    df.columns = [str(col).strip() for col in df.columns]

    def normalize_column_name(col_name: str) -> str:
        col_lower = col_name.lower().strip()
        if not col_name:
            return ""
        if "qty" in col_lower and ("#" in col_name or col_name[0].isdigit()):
            return "Qty"
        if "unit" in col_lower and "price" in col_lower:
            return "Unit price"
        if "line" in col_lower and "total" in col_lower:
            return "Line total"
        if col_name.strip() == "#" or col_name.strip().isdigit():
            return "#"
        return col_name.strip()

    df.columns = [normalize_column_name(col) for col in df.columns]

    summary_terms = ("total b/f", "subtotal", "grand total", "class total", "amount due", "deal:")
    lower_df = df.astype(str).apply(lambda s: s.str.lower())
    summary_mask = lower_df.apply(
        lambda row: any(any(term in cell for term in summary_terms) for cell in row),
        axis=1,
    )
    if summary_mask.any():
        df = df.loc[~summary_mask].copy()

    def _is_blank(v) -> bool:
        if v is None:
            return True
        if isinstance(v, float) and math.isnan(v):
            return True
        return str(v).strip() == ""

    def _looks_like_continuation_row(row: pd.Series, numeric_cols: list[str], text_cols: list[str]) -> bool:
        has_text = any(not _is_blank(row.get(c, "")) for c in text_cols)
        has_numeric = any(not _is_blank(row.get(c, "")) for c in numeric_cols)
        return has_text and not has_numeric

    description_like_cols = [
        c for c in df.columns
        if any(k in c.lower() for k in ("description", "item", "product", "service"))
    ]
    numeric_like_cols = [
        c for c in df.columns
        if any(k in c.lower() for k in ("qty", "quantity", "unit price", "line total", "amount", "#"))
    ]
    if description_like_cols:
        merged_rows: list[dict] = []
        for _, row in df.iterrows():
            if all(_is_blank(v) for v in row.values):
                continue

            if merged_rows and _looks_like_continuation_row(row, numeric_like_cols, description_like_cols):
                for col in description_like_cols:
                    value = str(row.get(col, "")).strip()
                    if value:
                        prev = str(merged_rows[-1].get(col, "")).strip()
                        merged_rows[-1][col] = f"{prev} {value}".strip() if prev else value
                continue

            merged_rows.append(row.to_dict())

        if merged_rows:
            df = pd.DataFrame(merged_rows, columns=df.columns)

    df = df.map(lambda v: '' if isinstance(v, str) and v.strip().lower() in ('nan', 'none', 'null', '') else (v.strip() if isinstance(v, str) else v))

    if customer_name:
        df['_extracted_customer_name'] = customer_name

    if invoice_date:
        df['_extracted_invoice_date'] = invoice_date

    return df
