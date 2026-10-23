# Update 06 — deployment and end-to-end verification

Build token: `CONFICEL-06-DEPLOYMENT-READY-CHECKLIST-8V4J`

This is an operator checklist, not a claim that external services have been configured. No credentials or provider account access are included in the repository, so service setup must be completed in the owner's dashboards.

## A. Supabase

1. Open the Supabase project intended for ConfiCel. If no project exists, create one dedicated to ConfiCel.
2. In Project Settings / API, copy the project URL and the public anon/publishable key.
3. In Authentication settings, enable email/password sign-in and choose whether email verification is required.
4. Configure the deployed frontend URL in the allowed site URL and redirect URL settings.
5. Do not use the service-role key in `config.js`, HTML, or any browser-visible file.
6. Confirm a test account can sign in and sign out from the workspace.

## B. Host the API

The API uses Python 3.12, FastAPI, PyMuPDF, Tesseract OCR, Pillow, openpyxl, and Supabase Python SDK. The repository includes `backend/Dockerfile`.

1. Choose a managed service that can build and run the Dockerfile and supports HTTPS.
2. Configure the build context as the repository root and Dockerfile path as `backend/Dockerfile` (or deploy from `backend/` with its Dockerfile, as the provider supports).
3. Set server-side environment variables:
   - `SUPABASE_URL`: same Supabase project URL as the frontend.
   - `SUPABASE_ANON_KEY`: public anon/publishable key used for token validation.
   - `ALLOWED_ORIGINS`: exact HTTPS origin of the deployed ConfiCel frontend. Do not include broad wildcards.
   - `PORT`: only if required by the host; the Dockerfile defaults to 8000.
4. Deploy and open `https://YOUR_API_HOST/health`. Expect JSON with `ok: true`.
5. Keep the API URL and secrets out of git history. Do not enable real-document usage yet.

## C. Configure the static frontend

1. In `config.js`, set `supabaseUrl`, `supabaseAnonKey`, and `apiBaseUrl` (API origin only; no trailing slash).
2. Keep the Supabase key public anon/publishable only. Never paste a service-role key.
3. Deploy the `06-workspace-integration` branch to a **preview**, not production.
4. Confirm the preview origin exactly matches one entry in the API's `ALLOWED_ORIGINS`.
5. Keep the production branch and approved homepage unchanged until preview tests pass.

## D. Browser end-to-end test matrix

Use synthetic documents only. Do not use real customer invoices, bank statements, or cheques.

| Test | Expected outcome |
|---|---|
| Workspace opens with empty config | Clear setup message; no conversion request is sent |
| Valid test account sign-in | Account status shows signed in |
| Invalid password | Helpful error; page remains usable |
| Sign-out then convert | Conversion is blocked and sign-in is requested |
| Text-based synthetic PDF | Draft fields and raw text appear for review |
| Scanned synthetic PDF | OCR draft appears if readable |
| Synthetic JPG and PNG | Draft appears if readable |
| Unsupported file type / over 10 MB | Rejected before upload |
| Corrupt PDF/image | Error message; page remains usable |
| Cheque mode | Cheque-specific draft and manual-review warning appear |
| Edit a field, export | XLSX downloads and contains the edited value |
| Expired/invalid session | API rejects request; user is asked to sign in again |
| API unavailable or CORS mismatch | Clear connection error; no false success |
| Clear result | Draft panel disappears from the page |
| Browser refresh | No document contents are intentionally persisted by workspace code |

## E. Release gates

Do not promote to production until all of these are true:

- GitHub Actions backend tests pass on the current integration branch.
- Preview tests above pass on desktop and mobile.
- API authentication and CORS are confirmed using the actual deployed origins.
- A privacy/retention review and abuse/rate limits are in place.
- Token ledger and atomic deduction-after-success are implemented and tested before any paid-token claims.
- OCR limitations are visible and users must review all fields.
- Cheque OCR is clearly not represented as cheque/payment validation.
- Owner explicitly approves production promotion.

## Current known limitations

- The API currently returns `credits_charged: 0`; no active token system exists.
- Invoice line items are not extracted automatically; export currently includes draft fields, not a populated invoice line-item table.
- Cheque number, payee, amount, and MICR/routing fields are not reliably extracted.
- This guide does not configure third-party services or verify a live deployment.
