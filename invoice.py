from fastapi import FastAPI, Response
from fastapi.responses import FileResponse
from reportlab.pdfgen import canvas  # type: ignore[import]
from reportlab.lib.pagesizes import letter  # type: ignore[import]
import io
import os

app = FastAPI()

@app.get("/download-test-report")
async def download_report():
    # 1. Create a file-like buffer for the PDF
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    
    # 2. Draw Content (The "Success" Report)
    p.setFont("Helvetica-Bold", 16)
    p.drawString(100, 750, "MapPoint.AI - Validation Report")
    
    p.setFont("Helvetica", 12)
    p.drawString(100, 720, "Status: Data Mapping Verified")
    p.drawString(100, 700, "Rows Processed: 1,250")
    p.drawString(100, 680, "Integrity Check: PASSED (No 15-digit rounding detected)")
    
    # Simple table-like structure for mapping info
    p.line(100, 660, 500, 660)
    p.drawString(100, 640, "Field: transaction_id  -> Source: cust_no_01")
    p.drawString(100, 620, "Field: amount          -> Source: amt_USD")
    p.line(100, 610, 500, 610)
    
    p.showPage()
    p.save()
    
    # 3. Prepare the buffer for reading
    buffer.seek(0)
    
    # 4. Return as a downloadable file
    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": "attachment; filename=MapPoint_Validation_Report.pdf"
        }
    )