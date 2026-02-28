# TrueFormat

TrueFormat is a Python-powered solution designed to extract structured data, such as line items, from PDF invoices and save them into machine-compatible formats like CSV.

## Key Features
- Extraction of line-item data (description, quantities, prices, amounts) from PDF invoices.
- Advanced mathematical models for data identification and table reconstruction.
- OCR capabilities for scanned invoices.
- Metadata extraction for fields such as the customer's name and invoice dates.

## Mathematical Algorithm Overview

The `TrueFormat` backend uses pattern matching and precise mathematical heuristics to parse table-like and scattered invoice data:
1. **Regular Expression-based Parsing**:
   - **Regex Patterns**: The algorithm leverages regex patterns to identify line items, quantities, rates, and amounts based on recurring patterns observed in invoices.
     ```
     (\d+(?:\.\d+)?)\s*\+\s*\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)
     ```
   - This ensures recognition of complex financial tabular layouts.

2. **Row and Column Mapping via Y-Axes**:
   - All rows and columns are arranged spatially using their pixel coordinates (`x`, `y`), making use of tolerance ranges for misaligned data.

3. **Header and Footer Identification**:
   - Keywords ("Qty", "Unit Price") versus footer signals ("Subtotal", "Summary") distinguish the actual line-item content.
   - Footer filtering stops template matching when detecting patterns for "continued…".

4. **Advanced Table Layouts**
   - Mathematical interpolation of missing or multi-row invoice values is normalized via pandas dataframes.

## API Functionalities

### API Endpoints

**Run Extraction (`/extract`)**
```
POST /api/extract

Payload:
    Invoice Doc -> PDF Upload
Response:
    JSON[{"Provenance","Metadata"}]
```

More detailed API documentation coming soon!