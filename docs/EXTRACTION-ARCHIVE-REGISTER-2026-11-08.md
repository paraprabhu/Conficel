# ConfiCel Extraction Machinery — Preservation Register

**Archive date:** 2026-11-08  
**Repository:** paraprabhu/Conficel  
**Primary archive branch:** `archive/extraction-machinery-2026-11-08`  
**Primary source branch:** `us5-uk-invoice-validation`  
**Purpose:** Preserve extraction prompts, code, document routing, validation, test fixtures, benchmark methodology, and historical experimental branches before any integration work.

## Preservation rules

1. This archive is a preservation copy. Do not use it as the live website deployment branch.
2. Do not delete or rewrite the original source branches.
3. Do not merge extraction changes into the application branch until the inventory, tests, and Preview comparisons are complete.
4. Keep API keys, credentials, customer documents, and private test data out of Git.
5. Keep original fixtures and test expectations unchanged. New corrections must be added as new tests or explicitly versioned fixtures.
6. Record every future integration as a separate branch and pull request.

## Primary preserved extraction implementation

The primary archive branch was created directly from `us5-uk-invoice-validation`. It retains the source branch's commit ancestry and working tree.

Core files in the source snapshot:

- `functions/api/openai-parse.js` — server-side OpenAI extraction endpoint and accumulated invoice/business-document and cheque prompts.
- `document-type-router.js` — primary document classification and identifier/date routing.
- `document-checklists.js` — document-specific completeness checklists.
- `invoice-validation.js` — UK VAT line-item and Purchase Order total validation.
- `openai-test.html` — dedicated extraction test interface.
- `tests/us5-uk-invoice-validation.test.cjs` — regression test suite (43 test cases defined in the source at archive time).
- `tests/fixtures/us5-uk-invoice.json` — manually reviewed UK invoice expected-output fixture.
- `docs/machinery-document-extraction-sop.md` — extraction and verification SOP.
- `benchmark/README.md` and `benchmark/ground-truth-template.csv` — benchmark protocol and ground-truth template.
- `US5-README.md` — implementation notes and limitations.

## Additional historical source branches preserved

Each branch below was copied to a separate archive branch. Original branches remain untouched.

| Original source branch | Preservation branch | Reason |
|---|---|---|
| `us5-uk-invoice-validation` | `archive/extraction-machinery-2026-11-08` | Latest consolidated extraction implementation and UK VAT/PO/quotation fixes |
| `23-browser-document-extraction` | `archive/source-23-browser-document-extraction-2026-11-08` | Earlier browser extraction path; comparison showed unique commits |
| `cheque-data-consistency-robert-gs` | `archive/source-cheque-data-consistency-2026-11-08` | Separate cheque consistency work; comparison showed unique commits |
| `gemini-standalone-test` | `archive/source-gemini-standalone-test-2026-11-08` | Separate Gemini experiment history; comparison showed unique commits |
| `22-complete-invoice-field-extraction` | `archive/source-22-complete-invoice-field-extraction-2026-11-08` | Earlier invoice field-extraction history |
| `23-fix-invoice-structure` | `archive/source-23-fix-invoice-structure-2026-11-08` | Earlier invoice structure corrections |
| `23-invoice-product-and-office-addresses` | `archive/source-23-invoice-product-office-addresses-2026-11-08` | Product and office-address extraction history |
| `24-proforma-buyer-hsn-extraction` | `archive/source-24-proforma-buyer-hsn-extraction-2026-11-08` | Proforma buyer and HSN extraction history |
| `22-invoice-to-excel-export` | `archive/source-22-invoice-to-excel-export-2026-11-08` | Invoice-to-Excel export history |

The earlier `03-openai-extraction-test` and `02-gemini-extraction-test` branches are ancestors of the primary consolidated source according to GitHub branch comparisons; their history is therefore reachable through the primary archive. They are also left untouched.

## Test and verification status at archive time

- The primary source README reports 19 passing deterministic checks for the manually reviewed UK VAT fixture, including detection of a deliberately corrupted VAT amount.
- The test file contains 43 Node test cases.
- The source README explicitly says the updated Node suite and latest live Preview still require execution/verification.
- A passing fixture test is not proof of live API accuracy or broad document accuracy.
- The 20-document benchmark is a proposed pilot methodology; it is not a completed accuracy benchmark.

## Known coverage boundaries

- The router recognizes a broad set of business document families.
- Dedicated checklists in the primary source currently cover Tax Invoice, Purchase Order, Proforma Invoice, and Quotation.
- The cheque prompt exists, but cheque-specific validation and checklist depth need a separate review.
- Historical browser and Gemini branches are preserved for comparison; they are not automatically approved as production paths.

## Next safe steps (not performed by this archive commit)

1. Inventory all unique files and commits in the preserved branches.
2. Compare the current website/application branch with this archive; identify its true latest safe base.
3. Run the full Node regression suite in a controlled environment.
4. Add missing historical tests and fixtures without altering original expected results.
5. Create a separate integration branch and connect the machinery to the current ConfiCel workspace.
6. Run representative live Preview tests with server-side secrets; never expose keys in client code.
7. Require explicit approval before production deployment.

**Archive status:** Preservation branches created. No source branch was modified or merged into production by this archive operation.
