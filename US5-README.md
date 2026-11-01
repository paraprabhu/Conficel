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

The test fixture is a manually reviewed expected extraction for `invoice-template-uk.pdf`. The validation module currently returns 19 passing checks for that fixture and flags a deliberately corrupted VAT amount. JavaScript syntax checks passed for the updated test page, endpoint, and Node test file. This is a deterministic regression test, not a claim that a live OpenAI API call has been run. The live endpoint still requires the server-side `OPENAI_API_KEY` Preview secret.


## Purchase Order support (incremental)
- The extraction prompt now explicitly recognizes Purchase Orders and requests dedicated `orderDate` and `requiredByDate` fields.
- The preview uses PO-specific required-field checks (PO number, order date and required-by date) rather than incorrectly requiring invoice number/date when the document is a PO.
- The document summary labels the PO identity and order amounts separately.
- Regression assertions cover PO recognition and the PO-specific validation path.
- Live extraction and the complete Node test suite still need to be run against the latest Preview deployment before approval.


## Multi-format document recognition and identifier routing
The preview now has a canonical document router. It distinguishes the primary document from linked references and routes its primary identifier to the matching field.

Supported primary document families include:
- Invoice and Tax Invoice (including generic/commercial, GST and VAT invoices): `invoiceNumber`
- Proforma Invoice: `proformaInvoiceNumber`
- Purchase Order: `purchaseOrderNumber`
- E-Way Bill / EWB: `ewayBillNumber`, EWB date and validity
- Delivery Challan / Delivery Note: `deliveryChallanNumber`
- Sales Order, Quotation / Estimate, RFQ, Purchase Requisition and Work Order
- Credit Note, Debit Note, Goods Receipt Note (GRN), Packing List
- Bill of Lading (BOL), Air Waybill (AWB), Consignment Note / Lorry Receipt, Dispatch Note
- Material Issue Note, Gate Pass, Service Entry Sheet, Statement of Account, Payment Advice and Delivery Receipt / Proof of Delivery
- Indian e-Invoice references: IRN and acknowledgement number/date, alongside the Tax Invoice identifier

The extraction schema also includes a `documentIdentifiers` array so linked references (for example, an invoice number printed on an E-Way Bill or a PO number printed on an invoice) are preserved without changing the primary document type. Unknown or unsupported formats must retain their printed title and identifiers in `documentType`, `documentSubtype`, `documentIdentifiers`, `documentFields` and `rawText`; the system must not force them into an invoice number.

Validation now selects required identifier fields according to the routed document type. Invoice/Tax Invoice requires invoice number and date; PO checks PO number; E-Way Bill checks EWB number; other types check their own identifier. Additional date fields are retained when printed.

**Important test limitation:** The updated Node regression tests have been committed but have not yet been executed in this environment. The live extraction behaviour still requires representative PO, E-Way Bill, proforma invoice, Tax Invoice and generic invoice samples to be tested on the Preview before approval.
