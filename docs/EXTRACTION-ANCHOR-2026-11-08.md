# ConfiCel extraction machinery anchor — 8 November 2026

## Authoritative training source
- Repository: paraprabhu/Conficel
- Training branch: `us5-uk-invoice-validation`
- Exact source commit: `f79ec1243aa63e96f1151645f51426dadb3db8af`
- Short SHA shown in Cloudflare: `f79ec12`
- Source preview shown in Cloudflare: https://fe95d37a.conficel.pages.dev
- Latest recorded change: quotation-total regression test.

## Integration target
- Base-2 starting commit: `ef8e3890f30630e566128de5adee201c0a48e241`
- Working branch: `base2-openai-extraction-integration-2026-11-08`
- Production is not changed and no merge is authorized by this anchor.

## Anchored training assets
The following files were checked against the exact source commit. Identical blob SHAs mean the source artifact is preserved byte-for-byte:
- `document-checklists.js` — identical
- `document-type-router.js` — identical
- `invoice-validation.js` — identical
- `tests/us5-uk-invoice-validation.test.cjs` — original regression suite preserved; its references to the standalone preview were redirected to the test-only copy below
- `tests/fixtures/us5-uk-invoice.json` — identical
- `docs/machinery-document-extraction-sop.md` — identical
- `US5-README.md` — identical
- `benchmark/README.md` — identical
- `benchmark/ground-truth-template.csv` — identical
- `functions/api/openai-parse.js` — full extraction prompts preserved byte-for-byte; only model selection was hardened: no fallback to the unverified `gpt-6-luna` name; `OPENAI_MODEL` must be explicitly configured server-side.

## Standalone training UI
The source branch's `openai-test.html` is preserved as `tests/reference/openai-test.html` (test-only reference; not the base-2 homepage and not linked from the user interface). The regression suite now reads that reference copy.

## Verification boundary
This anchor establishes source provenance and file preservation. It does not claim that the full regression suite has been executed, that OpenAI extraction is wired into the base-2 user flow, or that authentication, usage charging, Excel export and Preview deployment have passed end-to-end tests. Those remain integration gates.