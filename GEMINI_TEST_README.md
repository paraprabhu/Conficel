# ConfiCel Gemini extraction test (Build 02)

This is an isolated proof of concept. It does **not** replace the existing `app.js` extraction flow, and it must not be merged into the production branch until testing is complete.

## Files added

- `gemini-test.html` — standalone test page for sample invoices and cheques.
- `functions/api/gemini-parse.js` — Cloudflare Pages Function that calls Gemini with a server-side secret.

## Configure a Cloudflare Pages preview

1. Open the ConfiCel project in Cloudflare Pages.
2. Add the secret `GEMINI_API_KEY` under **Settings → Variables and Secrets** for the **Preview** environment. Do not put the key in HTML, JavaScript, GitHub, or a public config file.
3. Optional: set `GEMINI_MODEL` as a Preview environment variable. The default in this test is `gemini-2.5-flash`; verify model availability in the Google AI Studio project before testing.
4. Ensure the branch `02-gemini-extraction-test` gets a Pages preview deployment. If preview deployments are disabled, enable them for this branch or deploy the branch using the project's existing Cloudflare workflow.
5. Open the preview URL ending in `/gemini-test.html`.

The API key is sent to Google only from the server function. The test page sends the selected file to the ConfiCel endpoint. Test with non-sensitive sample documents only.

## Test checklist

- Generic invoice template: verify invoice number/date, subtotal, tax, total and terms.
- Indian GST invoice / EMCULE proforma: verify supplier vs buyer, GSTINs, HSN/SAC, quantities, rates, line amounts, tax split and final total.
- Multi-line invoice: confirm all line items are returned.
- Cheque: verify number, date, payee, amount in figures and words. Do not trust uncertain digits.
- Missing fields: ensure the model leaves them blank instead of inventing values.
- Errors: test missing secret, unsupported file type, file over 10 MB and quota/rate-limit responses.

## Safety / limitations

- Results are best-effort and must be reviewed by a human.
- This endpoint currently has no authentication, per-user quota, rate limiting, or usage billing. Do not expose it to public users as a production feature.
- Do not process real customer financial documents until data handling, retention, access controls, Google API terms, and production security have been reviewed.
- The test accepts PDF/JPEG/PNG/WEBP files up to 10 MB.
- The previous code remains available on `01-initial-website`. This branch is disposable and can be deleted without changing that branch.
