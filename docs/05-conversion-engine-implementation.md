# ConfiCel Update 05 — Conversion Engine Implementation

## Branch
`05-conversion-engine` — created from the preserved `04-workspace-foundation` checkpoint. This branch is not the production branch.

## Implemented in this checkpoint
- Separate Python/FastAPI service under `backend/`.
- Supabase Auth token verification for conversion and export requests.
- PDF, JPG and PNG validation; 10 MB file cap; five-page PDF cap; file-signature checks.
- Embedded PDF text extraction, Tesseract OCR fallback for scanned PDF pages and image OCR.
- Conservative invoice and cheque draft response models that require user review.
- Real XLSX export from supplied reviewed fields and optional line items.
- No persistent upload storage in this foundation; temporary data is handled in memory.
- Dockerfile for a separately hosted API service and environment-variable example.

## Not yet complete / release blockers
- The existing Cloudflare Pages workspace is not yet wired to this API; frontend still shows demo/sample content.
- No Supabase credit ledger or transactional token deduction/refund has been implemented. This branch explicitly charges zero credits.
- Cheque fields are not yet reliably extracted; they are returned blank for manual review, with date/header candidates only.
- No end-to-end browser/API test, OCR accuracy benchmark, production hosting, monitoring, or abuse-rate limiting has been completed.
- Do not upload real confidential invoices or cheques to the demo. Do not treat OCR output as verified payment data.

## Before connecting the frontend
1. Deploy `backend/` to a managed Python runtime and configure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and exact `ALLOWED_ORIGINS`.
2. Confirm `/health` and test with synthetic invoice/cheque fixtures.
3. Add server-side per-user token ledger in Supabase with atomic deduction only after successful conversion; failed processing must not charge a token.
4. Connect frontend sign-in session to the API with a Bearer token, render editable extracted fields and line items, and submit reviewed values to `/api/export.xlsx`.
5. Add automated security, file-validation, and accuracy tests before any public release.

## Build token
`CONFICEL-05-API-FOUNDATION-7K4M`
