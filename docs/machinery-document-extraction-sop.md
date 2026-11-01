# ConfiCel — Document Extraction & Verification SOP

**Version:** 1.0 — initial scope  
**Active document types:** Invoice, Purchase Order (PO), Proforma Invoice  
**Expansion policy:** Add further document types only after these three checklists and their tests are stable.

## Common rules for all three documents

1. Identify the primary document by its title and purpose before running a checklist.
2. Keep the primary document number/date separate from linked references and other document dates.
3. Capture supplier and buyer independently; never swap their roles.
4. Inspect every page, including tables, footers, terms, notes, signatures and appendices.
5. Preserve printed wording, amounts, currency, units, signs and date formats.
6. Distinguish a genuinely missing field from a blank field, template prompt or field that is not applicable.
7. Never invent or silently calculate a missing extracted value.
8. Retain source text/sections for visual comparison. Checklist results are advisory, not proof of legal or commercial correctness.
9. Status meanings: **FOUND**, **MISSING**, **REVIEW**, **NOT APPLICABLE**. Conditional fields are not failures when there is no evidence they apply.

## 1. Tax Invoice / Commercial Invoice checklist

| No. | Field / content to search | Priority | Verification |
|---:|---|---|---|
| 1 | Invoice type/subtype | Required | Tax invoice, commercial invoice or other clearly printed type |
| 2 | Invoice number | Required | Use invoice number only; do not substitute PO/PI number |
| 3 | Invoice date | Required | Must come from invoice date label |
| 4 | Due date | Recommended | Keep separate from invoice date |
| 5 | Supplier/seller legal name | Required | Do not populate from template placeholders |
| 6 | Supplier address and contact | Recommended | Capture complete printed details |
| 7 | Supplier GSTIN/VAT/tax ID | Conditional | Capture only if printed/applicable |
| 8 | Buyer/customer legal name | Required | Must be distinct from supplier |
| 9 | Buyer address and contact | Recommended | Capture complete printed details |
| 10 | Buyer GSTIN/VAT/tax ID | Conditional | Capture only if printed/applicable |
| 11 | Bill-to and ship-to/consignee | Conditional | Keep separate where both appear |
| 12 | Linked PO / work order / GRN / challan references | Conditional | Preserve exact label and value; not the invoice number |
| 13 | Currency | Required | Use printed currency evidence |
| 14 | Every line item description | Required | One structured row per printed item; retain full description/model |
| 15 | Quantity and unit | Recommended | Preserve units and decimal precision |
| 16 | Unit price/rate | Recommended | Keep separate from line total |
| 17 | Net, discount, tax rate, tax amount and gross/line amount | Required where columns are printed | Preserve the document's column meaning |
| 18 | Subtotal/net total | Recommended | Reconcile with line items where possible |
| 19 | Tax type and tax total | Conditional | VAT/GST/etc. must not be substituted |
| 20 | Tax breakdown by rate/category | Conditional | Preserve separate taxable bases and amounts |
| 21 | Freight, packing, insurance and other charges | Conditional | Distinguish add-on charges from staged totals |
| 22 | Invoice total / amount due | Required | Cross-check subtotal + taxes + charges, respecting discounts/rounding |
| 23 | Payment terms and due date | Recommended | Preserve exact wording |
| 24 | Bank/payment instructions | Conditional | Capture account/payment references if printed |
| 25 | Amount in words, notes, declarations, warranty | Conditional | Preserve where present |
| 26 | Authorized signatory, stamp, IRN/acknowledgement/EWB | Conditional | Capture only when present/applicable |
| 27 | Full source text and all pages | Required | Compare transcript and structured fields to original |

**Invoice cross-checks**
- Quantity × unit price against printed line amount, only where the source makes that relationship clear.
- Net + tax against gross where all three are printed.
- Line net totals against subtotal.
- Taxable bases and tax amounts reconciled separately for each tax rate.
- Subtotal, tax, other charges, discounts and final total reconciled without double-counting.
- Supplier, buyer, invoice number and invoice date checked against their own labels.
- Linked PO/GRN/challan references kept distinct from the invoice identifier.

## 2. Purchase Order checklist

| No. | Field / content to search | Priority | Verification |
|---:|---|---|---|
| 1 | Document type/title | Required | Confirm it is a Purchase Order, not a quotation or invoice |
| 2 | PO number | Required | Use purchaseOrderNumber; never invoiceNumber |
| 3 | PO/order date | Required | Use orderDate; do not substitute invoiceDate |
| 4 | Revision/version | Conditional | Capture if printed |
| 5 | Buyer/ordering company name | Required | Identify the issuing party |
| 6 | Buyer address/contact/tax ID | Recommended / conditional | Capture printed details |
| 7 | Supplier/vendor name | Required | Identify the party receiving the order |
| 8 | Supplier address/contact/tax ID | Recommended / conditional | Capture printed details |
| 9 | Bill-to and ship-to/delivery site | Recommended | Keep distinct |
| 10 | Linked PR/RFQ/quotation references | Conditional | Keep each reference typed and separate |
| 11 | Required-by/delivery date | Recommended | Do not substitute PO date |
| 12 | Every machinery/goods/service line | Required | One row per ordered item |
| 13 | Description, make, model, part number and technical specification | Required | Preserve complete printed specification |
| 14 | Quantity and unit | Required | Verify every PO line |
| 15 | Unit price, discount and line value | Recommended | Preserve printed commercial values |
| 16 | Currency | Recommended | Capture if printed |
| 17 | Tax type/rate/base/amount | Conditional | Keep tax categories/rates separate |
| 18 | Freight, packing, insurance, installation and other charges | Conditional | Preserve separately |
| 19 | PO subtotal and grand total/order value | Recommended | Reconcile where amounts are provided |
| 20 | Delivery schedule, partial delivery and delivery terms | Recommended | Capture all dates and conditions |
| 21 | Payment terms/milestones/advance/retention | Recommended | Preserve exact terms |
| 22 | Warranty, installation, commissioning, training, spares and service scope | Conditional | Capture clauses and annexures |
| 23 | Inspection, acceptance, penalty and cancellation clauses | Conditional | Preserve terms, not just summary |
| 24 | Approvals, signatures and stamp | Recommended | Identify approval evidence |
| 25 | Full terms, all pages and source text | Required | Include reverse/continuation/annexure pages |

**PO cross-checks**
- PO number/date are not populated from linked invoice, quotation or PI fields.
- Buyer is the issuing/ordering party; supplier is the vendor.
- Item description/specification, quantity, unit and line values remain aligned row by row.
- PO totals and tax are reconciled only where printed.
- Required-by date, delivery terms, payment terms and warranty clauses are not dropped from later pages.

## 3. Proforma Invoice checklist

| No. | Field / content to search | Priority | Verification |
|---:|---|---|---|
| 1 | Document type/title | Required | Confirm Proforma Invoice / Pro Forma Invoice |
| 2 | Proforma invoice number | Required | Use proformaInvoiceNumber, not invoiceNumber |
| 3 | Proforma invoice date | Required | Use proformaInvoiceDate; do not substitute invoiceDate or dueDate |
| 4 | Valid-until/quotation validity | Recommended | Capture expiry/validity if printed |
| 5 | Supplier/seller legal name | Required | Do not populate from placeholders |
| 6 | Supplier address/contact/tax ID | Recommended / conditional | Capture printed details |
| 7 | Buyer/customer legal name | Required | Keep distinct from supplier |
| 8 | Buyer address/contact/tax ID | Recommended / conditional | Capture printed details |
| 9 | Bill-to and ship-to/consignee | Conditional | Keep separate |
| 10 | Linked PO/RFQ/quotation references | Conditional | Preserve as linked references |
| 11 | Currency | Required | Capture currency and evidence |
| 12 | Every machinery/goods/service line | Required | One row per printed item |
| 13 | Description, make, model, part number/specification | Required | Preserve complete details |
| 14 | Quantity and unit | Required | Preserve printed unit |
| 15 | Unit price, discount and line amount | Recommended | Do not confuse unit price with total |
| 16 | Subtotal | Recommended | Reconcile against lines where possible |
| 17 | Tax type/rate/base/amount | Conditional | Capture if printed; do not assume tax treatment |
| 18 | Freight, insurance, packing and other charges | Conditional | Separate from subtotal |
| 19 | Proforma total/estimated amount | Required | Preserve printed total and currency |
| 20 | Delivery schedule/Incoterms | Recommended | Capture exact terms |
| 21 | Advance/payment terms and bank instructions | Recommended / conditional | Preserve exact wording/details |
| 22 | Warranty, scope, exclusions and validity conditions | Conditional | Capture if printed |
| 23 | Amount in words, notes and declarations | Conditional | Capture if printed |
| 24 | Authorized signatory/stamp and annexures | Conditional | Capture if present |
| 25 | Full source text and all pages | Required | Compare transcript and structured fields to original |

**Proforma Invoice cross-checks**
- PI number/date must use PI-specific fields. Never fall back to invoiceNumber, invoiceDate or dueDate.
- A PI is not automatically a tax invoice or proof of payment.
- Supplier and buyer roles must remain distinct.
- Linked PO references must not overwrite the PI number.
- Line items, currency, tax, charges and total must be captured as printed.
- Validity, delivery and payment terms should be reviewed when present.

## Implementation and rollout

- The initial code registry contains only these three document types.
- A checklist is selected after primary document classification.
- Required missing fields are flagged; recommended fields are review prompts; conditional fields are **NOT APPLICABLE** when no evidence indicates they apply.
- Checklist validation does not modify extracted values.
- Further document types will be added in later SOP versions, with their own fixtures and regression tests.
