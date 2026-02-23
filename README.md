# TrueFormat
TrueFormat is an algorithm to extract line items from a PDF invoice to extract as a CSV

## Python Quick Start

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
