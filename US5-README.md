# US5 — UK multi-rate VAT invoice validation

Preview-only implementation on `us5-uk-invoice-validation`. Production branches are not changed.

## Acceptance criteria
- Preserve GBP currency and UK VAT terminology.
- Keep each of the four printed invoice rows separate.
- Capture line-level `netAmount`, `taxRate`, `taxAmount`, and `grossAmount`; keep legacy `amount` as gross for compatibility.
- Reconcile quantity × unit price to net, net + VAT to gross, and net/tax totals by VAT rate.
- Reconcile 20% VAT base £2,467.50 and VAT £493.50; 0% VAT base £12.50 and preserve the printed dash for VAT.
- Reconcile net total £2,480.00 + VAT £493.50 = total due £2,973.50.
- Keep instructional supplier placeholders out of supplier entity fields; preserve them as blank-valued documentFields and in rawText.
- Retain invoice references, invoice/due dates, customer reference, payment terms, and full source transcription.

## Test
Run `node --test tests/us5-uk-invoice-validation.test.cjs`.

The test fixture is a manually reviewed expected extraction for `invoice-template-uk.pdf`. It is a regression fixture, not a claim that a live OpenAI API call has been run. The live endpoint still requires the server-side `OPENAI_API_KEY` Preview secret.
