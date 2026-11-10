# Base-2 OpenAI extraction integration — Preview setup

This integration is based on `base-2` commit `ef8e3890f30630e566128de5adee201c0a48e241` and anchors the November 1 training source `f79ec1243aa63e96f1151645f51426dadb3db8af`.

## Required Supabase migration

Apply `supabase/migrations/004_extraction_permits.sql` in the Supabase SQL Editor for the project configured by the Preview site's `supabase-config.js`.

The migration creates a server-only table for short-lived, single-use extraction permits. The free-trial endpoint reserves page tokens and creates a permit bound to the signed-in user, selected file SHA-256, mode and page count. The OpenAI endpoint verifies and consumes that permit before calling OpenAI.

The existing migrations `002_free_trial_protection.sql` and `003_page_based_free_tokens.sql` must already be applied because `/api/free-trial` depends on their RPC.

## Cloudflare Pages Preview secrets / variables

Configure these only in the Preview environment first:
- `OPENAI_API_KEY` — OpenAI API key, server-side secret.
- `OPENAI_MODEL` — model enabled for the OpenAI API project; use `gpt-4.1-mini` for the initial cost-conscious Preview test if enabled in the project.
- `SUPABASE_URL` — same Supabase project URL used by the browser client.
- `SUPABASE_ANON_KEY` — Supabase anon/public key for validating the user's access token.
- `SUPABASE_SERVICE_ROLE_KEY` — service-role key, server-side secret only.
- `TRIAL_HASH_SECRET` — long random secret shared by the free-trial and OpenAI functions.

Never put OpenAI or service-role keys in `supabase-config.js`, `app.js`, HTML, or any client-visible file. Do not copy Preview secrets into Production as part of this work.

## Current workflow

1. Browser checks the PDF page count (images count as one page) and calculates a SHA-256 fingerprint.
2. Signed-in, email-confirmed user reserves page tokens through `/api/free-trial`.
3. The server returns a signed, short-lived, one-use permit bound to that file and user.
4. Browser posts the file to `/api/openai-parse`; the server authenticates the user, verifies and consumes the permit, then calls OpenAI.
5. Structured extraction fields are displayed in the editable review table.
6. Excel export includes flattened editable fields, field summary, full raw text, and separate sheets for line items, tax breakdown, charges, amount summary, references, other fields and document sections when present.

## Important limitations / test gates

- This Preview flow currently uses the 20-page free-token reservation endpoint; paid subscriptions and paid credit accounting are not integrated here.
- PDF page count is measured in the browser and bound into the signed permit. It is not yet independently re-parsed server-side.
- A failed provider call after token reservation can consume the reserved page tokens; a refund/retry ledger is not yet implemented.
- The original November 1 test UI is retained under `tests/reference/openai-test.html` only. It is not linked into the base-2 website.
- Gemini remains outside this normal extraction route on `gemini-standalone-test`.
- No Production deployment or merge is authorized by this branch.
