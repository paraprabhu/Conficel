# ConfiCel Extraction Benchmark (Preview only)

## Purpose
Measure field-level extraction accuracy, end-to-end success, validation quality, and cost before setting paid subscription limits.

## Safety and scope
- Preview branch only. Do not merge to Production without explicit approval.
- Use public sample documents, synthetic documents, or appropriately redacted documents.
- Do not put API keys or customer financial data in this repository.
- The benchmark has 20 documents: 5 clear invoices, 5 difficult/photographed invoices, 5 GST invoices, 3 foreign invoices, and 2 cheques.
- Store ground truth only after a human independently transcribes each source document. Do not treat model output as ground truth.

## Test procedure
1. Assign each document a stable ID (D01-D20) and record its file type, page count, category, and difficulty.
2. Independently transcribe the expected values into the ground-truth template.
3. Run each document through the same Preview build and selected model. Save the raw JSON response, token usage, model ID, timestamp, latency, and success/failure.
4. Compare each extracted critical field against the ground truth. Normalize only harmless formatting differences (for example, surrounding whitespace); do not normalize away wrong digits, currency, sign, or date.
5. Record exact match, incorrect, missing, extra/hallucinated, or not applicable for each field.
6. Re-run only when investigating a documented failure. Keep first-attempt results separate from retry results.
7. Calculate accuracy by field and category. Report sample size and confidence limitations; 20 documents is an initial pilot, not proof of broad accuracy.

## Critical fields
### Invoices
Invoice number, invoice date, currency, supplier, buyer, each line-item description, quantity, unit rate, amount, subtotal, taxable amount, tax rate, tax due, GST components where present, other charges, and invoice total.
### Cheques
Cheque number, date, payee, amount in figures, amount in words, and bank/branch when visible.

## Scoring
- Field exact-match accuracy = correct applicable fields / all applicable ground-truth fields.
- Critical-field accuracy is reported separately from non-critical fields.
- Document success rate = documents with a usable structured response / documents attempted.
- Validation precision and recall should be measured against manually labelled arithmetic inconsistencies.
- Cost per successful document = total API cost for attempts attributable to successful documents / successful documents. Also report total cost per page and retries separately.
- Never claim 98% accuracy unless the measured, sufficiently representative test set supports it. Report exact denominator and test scope.

## Subscription decision gate
Do not finalize page limits until measured cost per page/document is available. Model light, typical, and heavy use, plus retries and a safety margin. Include payment fees, hosting, storage, support, taxes where applicable, and failed attempts when estimating contribution margin.
