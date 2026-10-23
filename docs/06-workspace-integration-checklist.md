# Update 06 — Workspace/API integration

Build token: `CONFICEL-06-WORKSPACE-INTEGRATION-6R2Q`

## Scope

This checkpoint is the integration preparation branch. It must not be merged into the production branch until the end-to-end flow is tested.

## Verified starting point

- Update 05 contains the FastAPI conversion and XLSX endpoints.
- The static `workspace.html` is still a browser-only preview; its current submit handler checks file selection and does not call the API.
- The API requires a Supabase Auth access token and the API runtime requires `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
- A separate Python runtime is required; Cloudflare Pages only serves the static frontend.
- The current API returns draft OCR fields and does not deduct tokens.

## Integration sequence

1. Configure a Supabase project URL and public anon key for the browser client. Never put a Supabase service-role key in browser code or repository files.
2. Add a sign-in/sign-out state to the workspace and obtain the current session access token from Supabase Auth.
3. Configure the separately hosted API base URL through a non-secret frontend config file. Do not point the UI at an unverified production endpoint.
4. Connect the upload form to `POST /api/convert`, using `mode=invoice` for document extraction and `mode=cheque` for cheque extraction.
5. Render returned draft fields as editable controls. Clearly label raw OCR text and uncertain values; never present OCR output as verified financial data.
6. Send the user's reviewed fields to `POST /api/export.xlsx` and download the response as an XLSX file.
7. Add explicit loading, cancellation/error states, session-expiry handling, and accessible status announcements.
8. Run end-to-end tests with synthetic documents only, including unsupported file types, oversized files, invalid sessions, unreadable scans, API outages, and export failure.
9. Only after conversion and export are stable, implement a server-side credit ledger with atomic deduction after successful conversion/export policy is defined. Do not simulate balances in the browser.

## Release gates

- [ ] Supabase URL and anon key configured for the intended environment.
- [ ] API deployed to a managed Python runtime over HTTPS.
- [ ] API CORS allowlist contains only the intended frontend origin(s).
- [ ] Frontend authentication verified against the same Supabase project as the API.
- [ ] Invoice and cheque modes each return an editable draft.
- [ ] XLSX export opens correctly in Excel/LibreOffice.
- [ ] No raw OCR text or document contents appear in logs.
- [ ] No token is deducted on failed processing.
- [ ] Automated tests and end-to-end tests observed green.
- [ ] Production deployment explicitly approved.

## Current status

**Not yet integrated or deployed.** This checklist records the next implementation sequence and prevents the preview from being mistaken for a live financial-document service. Do not upload real confidential documents to preview environments.
