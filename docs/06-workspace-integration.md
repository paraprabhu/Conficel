# Update 06 — Workspace integration

Build token: `CONFICEL-06-WORKSPACE-INTEGRATION-6R2Q`

## What changed

- `workspace.html` now includes Supabase email/password sign-in and sign-up controls.
- The selected PDF/JPG/PNG is sent to `POST /api/convert?mode=invoice` or `mode=cheque` with the Supabase access token.
- OCR draft fields are rendered as editable controls; the user can submit the reviewed fields to `POST /api/export.xlsx` and download the workbook.
- Error/status messages and session checks are included.
- `config.js` contains empty values only. `config.example.js` documents the expected browser configuration shape.
- The homepage `index.html` and its visual design were not changed.

## Configure before testing

1. Configure Supabase Auth for the same project whose URL and public anon/publishable key will be used by the frontend and API.
2. Set `supabaseUrl` and `supabaseAnonKey` in `config.js`. Never use a service-role key in browser code.
3. Deploy the Python API from `backend/` to a separate managed Python runtime with HTTPS.
4. Set `apiBaseUrl` in `config.js` to that API origin, without a trailing slash.
5. Set API environment variables `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `ALLOWED_ORIGINS`. The origin allowlist must include the intended ConfiCel workspace origin only.
6. Verify the API `/health` endpoint, sign in, and test both conversion modes and XLSX export using synthetic documents only.

## Safety and limitations

- This is an integration implementation, not proof of a live, configured service. Blank configuration prevents conversion until an API and Supabase project are configured.
- The API does not yet implement token balances or deductions. UI token cards explicitly say they are not connected.
- OCR is heuristic; all fields require review. Cheque OCR must not be used as payment validation.
- Files are sent to the configured API for processing. Do not use real confidential documents until deployment, privacy controls, retention, and security have been reviewed.
- No production branch was changed and no deployment is claimed.
- Before launch, run the automated backend tests and complete end-to-end browser tests for valid/invalid sessions, each file type, oversized/corrupt files, OCR failures, API outages, and export failures.
