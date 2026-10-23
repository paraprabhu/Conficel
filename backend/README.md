# ConfiCel API — Update 05

This is a separately hosted Python API for authenticated OCR draft extraction and XLSX generation. Cloudflare Pages serves the static frontend; it does not run this Python service.

## Current capabilities
- Authenticates each request against Supabase Auth using the supplied Bearer access token.
- Accepts PDF, JPG, and PNG, with a 10 MB cap and maximum five PDF pages.
- Extracts embedded PDF text first and uses Tesseract OCR for scanned pages/images.
- Returns a draft that must be reviewed by the user.
- Creates XLSX files from reviewed fields and optional line items.
- Does not persist uploads; files are processed in memory. Do not log OCR content.

## Run locally
1. Install Python 3.12 and Tesseract OCR (English language pack).
2. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` as environment variables. Never commit real credentials.
3. From the `backend/` directory, install dependencies: `pip install -r requirements.txt`.
4. Run: `uvicorn main:app --reload --port 8000`.
5. Health check: `http://127.0.0.1:8000/health`; interactive API docs: `/docs`.

## Run automated tests
From `backend/`:
```bash
pip install -r requirements-dev.txt
pytest -q
```
GitHub Actions runs the test suite for commits and pull requests on the configured checkpoint branches. A green workflow must be observed before claiming the tests pass.

## Important limitations
- This is an integration foundation, not production-ready financial document processing.
- The static workspace is not connected to this API and has no sign-in integration yet.
- The server-side credit ledger and deduction-after-success transaction are not enabled. The endpoint reports `credits_charged: 0`; do not advertise paid tokens as active.
- OCR field extraction is heuristic and must be reviewed. Cheque number, payee, amount, and MICR are not reliably parsed yet.
- Before public launch, implement a server-side quota/credit ledger with atomic transactions, rate limiting, abuse controls, a retention policy, privacy-safe monitoring, and a separate managed runtime. Use only synthetic/test documents until then.
