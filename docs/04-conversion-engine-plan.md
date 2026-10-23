# ConfiCel Update 04 — Conversion Engine Foundation

## Scope
This checkpoint is intentionally separate from production and from the approved homepage checkpoints.

## Processing flow
1. Browser accepts PDF, JPG, and PNG only; enforce file-size and page-count limits in both browser and server.
2. Authenticated user requests a conversion in either Document or Cheque mode.
3. Server verifies the user's Supabase JWT, ownership, mode, and remaining server-side token balance.
4. For PDFs, extract embedded text first; OCR scanned pages only when needed. For images/scans, use an OCR engine such as Tesseract or PaddleOCR.
5. Return a structured draft with confidence indicators. Users must be able to edit values before export.
6. Generate XLSX with openpyxl server-side; return a short-lived authorized download.
7. Deduct one token only after a successful conversion. Processing failures must not consume tokens.
8. Delete originals and intermediate artifacts automatically after a short retention period.

## Security requirements before public launch
- Do not process sensitive financial documents through a public unauthenticated endpoint.
- Verify Supabase access tokens server-side; never trust user IDs or token balances sent by the browser.
- Store files privately; use ownership checks and short-lived signed links.
- Never log OCR text, cheque details, or invoice contents.
- Apply MIME/signature validation, upload size limits, page limits, rate limits, and abuse controls.
- Do not put service-role keys or OCR/backend secrets in frontend code.
- Do not claim OCR is perfectly accurate; flag uncertain values and require review.

## Deployment separation
- Cloudflare Pages: static website and workspace UI.
- Separate Python API/worker: OCR and XLSX processing.
- Supabase: authentication, private metadata, and server-side token ledger.
- Keep this work on `04-workspace-foundation`; do not merge to `main` until tested and approved.

## Status
Planning/security foundation only. The real OCR endpoint, authenticated token ledger, and production Excel export are not yet connected. Do not upload confidential documents to the current demo UI.
