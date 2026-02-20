from __future__ import annotations

import io
import re

import pandas as pd
from fastapi import UploadFile

from .pdf_processing import extract_pdf_tables
from .schemas import TARGET_SCHEMA
from .settings import UPLOAD_PAGE_LIMIT


HEADER_CANONICAL = {
    "sku": "SKU",
    "partnumber": "SKU",
    "partno": "SKU",
    "partnum": "SKU",
    "part": "SKU",
    "partcode": "SKU",
    "itemcode": "SKU",
    "item": "SKU",
    "description": "Description",
    "details": "Description",
    "product": "Description",
    "batchno": "Batch_No",
    "batchnumber": "Batch_No",
    "batch": "Batch_No",
    "expdate": "Exp_Date",
    "expirydate": "Exp_Date",
    "expiry": "Exp_Date",
    "qty": "Qty",
    "quantity": "Qty",
    "unitprice": "Unit_Price",
    "unitcost": "Unit_Price",
    "cost": "Unit_Price",
    "unitrate": "Unit_Price",
    "price": "Unit_Price",
    "linetotal": "Line_Total",
    "total": "Line_Total",
    "amount": "Line_Total",
}

LINE_ITEM_REQUIRED_HEADERS = {"SKU", "Description", "Qty", "Line_Total"}
LINE_ITEM_STOP_PREFIXES = ("SUBTOTAL:", "VAT", "INVOICE TOTAL:")


def _normalize_header_token(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value).strip().lower())


def _is_empty_row(row: list[str]) -> bool:
    return all(not str(cell).strip() for cell in row)


def _extract_metadata(rows: list[list[str]]) -> tuple[str | None, str | None]:
    invoice_date = None
    supplier_name = None

    for row in rows:
        first = str(row[0]).strip().lower() if row else ""
        second = str(row[1]).strip() if len(row) > 1 else ""
        if not second:
            continue
        if first.startswith("date:") and not invoice_date:
            invoice_date = second
        elif first.startswith("supplier:") and not supplier_name:
            supplier_name = second

    return invoice_date, supplier_name


def _find_line_item_header_map(row: list[str]) -> dict[int, str] | None:
    mapping: dict[int, str] = {}
    for idx, cell in enumerate(row):
        canonical = HEADER_CANONICAL.get(_normalize_header_token(cell))
        if canonical:
            mapping[idx] = canonical

    headers_found = set(mapping.values())
    if not LINE_ITEM_REQUIRED_HEADERS.issubset(headers_found):
        return None
    return mapping


def _extract_csv_like_line_items(raw_df: pd.DataFrame) -> pd.DataFrame | None:
    rows = raw_df.fillna("").astype(str).values.tolist()
    invoice_date, supplier_name = _extract_metadata(rows)
    records: list[dict[str, str | None]] = []

    active_header_map: dict[int, str] | None = None
    for row in rows:
        stripped_first = str(row[0]).strip() if row else ""
        first_upper = stripped_first.upper()

        header_map = _find_line_item_header_map(row)
        if header_map:
            active_header_map = header_map
            continue

        if active_header_map is None:
            continue

        if _is_empty_row(row):
            continue

        if stripped_first.startswith("--- PAGE"):
            continue

        if any(first_upper.startswith(prefix) for prefix in LINE_ITEM_STOP_PREFIXES):
            continue

        record: dict[str, str | None] = {}
        has_value = False
        for idx, canonical in active_header_map.items():
            value = str(row[idx]).strip() if idx < len(row) else ""
            record[canonical] = value
            if value:
                has_value = True

        if not has_value:
            continue

        if invoice_date:
            record["_extracted_invoice_date"] = invoice_date
        if supplier_name:
            record["_extracted_customer_name"] = supplier_name
        records.append(record)

    if not records:
        return None

    df = pd.DataFrame(records)
    for col in ("SKU", "Description", "Batch_No", "Exp_Date", "Qty", "Unit_Price", "Line_Total"):
        if col not in df.columns:
            df[col] = ""
    return df


def clean_and_load(
    file: UploadFile,
    max_pages: int | None = None,
    enable_ocr_fallback: bool = True,
) -> pd.DataFrame:
    contents = file.file.read()

    if file.filename.lower().endswith(".pdf"):
        return extract_pdf_tables(
            contents,
            max_pages=max_pages,
            enable_ocr_fallback=enable_ocr_fallback,
        )

    if file.filename.endswith(".xlsx"):
        raw_df = pd.read_excel(
            io.BytesIO(contents),
            dtype=str,
            header=None,
            keep_default_na=False,
        )
    else:
        raw_df = pd.read_csv(
            io.BytesIO(contents),
            dtype=str,
            header=None,
            keep_default_na=False,
            na_filter=False,
            engine="python",
        )

    parsed_df = _extract_csv_like_line_items(raw_df)
    if parsed_df is not None:
        df = parsed_df
    else:
        if file.filename.endswith(".xlsx"):
            df = pd.read_excel(io.BytesIO(contents), dtype=str, keep_default_na=False)
        else:
            df = pd.read_csv(io.BytesIO(contents), dtype=str, keep_default_na=False, na_filter=False, engine="python")

    df.columns = [str(col).strip() for col in df.columns]
    df = df.map(lambda v: v.strip() if isinstance(v, str) else v)
    return df


def suggest_mapping_for_upload(file: UploadFile) -> dict:
    df = clean_and_load(
        file,
        max_pages=UPLOAD_PAGE_LIMIT,
        enable_ocr_fallback=False,
    )
    source_columns = list(df.columns)

    mapping: dict[str, str] = {}
    for target in TARGET_SCHEMA:
        if target == "customer_name" and "_extracted_customer_name" in source_columns:
            mapping[target] = "_extracted_customer_name"
        elif target == "date" and "_extracted_invoice_date" in source_columns:
            mapping[target] = "_extracted_invoice_date"
        elif target == "date":
            date_col = next(
                (
                    s for s in source_columns
                    if s.strip().lower() in ("date", "invoice_date", "invoice date", "document date")
                ),
                None,
            )
            if date_col:
                mapping[target] = date_col
            else:
                for source in source_columns:
                    if source.startswith("_extracted_"):
                        continue
                    sl = source.lower().strip().replace("_", " ")
                    if "date" in sl and "update" not in sl and "candidate" not in sl:
                        mapping[target] = source
                        break
        elif target == "description":
            desc_col = next(
                (
                    s for s in source_columns
                    if s.strip().lower() in ("description", "item", "product", "service", "details")
                ),
                None,
            )
            if desc_col:
                mapping[target] = desc_col
            else:
                for source in source_columns:
                    if source.startswith("_extracted_"):
                        continue
                    sl = source.lower().strip()
                    if any(k in sl for k in ("description", "item", "product", "service", "details")):
                        mapping[target] = source
                        break
        elif target == "transaction_id":
            id_col = next(
                (
                    s for s in source_columns
                    if s.strip().lower() in (
                        "sku",
                        "part number",
                        "part_number",
                        "part no",
                        "part_no",
                        "item code",
                        "item_code",
                        "product code",
                        "product_code",
                        "code",
                    )
                ),
                None,
            )
            if id_col:
                mapping[target] = id_col
            else:
                for source in source_columns:
                    if source.startswith("_extracted_"):
                        continue
                    sl = source.lower().strip()
                    sl_norm = sl.replace("_", " ")
                    if any(k in sl_norm for k in ("sku", "part number", "part no", "item code", "product code", "transaction", "code")):
                        mapping[target] = source
                        break
        elif target == "quantity":
            qty_col = next((s for s in source_columns if s.strip().lower() in ("qty", "quantity")), None)
            if qty_col:
                mapping[target] = qty_col
            else:
                for source in source_columns:
                    if source.startswith("_extracted_"):
                        continue
                    sl = source.lower().strip()
                    if "qty" in sl or "quantity" in sl:
                        mapping[target] = source
                        break
        elif target == "line_total":
            line_total_col = next((s for s in source_columns if s.strip().lower() == "line total"), None)
            if line_total_col:
                mapping[target] = line_total_col
            else:
                for source in source_columns:
                    if source.startswith("_extracted_"):
                        continue
                    sl = source.lower()
                    sl_norm = sl.replace("_", " ")
                    if (
                        "line total" in sl_norm
                        or ("total" in sl_norm and "sub" not in sl_norm)
                        or sl_norm.strip() in ("amount", "net amount", "value")
                    ):
                        mapping[target] = source
                        break
        elif target == "amount":
            amount_col = next((s for s in source_columns if s.strip().lower() in ("unit price", "unit cost", "rate", "price", "unit rate")), None)
            if amount_col:
                mapping[target] = amount_col
            else:
                for source in source_columns:
                    if source.startswith("_extracted_"):
                        continue
                    sl = source.lower()
                    sl_norm = sl.replace("_", " ")
                    if (
                        "unit price" in sl_norm
                        or "unit cost" in sl_norm
                        or sl_norm.strip() in ("rate", "price", "unit rate")
                        or ("rate" in sl_norm and "gst" not in sl_norm)
                    ):
                        mapping[target] = source
                        break
        else:
            for source in source_columns:
                if source.startswith("_extracted_"):
                    continue
                if target.lower() in source.lower() or source.lower() in target.lower():
                    mapping[target] = source
                    break

    return {
        "sourceColumns": source_columns,
        "targetFields": TARGET_SCHEMA,
        "suggestedMapping": mapping,
    }


def apply_transformation(file: UploadFile, mapping: dict) -> pd.DataFrame:
    df = clean_and_load(file)

    valid_mapping = {target: source for target, source in mapping.items() if source and source in df.columns}

    def _is_extracted_col(col: str) -> bool:
        return str(col).startswith("_extracted_")

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

    if file.filename.lower().endswith(".pdf"):
        amount_src = valid_mapping.get("amount")
        line_total_src = valid_mapping.get("line_total")
        if amount_src and line_total_src and amount_src == line_total_src:
            better_total = _find_col_by_keywords(("line", "total")) or _find_col_by_keywords(("total",), ("sub", "due", "tax"))
            if not better_total:
                better_total = _find_col_by_keywords(("amount",), ("tax", "gst", "due", "payable"))
            if better_total and better_total != amount_src:
                valid_mapping["line_total"] = better_total

        if "line_total" not in valid_mapping:
            better_total = _find_col_by_keywords(("line", "total")) or _find_col_by_keywords(("total",), ("sub", "due", "tax"))
            if not better_total:
                better_total = _find_col_by_keywords(("amount",), ("tax", "gst", "due", "payable"))
            if better_total:
                valid_mapping["line_total"] = better_total

    final_df = pd.DataFrame()
    for target, source in valid_mapping.items():
        final_df[target] = df[source].copy()

    def _coerce_currency(series):
        cleaned = (
            series.astype(str)
            .str.replace(r"[£$€¥₹,%\s]", "", regex=True)
            .str.replace(r"[^0-9.\-]", "", regex=True)
        )
        return pd.to_numeric(cleaned, errors="coerce")

    def _coerce_quantity(series):
        cleaned = (
            series.astype(str)
            .str.strip()
            .replace({"": pd.NA, "nan": pd.NA, "None": pd.NA, "null": pd.NA})
            .str.replace("O", "0", regex=False)
            .str.replace("o", "0", regex=False)
            .str.replace("I", "1", regex=False)
            .str.replace("l", "1", regex=False)
            .str.replace(r"\s+", "", regex=True)
            .str.replace(r"[^0-9.\-]", "", regex=True)
        )
        return pd.to_numeric(cleaned, errors="coerce")

    if "quantity" in final_df.columns:
        final_df["quantity"] = _coerce_quantity(final_df["quantity"])
    if "amount" in final_df.columns:
        final_df["amount"] = _coerce_currency(final_df["amount"])
    if "line_total" in final_df.columns:
        final_df["line_total"] = _coerce_currency(final_df["line_total"])

    if {"quantity", "amount", "line_total"}.issubset(final_df.columns):
        mask = final_df["line_total"].isna() & final_df["quantity"].notna() & final_df["amount"].notna()
        final_df.loc[mask, "line_total"] = final_df.loc[mask, "quantity"] * final_df.loc[mask, "amount"]

    if {"quantity", "amount", "line_total"}.issubset(final_df.columns):
        mask = (
            final_df["amount"].isna()
            & final_df["quantity"].notna()
            & final_df["line_total"].notna()
            & (final_df["quantity"] != 0)
        )
        final_df.loc[mask, "amount"] = final_df.loc[mask, "line_total"] / final_df.loc[mask, "quantity"]

    if {"quantity", "amount", "line_total"}.issubset(final_df.columns):
        mask = (
            final_df["quantity"].isna()
            & final_df["line_total"].notna()
            & final_df["amount"].notna()
            & (final_df["amount"] != 0)
        )
        final_df.loc[mask, "quantity"] = final_df.loc[mask, "line_total"] / final_df.loc[mask, "amount"]
        final_df["quantity"] = final_df["quantity"].round(6)

    if {"quantity", "amount", "line_total"}.issubset(final_df.columns):
        mask = (
            final_df["quantity"].notna()
            & (final_df["quantity"] <= 0)
            & final_df["line_total"].notna()
            & final_df["amount"].notna()
            & (final_df["amount"] != 0)
        )
        final_df.loc[mask, "quantity"] = final_df.loc[mask, "line_total"] / final_df.loc[mask, "amount"]
        final_df["quantity"] = final_df["quantity"].round(6)

    if "amount" in final_df.columns and "line_total" in final_df.columns:
        mask = final_df["amount"].isna() & final_df["line_total"].notna()
        final_df.loc[mask, "amount"] = final_df.loc[mask, "line_total"]

    if "date" in final_df.columns:
        raw_date = final_df["date"].astype(str).str.strip()
        empty_mask = raw_date.str.lower().isin({"", "nan", "none", "null"})
        full_date_mask = (
            raw_date.str.match(r"^\d{4}-\d{1,2}-\d{1,2}$")
            | raw_date.str.match(r"^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$")
            | raw_date.str.match(r"^\d{1,2}-[A-Za-z]{3}-\d{2,4}$")
            | raw_date.str.match(r"^[A-Za-z]{3}-\d{1,2}-\d{2,4}$")
        )
        parsed = pd.to_datetime(raw_date.where(full_date_mask), errors="coerce", dayfirst=True)
        normalized = raw_date.copy()
        normalized.loc[full_date_mask & parsed.notna()] = parsed.dt.strftime("%Y-%m-%d")
        normalized.loc[empty_mask] = pd.NA
        final_df["date"] = normalized

    return final_df
