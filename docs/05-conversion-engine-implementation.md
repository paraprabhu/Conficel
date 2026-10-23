# ConfiCel Update 05 — Conversion Engine Implementation

## Branch
`05-conversion-engine`, created from the preserved `04-workspace-foundation` checkpoint. This is not the production branch. Earlier checkpoints remain unchanged.

## Implemented in this checkpoint
- Separate Python/FastAPI service under `backend/`.
- Supabase Auth token verification for conversion and export requests.
- PDF, JPG and PNG validation; 10 MB file cap; five-page PDF cap; file-signature checks.
- Embedded PDF text extraction, Tesseract OCR fallback for scanned PDF pages and image OCR.
- Draft extraction response that requires human review.
- XLSX export from submitted reviewed fields and optional line items.
- No persistent upload storage in the foundation.
- Dockerfile and environment-variable example for separate API hosting.
- Initial automated API tests for health, auth, input validation, draft response, and XLSX export.
- GitHub Actions workflow to run backend tests.

## Validation status
The test suite and workflow have been added to the repository, but they must execute successfully in GitHub Actions before the branch can be considered test-verified. The assistant has not independently run this code in the target hosting environment.

## Release blockers
- The existing Cloudflare Pages workspace is not wired to the API; it still uses browser-only demo checks.
- No Supabase credit ledger or transactional token deduction/refund exists. The API explicitly charges zero credits.
- Cheque number, payee, amount and MICR are not reliably extracted.
- No production hosting, browser end-to-end test, OCR accuracy benchmark, monitoring, or rate limiting is complete.
- Do not upload real confidential invoices or cheques to the demo. Do not treat OCR output as verified payment data.

## Next release sequence
1. Observe the automated test workflow and fix any failures.
2. Deploy `backend/` to a managed Python runtime and configure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and exact `ALLOWED_ORIGINS`.
3. Confirm `/health` and test with synthetic invoice/cheque fixtures.
4. Add a server-side per-user token ledger with atomic deduction only after successful conversion; failures must not charge a token.
5. Add frontend authentication, secure API calls, editable review fields/line items, and XLSX download.
6. Complete security, privacy, accessibility and OCR-accuracy checks before public release.

## Build token
`CONFICEL-06-BACKEND-TESTS-2P8N`
