# ConfiCel API — conversion foundation

This is a separately hosted Python API for authenticated OCR draft extraction and XLSX generation. Cloudflare Pages serves the static frontend; it does not run this Python service.

## Current capabilities

- Authenticates requests against Supabase Auth using a Bearer access token.
- Accepts PDF, JPG, and PNG, with a 10 MB cap and maximum five PDF pages.
- Extracts embedded PDF text first and uses Tesseract OCR for scanned pages/images.
- Returns an editable draft for review.
- Creates XLSX files from reviewed fields.
- Processes files in memory; uploads are not intentionally persisted by this application.

## Workspace integration status

The `06-workspace-integration` branch contains a browser UI that calls `POST /api/convert` and `POST /api/export.xlsx`, with Supabase email/password authentication. The integration is configuration-driven but is **not yet verified end to end**. The checked-in `config.js` contains empty values. Do not claim that conversion is live until Supabase and API hosting are configured and browser tests pass.

## Run locally

1. Install Python 3.12 and Tesseract OCR (English language pack).
2. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `ALLOWED_ORIGINS` as environment variables.
3. From `backend/`, install dependencies: `pip install -r requirements.txt`.
4. Run: `uvicorn main:app --reload --port 8000`.
5. Health check: `http://127.0.0.1:8000/health`; interactive API docs: `/docs`.

## Automated tests

From `backend/`:
```bash
pip install -r requirements-dev.txt
pytest -q
```
GitHub Actions is configured to run the suite on the integration branch. Check the branch's Actions result before reporting tests as passed.

## Required deployment configuration

- Host the Python API from this directory on a managed Python/container runtime with HTTPS.
- Set server environment variables `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `ALLOWED_ORIGINS`; use the exact frontend origin(s) in the allowlist.
- Set `supabaseUrl`, `supabaseAnonKey` (public anon/publishable key only), and `apiBaseUrl` in the static site's `config.js`.
- Configure Supabase Auth email/password and allowed site/redirect URLs for the deployed frontend.
- Never put a Supabase service-role key in browser code or commit private credentials.

## Important limitations and release blockers

- The integration is not production-ready financial document processing.
- Token balances, atomic credit deduction, and paid plans are not implemented; API currently reports `credits_charged: 0`.
- OCR extraction is heuristic. Cheque number, payee, amount, and MICR are not reliably parsed; cheque OCR must never be treated as payment validation.
- Before public launch, implement server-side quota/credit accounting with atomic transactions, rate limiting, abuse controls, a retention policy, privacy-safe monitoring, and operational alerting.
- Use only synthetic/test documents until the deployment, security, and privacy posture have been reviewed.
