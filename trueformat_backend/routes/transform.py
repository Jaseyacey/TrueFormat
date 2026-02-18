import io
import json
import math

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile

from trueformat_backend.auth import get_current_user
from trueformat_backend.transformation import apply_transformation, suggest_mapping_for_upload

router = APIRouter()


@router.post("/upload")
async def upload_file(file: UploadFile = File(...), current_user: str = Depends(get_current_user)):
    try:
        return suggest_mapping_for_upload(file)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/transform")
async def transform_data(
    file: UploadFile = File(...),
    mapping: str = Form(...),
    current_user: str = Depends(get_current_user),
):
    try:
        user_map = json.loads(mapping)
        df = apply_transformation(file, user_map)

        preview_dict = df.to_dict(orient="records")
        preview_cleaned = [
            {k: (None if isinstance(v, float) and math.isnan(v) else v) for k, v in row.items()}
            for row in preview_dict
        ]

        return {
            "status": "success",
            "preview": preview_cleaned,
            "null_count": df.isnull().sum().to_dict(),
            "row_count": len(df),
        }
    except Exception as e:
        return {"status": "error", "message": f"Transformation failed: {str(e)}"}


@router.post("/export-csv")
async def export_csv(
    file: UploadFile = File(...),
    mapping: str = Form(...),
    current_user: str = Depends(get_current_user),
):
    try:
        user_map = json.loads(mapping)
        df = apply_transformation(file, user_map)

        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)

        return Response(
            content=csv_buffer.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="trueformat-export.csv"'},
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Export failed: {e}")
