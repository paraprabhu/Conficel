# ConfiCel API — Update 05

This is a separately hosted Python API for authenticated OCR draft extraction and XLSX generation. Cloudflare Pages serves the static frontend; it does not run this Python service.

## Current capabilities
- Authenticates each request against Supabase Auth using the supplied Bearer access token.
- Accepts PDF, JPG, and PNG, with a 10 MB cap and maximum five PDF pages.
- Extracts embedded PDF text first and uses Tesseract OCR for scanned pages/images.
- Returns an editable-review draft with raw OCR text and conservative candidate fields.
- Creates real XLSX files from the reviewed fields/line items.
- Does not persist uploads; processes them in memory and returns no raw OCR content in server logs by design.

## Run locally
1. Install Python 3.12 and Tesseract OCR (English language pack).
2. Copy `.env.example` to `.env` and set the Supabase project URL and anon key as environment variables. Do not commit real credentials.
3. `pip install -r requirements.txt`
4. `uvicorn main:app --reload --port 8000`
5. Health check: `http://127.0.0.1:8000/health`; interactive API docs: `/docs`.

## Important limitations
- This is an integration foundation, not production-ready financial document processing.
- The frontend still needs to send the user's Supabase access token to this API and render the returned draft; set `CONFIcel_API_URL`/equivalent in the frontend when integrating.
- The server-side credit ledger and deduction-after-success transaction are intentionally not enabled yet. The endpoint reports `credits_charged: 0`; do not advertise paid tokens as active.
- OCR field extraction is heuristic and must be reviewed. Cheque number, payee, amount, and MICR are not reliably parsed yet.
- Before public launch, add a server-side quota/credit ledger, rate limiting, malware scanning, observability without document content, retention policy, automated tests, and a separate managed runtime. Use only synthetic/test documents until that work is complete.
