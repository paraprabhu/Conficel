# ConfiCel — Machinery Document Extraction & Verification SOP

**Status:** Initial working catalogue — review before implementation  
**Scope:** Machinery procurement, receipt, installation, operation, maintenance and payment records  
**Principle:** Identify the primary document first, then apply only that document type's checklist. A linked reference (for example, a PO number printed on an invoice) must not change the primary document type.

## 1. Standard checklist result states

- **FOUND** — value is present and mapped to the correct field.
- **MISSING** — expected field was not found; flag for review, not automatic rejection.
- **NOT APPLICABLE** — field is not relevant to this document or transaction.
- **UNCLEAR** — text/value is present but unreadable, ambiguous or conflicting.
- **CROSS-CHECK** — compare against another field, page, document or calculation.
- **CONDITIONAL** — required only when the transaction/document indicates it applies.

Never invent a value. Preserve the printed label and source value. Keep the page/section or source-text evidence where available. Do not treat template instructions, blank cells or placeholders as actual business data.

## 2. Initial document pool — machinery lifecycle

### A. Procurement and commercial

#### 1. Purchase Requisition (PR)
1. PR number and PR date.
2. Requesting department, requester and contact.
3. Machinery/equipment description, make/model and technical specification.
4. Quantity, unit and required-by date.
5. Intended use, plant/site/location and project/cost centre.
6. Estimated unit cost, total estimate and currency, if printed.
7. Budget/capex reference and approval status/signatures.
8. Justification, attachments and special requirements.
9. Cross-check: requested quantity/specification and required-by date are internally consistent.

#### 2. Request for Quotation (RFQ)
1. RFQ number, issue date and response due date.
2. Buyer/company, requesting contact and delivery/site address.
3. Supplier/vendor name and contact details.
4. Machinery description, make/model, specifications and quantity.
5. Scope of supply, accessories, spares and exclusions.
6. Required delivery schedule and delivery location.
7. Installation, commissioning, training and warranty requirements.
8. Inspection, acceptance and documentation requirements.
9. Commercial response requirements: currency, taxes, freight, payment terms and validity.
10. Cross-check: each requested item/specification and quantity is identifiable.

#### 3. Supplier Quotation / Proforma Invoice
1. Quotation/PI number, date and validity/expiry date.
2. Supplier identity, address and contact/tax registration.
3. Buyer identity, address and contact.
4. Reference to RFQ/PR and machinery project/site, if printed.
5. Equipment make, model, part number, specifications and quantity.
6. Unit price, discounts, line totals, currency and subtotal.
7. Tax type, rate, taxable base and tax amount.
8. Freight, insurance, packing, installation, commissioning and other charges.
9. Grand total and amount in words, if printed.
10. Delivery lead time, delivery terms/Incoterms, payment terms and bank details.
11. Warranty, validity, exclusions, scope and deviations.
12. Authorized signatory/stamp and attached technical/commercial schedules.
13. Cross-check: line arithmetic, tax arithmetic, total, currency and quotation validity.

#### 4. Purchase Order (PO)
1. PO number, PO date and revision/version.
2. Buyer/company name, address, contact and tax registration.
3. Supplier/vendor legal name, address, contact and tax registration.
4. Reference PR/RFQ/quotation number and date.
5. Ship-to/delivery site, bill-to address and consignee.
6. Machinery/equipment description, make, model, part number and full specification.
7. Line-wise quantity, unit, unit price, discount and line amount.
8. Tax type/rate/base/amount and tax breakdown.
9. Freight, packing, insurance, installation, commissioning and other charges.
10. PO subtotal, tax total, grand total and currency.
11. Delivery schedule, required-by date, partial-delivery terms and delivery conditions.
12. Payment milestones/terms, advance, retention and bank/payment conditions where printed.
13. Warranty, service, spares, training, inspection and acceptance conditions.
14. Penalty/liquidated damages, cancellation and other commercial clauses.
15. Authorized approvals, signatures, stamp and terms/conditions pages.
16. Cross-check: PO line totals, taxes, total, quantities, dates and referenced quotation/PR.

### B. Dispatch, transport and receipt

#### 5. Delivery Challan / Delivery Note
1. Challan/note number and date.
2. Supplier/dispatching party and buyer/consignee.
3. Linked PO, invoice and e-way bill references.
4. Dispatch-from and ship-to locations.
5. Machinery/item description, make/model/serial number and part number.
6. Quantity dispatched, unit, packages and packing details.
7. Transporter, vehicle number, LR/consignment reference and dispatch date.
8. Condition, remarks, shortages/damages and returnable/non-returnable status.
9. Receiver name, date, signature and stamp.
10. Cross-check: dispatched quantity and item identity against PO and subsequent GRN.

#### 6. E-Way Bill (where applicable)
1. E-way bill number and generation date/time.
2. Valid-until date/time and status, if printed.
3. Supplier/consignor and recipient/consignee details and tax IDs.
4. Document type, document number and document date (invoice/challan).
5. Goods description, HSN where printed, quantity and taxable/value amount.
6. Tax rates and tax amounts, if printed.
7. Dispatch-from and delivery-to locations/pincodes.
8. Transporter ID/name, transport mode, vehicle number and distance.
9. Part-B/vehicle update details and validity extension, if present.
10. Cross-check: distinguish the EWB number from linked invoice/challan numbers; compare goods value, parties and dates with source document.

#### 7. Goods Receipt Note (GRN) / Material Receipt
1. GRN number and receipt date/time.
2. Receiving plant/site, store and receiving department.
3. Supplier, transporter and delivery challan/invoice/PO references.
4. PO line/item number, machinery description, make/model and serial number.
5. Ordered quantity, received quantity, accepted quantity and rejected/short quantity.
6. Unit, package count and packing condition.
7. Physical condition, damage/shortage/overage and discrepancy remarks.
8. Inspection/QC status, inspection report reference and hold/release status.
9. Received-by, checked-by and approved-by names/signatures.
10. Cross-check: received/accepted quantities against PO and challan; retain discrepancies rather than forcing a match.

#### 8. Packing List
1. Packing list number and date.
2. Supplier, buyer, shipper and consignee.
3. Linked PO, invoice, challan and shipment references.
4. Package-wise machinery/item description, model and serial number.
5. Quantity per package and total quantity.
6. Package number/mark, dimensions, net weight and gross weight.
7. Packing type, contents, accessories, tools and loose items.
8. Handling/storage instructions and dangerous-goods marks, if present.
9. Cross-check: package totals and equipment/accessory counts against PO and dispatch documents.

#### 9. Transport Document (LR / Consignment Note / AWB / Bill of Lading)
1. Document type, number and issue/dispatch date.
2. Carrier/transporter identity and contact.
3. Consignor, consignee and notify party.
4. Origin, destination, route and delivery address.
5. Linked invoice, PO, challan, EWB and shipment references.
6. Goods description, packages, quantity, weight and dimensions.
7. Vehicle/container number, seal number and mode of transport.
8. Freight/prepaid/collect terms and charges, if printed.
9. Delivery/receipt evidence, exceptions and signatures.
10. Cross-check: shipment identifiers and package/weight totals against packing list and dispatch documents.

#### 10. Gate Pass
1. Gate pass number, date and time.
2. Gate/site/plant and pass type (inward, outward, returnable, non-returnable).
3. Supplier/visitor/driver/department details.
4. Machinery/item description, make/model and serial number.
5. Quantity, package count and vehicle number.
6. Linked PO, challan, GRN, service/work order and returnable-pass references.
7. Purpose, destination and expected return date, where applicable.
8. Security check, issued-by, authorized-by and gate-out/gate-in timestamps.
9. Cross-check: outward and return quantities/status for returnable equipment.

### C. Installation, operation and maintenance

#### 11. Work Order / Service Order
1. Work/service order number, date and revision.
2. Issuing company, plant/site and department.
3. Contractor/service provider identity and contact.
4. Linked PO, asset/equipment ID and service request reference.
5. Machinery make/model, serial number, location and scope of work.
6. Work description, deliverables and exclusions.
7. Start date, completion deadline, milestones and shutdown window.
8. Labour, materials, spares, tools and quantities.
9. Safety/PPE/permit, isolation/LOTO and site access requirements.
10. Commercial value, taxes, payment milestones and warranty, if applicable.
11. Approval/signatures and acceptance authority.
12. Cross-check: scope, asset identity, dates and commercial values against PO/service request.

#### 12. Installation & Commissioning Report
1. Report number, date and project/site.
2. Customer/plant, contractor/OEM and attending personnel.
3. Equipment name, make, model, serial number, asset/tag number.
4. PO, delivery challan, GRN and work-order references.
5. Installation location, foundation/alignment and utility connections.
6. Installation date, start/completion times and work performed.
7. Electrical/mechanical parameters and readings with units.
8. Trial-run details, load, speed, temperature, pressure, vibration and other relevant measurements.
9. Safety checks, interlocks, guards and statutory checks, where applicable.
10. Deviations, punch-list/open items and corrective actions.
11. Commissioning result/status, handover date and operational acceptance.
12. Customer/OEM/contractor signatories and attachments.
13. Cross-check: equipment serial/tag identity against receipt and asset records; preserve measured values with units.

#### 13. Inspection / Test / Quality Certificate
1. Certificate/report number and issue date.
2. Issuing inspection agency, manufacturer or laboratory.
3. Buyer, supplier, project and site.
4. Equipment/item description, model, serial/batch number.
5. PO, challan, GRN and inspection request references.
6. Inspection/test standard, procedure and revision.
7. Test parameter, measured result, unit, acceptance limit and pass/fail.
8. Calibration instrument/reference and calibration validity, if printed.
9. Sampling details, test date and location.
10. Non-conformities, observations, concessions and corrective actions.
11. Final acceptance/rejection/conditional release status.
12. Inspector/approver names, signatures, stamp and annexures.
13. Cross-check: result units and acceptance limits must remain paired; do not convert or infer missing readings.

#### 14. Maintenance / Breakdown / Service Report
1. Service/job-card/report number and date.
2. Customer, plant/site, department and contact.
3. Asset/equipment ID, make, model, serial number and location.
4. Complaint/breakdown reference, date/time reported and downtime.
5. Operating hours/counter reading and operating conditions.
6. Fault symptoms, diagnosis and root cause.
7. Work performed, parts/spares replaced and quantities.
8. Labour/personnel, visit dates and time spent.
9. Measurements before/after repair and test-run results with units.
10. Safety isolation/permit and restart clearance.
11. Pending recommendations, follow-up date and parts required.
12. Equipment condition and service completion/acceptance.
13. Customer/technician signatures.
14. Cross-check: replaced parts, service scope and asset identity against stores issue and work order.

#### 15. Material Issue / Return Note
1. Issue/return note number and date/time.
2. Plant, store, department and cost centre.
3. Request/work-order/maintenance reference.
4. Material code, description, make/model/specification and batch/serial number.
5. Quantity requested, issued, returned and balance; unit.
6. Store location/bin and recipient/technician.
7. Purpose/equipment asset ID.
8. Issued-by, received-by and approved-by signatures.
9. Cross-check: issued/returned quantities and material identity against work order and service report.

#### 16. Service Entry Sheet (SES) / Job Completion Certificate
1. SES/certificate number and date.
2. Buyer, service provider, plant/site and department.
3. Linked PO/service order/work order and invoice references.
4. Service description, period and milestone.
5. Ordered quantity/value versus service performed/accepted.
6. Measurement sheet, hours, units, rates and accepted amount.
7. Deviations, deductions, penalties or retention, if printed.
8. Acceptance/rejection/partial acceptance status and remarks.
9. Prepared-by, service-entry approver and authorized signatories.
10. Cross-check: accepted scope/quantity/value against PO and supplier invoice.

### D. Invoice, adjustment and payment

#### 17. Tax Invoice / Commercial Invoice
1. Invoice type/subtype, invoice number and invoice date.
2. Due date, payment terms and currency.
3. Supplier legal name, address, contact and tax registration (GSTIN/VAT/TIN where printed).
4. Buyer/customer legal name, address, contact and tax registration.
5. Bill-to, ship-to/consignee and delivery location.
6. Linked PO, GRN, challan, work order and service-entry references.
7. Each line item: full description, make/model/part number, quantity, unit, unit rate, discount, net, tax rate, tax amount and gross/line amount as printed.
8. Subtotal/net total, taxable base and tax breakdown by each rate/category.
9. Freight, packing, insurance, installation, other charges, round-off and discounts.
10. Invoice total/grand total, amount in words and balance due, if printed.
11. Bank/payment details, payment instructions and remittance reference.
12. Delivery terms, warranty, notes, declarations, IRN/acknowledgement/EWB details where applicable.
13. Authorized signatory, stamp, QR code and page count/annexures.
14. Cross-check: quantity × unit rate; line net/tax/gross; tax bases by rate; subtotal + tax + charges = total; PO/GRN/service-entry match.
15. Placeholder check: do not treat template prompts, blank supplier footer cells or logo placeholders as supplier data.

#### 18. Credit Note / Debit Note
1. Note type, number and issue date.
2. Supplier/issuer and buyer/recipient identities and tax IDs.
3. Original invoice number/date and linked PO/GRN reference.
4. Reason for credit/debit and supporting description.
5. Affected item/service, quantity, unit rate and adjustment amount.
6. Tax category/rate/base/amount and tax adjustment.
7. Total adjustment, currency and amount in words.
8. Revised balance/refund/amount payable, if printed.
9. Approval/signature and statutory reference/IRN, if applicable.
10. Cross-check: do not treat the adjustment as a new invoice; compare against the referenced original invoice.

#### 19. Payment Advice / Remittance Advice
1. Advice/reference number and date.
2. Payer and payee identity and bank details.
3. Payment date, currency, method and transaction/reference number.
4. Invoice/credit-note numbers and dates being settled.
5. Invoice amount, deductions, withholding/tax, discount and amount paid per document.
6. Total remitted and bank/payment confirmation details.
7. Payment remarks and approval.
8. Cross-check: allocation totals against remittance total; preserve partial payments and deductions separately.

#### 20. Statement of Account
1. Statement number/period and statement date.
2. Account holder, supplier/customer and account identifiers.
3. Opening balance and closing balance.
4. Transaction date, document/reference number, description and debit/credit.
5. Invoice, credit note, debit note and payment references.
6. Currency, ageing buckets and due dates, if printed.
7. Total debits, credits and outstanding amount.
8. Cross-check: opening balance + debits - credits = closing balance, subject to source convention; verify invoice/payment references.

## 3. Universal checks applied to every document

1. Correct primary document type and subtype.
2. Primary document number/reference and document date.
3. Issuer/from party and recipient/to party, where applicable.
4. Linked references captured separately with their printed labels.
5. All pages inspected; page count and continuation pages considered.
6. Tables captured row-by-row; no merging of distinct items.
7. Amounts, quantities, units, signs, currencies and date formats preserved as printed.
8. Blank fields and template placeholders distinguished from missing extraction.
9. Names, identifiers and dates mapped only from semantically matching labels.
10. Cross-page consistency and duplicate/repeated values reviewed.
11. Source text and section/page evidence retained for audit.
12. Unreadable/ambiguous/conflicting values marked UNCLEAR; never guessed.

## 4. Implementation rules

- Keep document checklists in a versioned registry separate from the extraction prompt and arithmetic validators.
- Each checklist item should have: stable ID, field key(s), display label, priority, requiredness rule, validation rule, and evidence expectation.
- Requiredness must be conditional where business practice varies. A missing PO number on an invoice, for example, may be a review item or not applicable depending on the transaction; it is not universally mandatory.
- Run type-specific checks only after document classification. Also run universal checks for every type.
- Do not turn a missing optional field into a hard failure.
- Arithmetic checks must be jurisdiction/tax-type aware. Do not apply UK VAT rules to Indian GST or other tax systems.
- Keep extraction separate from validation: validation flags issues and must not silently rewrite source values.
- New document types and checklist revisions must be versioned and regression-tested against representative real documents.
- This initial catalogue is a machinery lifecycle baseline. Add specialist documents (drawings, datasheets, manuals, calibration certificates, permits, risk assessments, SOPs) in a later revision after confirming the required operational scope.
