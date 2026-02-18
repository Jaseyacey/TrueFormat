from __future__ import annotations

import io

import pandas as pd
from fastapi import UploadFile

from .pdf_processing import extract_pdf_tables
from .schemas import TARGET_SCHEMA
from .settings import UPLOAD_PAGE_LIMIT


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
        df = pd.read_excel(io.BytesIO(contents), dtype=str)
    else:
        df = pd.read_csv(io.BytesIO(contents), dtype=str)

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
                    if (
                        "line total" in sl
                        or ("total" in sl and "sub" not in sl)
                        or sl.strip() in ("amount", "net amount", "value")
                    ):
                        mapping[target] = source
                        break
        elif target == "amount":
            amount_col = next((s for s in source_columns if s.strip().lower() in ("unit price", "rate", "price", "unit rate")), None)
            if amount_col:
                mapping[target] = amount_col
            else:
                for source in source_columns:
                    if source.startswith("_extracted_"):
                        continue
                    sl = source.lower()
                    if (
                        "unit price" in sl
                        or sl.strip() in ("rate", "price", "unit rate")
                        or ("rate" in sl and "gst" not in sl)
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
        final_df["date"] = pd.to_datetime(
            final_df["date"], errors="coerce", format="mixed", dayfirst=True
        ).dt.strftime("%Y-%m-%d")

    return final_df
