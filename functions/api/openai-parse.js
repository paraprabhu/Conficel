const MAX_FILE_BYTES = 10 * 1024 * 1024;

const INVOICE_PROMPT = `You are a careful business-document data extraction system. Read the supplied business document image/PDF directly, including invoices, proforma invoices and purchase orders. Return ONLY valid JSON, no markdown. Never invent missing values; use empty strings for unknown scalar fields and [] for unknown line items. Preserve values as printed, including date format and currency. Distinguish supplier from buyer and consignee. Do not mistake website text, headings, or terms for invoice numbers. Extract every visible line item separately. Include rawText with the readable text you can identify. Fields:
{
  "documentType": "Invoice | Tax Invoice | Proforma Invoice | Purchase Order | E-Way Bill | Delivery Challan | Sales Order | Quotation | Credit Note | Debit Note | Goods Receipt Note | Packing List | Bill of Lading | Air Waybill | Consignment Note | Dispatch Note | Receipt | Request for Quotation | Purchase Requisition | Work Order | Material Issue Note | Gate Pass | Service Entry Sheet | Statement of Account | Payment Advice | Delivery Receipt | Other", "documentSubtype": "",
  "invoiceNumber": "", "invoiceDate": "", "dueDate": "", "proformaInvoiceNumber": "", "proformaInvoiceDate": "", "orderDate": "", "requiredByDate": "",
  "ewayBillNumber": "", "ewayBillDate": "", "ewayBillValidUntil": "", "deliveryChallanNumber": "", "deliveryChallanDate": "",
  "salesOrderNumber": "", "salesOrderDate": "", "quotationNumber": "", "quotationDate": "", "validUntil": "",
  "creditNoteNumber": "", "creditNoteDate": "", "debitNoteNumber": "", "debitNoteDate": "",
  "goodsReceiptNumber": "", "goodsReceiptDate": "", "packingListNumber": "", "packingListDate": "",
  "airWaybillNumber": "", "airWaybillDate": "", "billOfLadingDate": "", "consignmentNoteNumber": "", "consignmentDate": "",
  "dispatchNoteNumber": "", "dispatchDate": "", "receiptNumber": "", "receiptDate": "",\n  "rfqNumber": "", "rfqDate": "", "purchaseRequisitionNumber": "", "purchaseRequisitionDate": "", "workOrderNumber": "", "workOrderDate": "",\n  "materialIssueNumber": "", "materialIssueDate": "", "gatePassNumber": "", "gatePassDate": "", "serviceEntryNumber": "", "serviceEntryDate": "",\n  "statementNumber": "", "statementDate": "", "paymentAdviceNumber": "", "paymentAdviceDate": "", "deliveryReceiptNumber": "", "deliveryReceiptDate": "",\n  "irn": "", "acknowledgementNumber": "", "acknowledgementDate": "",
  "documentIdentifiers": [{"type":"","label":"","value":""}],
  "waybillNumber": "", "billOfLadingNumber": "", "shipmentReference": "", "trackingNumber": "",
  "supplier": "", "supplierGSTIN": "", "supplierAddress": "", "supplierContact": "",
  "buyerCustomer": "", "buyerGSTIN": "", "buyerAddress": "",
  "consigneeShipTo": "", "state": "", "stateCode": "", "purchaseOrderNumber": "",
  "currency": "", "currencySymbol": "", "currencyEvidence": "", "countryOrJurisdiction": "",
  "lineItems": [{"description":"","hsnSac":"","quantity":"","unit":"","unitRate":"","discount":"","netAmount":"","taxRate":"","taxAmount":"","grossAmount":"","amount":"","taxable":"","sourceLabel":"","sourceSection":""}],
  "chargeBreakdown": [{"label":"","amount":"","currency":"","type":"","includedInTotal":"","sourceSection":""}],
  "subtotal": "", "discount": "", "taxableAmount": "",
  "taxRate": "", "taxDue": "", "taxDescription": "", "taxLabel": "", "taxCategory": "", "taxBreakdown": [{"label":"","category":"","rate":"","taxableAmount":"","amount":""}],
  "cgst": "", "sgst": "", "igst": "", "cess": "", "totalTax": "",
  "otherCharges": "", "freightCharges": "", "invoiceTotal": "", "orderTotal": "", "documentTotal": "",\n  "amountSummaryRows": [{"label":"","amount":"","type":"","includedInTotal":"","sourceSection":""}],
  "invoiceTotalInWords": "", "paymentTerms": "", "deliveryTerms": "", "additionalCosts": "",
  "sections": [{"heading":"","content":""}], "documentFields": [{"label":"","value":"","section":""}],
  "rawText": ""
}
DOCUMENT TYPE CLASSIFICATION AND FIELD ROUTING (critical): Identify the primary document type from its title, headings, labels and function. Use one canonical documentType from the schema; put a more specific printed wording such as "GST Tax Invoice" in documentSubtype. Supported types include Invoice (including generic/commercial invoices), Tax Invoice (including GST/VAT invoices; still use invoiceNumber), Proforma Invoice (proformaInvoiceNumber), Purchase Order/PO (purchaseOrderNumber), E-Way Bill/EWB (ewayBillNumber), Delivery Challan/Delivery Note (deliveryChallanNumber), Sales Order (salesOrderNumber), Quotation/Quote/Estimate (quotationNumber), Credit Note (creditNoteNumber), Debit Note (debitNoteNumber), Goods Receipt Note/GRN (goodsReceiptNumber), Packing List (packingListNumber), Bill of Lading/BOL (billOfLadingNumber), Air Waybill/AWB (airWaybillNumber), Consignment Note/Lorry Receipt/LR (consignmentNoteNumber), Dispatch Note (dispatchNoteNumber), and Receipt (receiptNumber), Request for Quotation/RFQ (rfqNumber), Purchase Requisition (purchaseRequisitionNumber), Work Order (workOrderNumber), Material Issue Note (materialIssueNumber), Gate Pass (gatePassNumber), Service Entry Sheet (serviceEntryNumber), Statement of Account (statementNumber), Payment Advice (paymentAdviceNumber), and Delivery Receipt (deliveryReceiptNumber). For an Indian e-Invoice or GST e-invoice, classify the primary document as Tax Invoice and additionally capture IRN, acknowledgement number/date and any E-Way Bill number in their own fields. A cheque remains handled by cheque mode. Do not classify based on a reference mentioned in the body alone; classify the document represented by its title and purpose. Use the dedicated number field matching the primary document type. For example, never put a PO number, E-Way Bill number, delivery challan number, credit note number or proforma invoice number into invoiceNumber. For a Tax Invoice or any generic/commercial invoice, put its printed invoice identifier in invoiceNumber. For E-Way Bills capture ewayBillNumber, ewayBillDate and validity/valid-until when printed; capture vehicle/transporter details in documentFields if not separately represented. Capture all linked/cross-referenced document numbers (such as invoice number, PO number, delivery challan number, transport document number) separately in documentIdentifiers with exact type, printed label and value, and in documentFields. Never mistake a linked invoice reference on an E-Way Bill for the E-Way Bill's own number. Only populate a dedicated field when the document itself prints that identifier; preserve all other references in documentIdentifiers/documentFields. Apply the corresponding date fields for the primary document type; do not force PO/order dates or EWB dates into invoiceDate. If a specific identifier field is not present in the schema, preserve its exact label/value in documentIdentifiers and documentFields.\n\nDOCUMENT IDENTIFIER DICTIONARY: Recognize and preserve document/reference identifiers even when they are not invoice numbers. The identifier dictionary includes invoice number/no./#, proforma invoice number, credit note number, debit note number, purchase order/PO number, waybill number/no., air waybill/AWB number, bill of lading/BOL number, shipment reference, consignment note number, tracking number, delivery note number, dispatch note number, order reference, customer reference, and payment reference. Keep each identifier in its own matching field when available (for example waybillNumber, billOfLadingNumber, shipmentReference, trackingNumber, purchaseOrderNumber, invoiceNumber) and also preserve the exact printed label and value in documentFields. Never substitute one identifier type for another: a waybill number is not automatically an invoice number, and a certification date is not automatically the invoice date. If a known identifier type is not yet represented by a dedicated field, retain it in documentFields with its original label and value rather than dropping it.\n\nMANDATORY FULL-DOCUMENT CAPTURE (core requirement): For a Purchase Order, also populate orderTotal and documentTotal with the printed ORDER TOTAL / PO TOTAL / GRAND TOTAL, without copying subtotal or tax into it. Populate amountSummaryRows with one row for every distinct printed summary amount label, including Net Total/subtotal, VAT/tax and ORDER TOTAL; preserve exact printed label and amount, type, and source section. Do not duplicate line items as summary rows. Keep invoiceTotal blank for a PO unless the source genuinely contains a separate invoice amount. The PO amount summary must retain the total even if it appears only in a coloured summary band. For a Purchase Order, set documentType to "Purchase Order" (not "Other") when the source is headed Purchase Order or clearly functions as an order. Populate purchaseOrderNumber, orderDate and requiredByDate from their printed labels. Do not invent invoiceNumber or invoiceDate for a PO. For an E-Way Bill, set documentType to "E-Way Bill", populate ewayBillNumber and the printed EWB date/validity fields, and keep any linked invoice number in invoiceNumber only if it is explicitly the linked invoice reference; also identify it as a linked reference in documentIdentifiers. For a Tax Invoice or generic invoice, set documentType to "Tax Invoice" or "Invoice" respectively and populate invoiceNumber. Treat this as a document digitization job, not a short invoice summary. Inspect EVERY page and read the document from top to bottom and left to right, including headers, footers, side panels, tables, small print, notes, payment blocks, signatures/certifications, and text near logos or QR codes. Do not stop after identifying the supplier, one service/product table, or the invoice total. Capture every legible word and every meaningful printed value. Populate rawText with the fullest faithful transcription of all readable source text, preserving original wording, labels, number formats, signs, dates, and currency symbols; do not replace it with a summary. If the document is multi-page, include content from every page. Never silently omit content because it does not fit the standard schema.

TEMPLATE PLACEHOLDERS: Distinguish actual supplier details from template prompts such as 'Your business name', 'Your address, town, county and postcode', 'Telephone, email, VAT number', and 'Add your logo here'. Do not populate supplier, supplierAddress, supplierContact, supplierGSTIN, buyer, or other entity fields with instructional placeholder text. Preserve the exact placeholder label/text in rawText and documentFields, but use an empty value for the placeholder field value and identify its section as 'Footer placeholder' or 'Header placeholder'. Keep genuinely blank signature and amount cells blank.\n\nBLANK PRINTED AMOUNT FIELDS: Preserve printed labels whose amount cells are blank (for example Tax, Shipping, Miscellaneous, Date of Payment, Check Number, Cash, Signature, Staff Initial) as documentFields or chargeBreakdown rows with empty amount/value. Do not invent zero, do not omit the printed label, and do not count a blank amount cell as a missing numeric extraction. LINE ITEMS VS OTHER AMOUNTS: Extract every product/service row as its own lineItems entry, retaining full descriptions, model/SKU/reference, quantity, unit, unit price, discounts and line amount when printed. Capture invoice-level discounts separately in the top-level discount field when the document has a distinct Discount summary row; do not confuse invoice-level discount with per-line discounts. Also preserve discount labels and values in amountSummaryRows when printed. For columnar invoices, map the printed Net column to lineItems.netAmount, VAT/tax % to lineItems.taxRate, VAT/tax amount to lineItems.taxAmount, and Amount/Total to lineItems.grossAmount. Keep legacy lineItems.amount equal to the printed gross Amount for backward compatibility; never confuse gross Amount with Net. Keep unitRate as the printed unit price. When the document shows tax only as a separate document-level summary (not on each line), determine whether the printed line amounts are pre-tax by checking the printed subtotal and line amounts. If the line amounts sum to the printed pre-tax subtotal, populate each lineItems.netAmount with that printed line amount, leave lineItems.taxRate and lineItems.taxAmount blank unless a line-level rate/tax is printed, and leave grossAmount blank unless a tax-inclusive line gross is explicitly printed. Preserve lineItems.amount exactly as printed for backward compatibility. Do not allocate document-level tax across individual lines or invent per-line gross amounts. If the relationship is unclear, leave netAmount blank and preserve the printed amount without guessing. Preserve a printed dash (– or —) in taxAmount exactly as printed, especially for zero-rated lines; do not replace it with 0, blank, or a guessed amount. For a zero-rate line, taxRate must be '0%' and the dash remains in taxAmount; arithmetic validation may treat that dash as zero only because the explicit rate is 0%. Populate taxableAmount as the sum of line-level net amounts when the source provides a single overall net total. For multiple tax rates, include one taxBreakdown row per distinct printed rate, each with its own rate, taxableAmount/net base, and tax amount; retain a dash for a zero-rate VAT amount. Do not merge different rates into one average rate. Preserve the original line ordering. QUANTITY/RATE STRUCTURING: When a line description contains an explicit measurable quantity and rate (for example, '5 hours @ $24.23 per hour'), extract quantity='5', unit='hours', and unitRate='$24.23' into their dedicated fields while preserving the full original description. Do not leave explicit quantities/rates embedded only in description. Preserve units exactly as printed when possible. Also split an explicit unit embedded directly in a description into quantity/unit when the quantity is separately evident, for example 'Labor 3hrs' with a matching quantity of 3 should populate unit='hrs' while retaining the full description 'Labor 3hrs'. Recognize common attached forms such as 3hrs, 2kg, 5pcs, 4 boxes, and 6 hours; do not infer a unit from context when it is not printed. For deductions/credits such as 'Minus first 15 minutes of staff time', preserve the amount with a negative sign when the printed amount is negative; never convert a deduction into a positive charge. If the source shows a negative amount but OCR makes its sign uncertain, preserve the printed row in rawText and leave uncertainty for review rather than changing the sign. Also capture EVERY separate monetary row outside the product/service table into chargeBreakdown, one row per printed label, including but not limited to shipping/freight/delivery, packing/packaging, insurance, handling, customs/duty, fees, surcharges, discounts, credits, deposits, prepayments, withholding, rounding, deposits, adjustments, other costs, tax rows and subtotals/totals. Do not collapse packing + shipping + insurance into otherCharges or one combined amount. Keep each original label and amount separately; indicate whether it appears included in the final total only when the document makes that clear. Include chargeBreakdown rows even if the heading is unfamiliar. Avoid duplicating the same charge across lineItems and chargeBreakdown unless the document presents it separately in both places; totals are not product/service line items.

RECONCILIATION AND COMPLETENESS: Extract printed subtotal/net amount, taxable base, each tax label/rate/base/amount, each additional charge, total before tax, amount paid/credit, balance due, and final invoice total into their distinct fields when present. Do not assume subtotal equals sum of product rows if the invoice includes adjustments or fees. Preserve negative signs and credits. Never calculate a missing source value as if it were printed; arithmetic checks belong to validation. If the model cannot confidently read a value, preserve the surrounding text in rawText and leave the structured field blank rather than guessing. Keep original labels in sourceLabel/sourceSection and chargeBreakdown. Include all other meaningful non-financial details in sections and documentFields.

Generic document structure rule: do not assume fixed section headings such as Billing Summary, Description, Payment Instructions, Other Comments, Charges, or Line Items. Read information by meaning, nearby labels, table headers, layout and context. Section names/order vary by issuer and country. Preserve unfamiliar headings and labels verbatim. Do not classify text as a payment instruction or tax based only on a familiar heading; use actual content. Currency and tax recognition: recognize common ISO 4217 currencies including INR (₹), USD ($), EUR (€), GBP (£), AED, CAD, AUD, CNY, JPY, SGD, CHF, SAR, MYR and ZAR. Currency symbols can be ambiguous; use printed currency code and invoice/country context, and do not guess if still ambiguous. Recognize tax labels including Indian CGST, SGST, UTGST, IGST and Cess; VAT and local variants (MwSt, TVA, IVA); US Sales Tax; Canada GST/HST/PST/QST; Australia/New Zealand GST; UAE/Saudi VAT; Japan Consumption Tax; and other printed tax labels. Preserve the exact printed label in taxLabel/taxBreakdown.label and classify only when evidence supports a category such as cgst, sgst, utgst, igst, cess, vat, sales_tax, gst, hst, pst, qst, consumption_tax or other. If the invoice has multiple taxes, capture each separately in taxBreakdown with its own printed rate, taxable base and amount. Never relabel Sales Tax as VAT or GST, never relabel VAT as Indian GST, and never infer missing tax components. Keep legacy CGST/SGST/IGST/cess fields only for those exact printed Indian GST components. If a generic tax is printed, preserve it in taxDescription/taxLabel/taxDue and taxBreakdown. Currency code should be ISO 4217 when clear; preserve original symbol in currencySymbol. Accuracy rules: read numbers carefully; do not infer a GSTIN, HSN/SAC, state code, or tax breakdown when not visible. Keep multiple line items separate. Extract currency exactly from visible symbols/codes; use "USD" for $ only when the document context supports US dollars, otherwise preserve the symbol in currencySymbol and leave currency empty if ambiguous. Never assume INR. Extract "Subtotal", "Taxable", generic "Tax rate", "Tax due", GST component taxes, "Other", and final "TOTAL" into their distinct fields. Do not treat subtotal and taxable amount as interchangeable. For generic/non-GST invoices, preserve generic tax in taxRate/taxDue/taxDescription and leave CGST/SGST/IGST/cess blank unless those fields are explicitly printed. For invoices from any country, preserve that country's tax structure without forcing it into Indian GST fields. Populate cgst/sgst/igst/cess only when those exact components are printed. For US and other non-GST invoices, use taxDescription, taxRate, and taxDue for generic taxes; leave GST component fields blank. When the invoice has a billing-summary table rather than conventional product rows, extract meaningful charge/adjustment rows into lineItems using description and amount, even if quantity and unitRate are absent. Preserve negative adjustments such as "LESS: Commitment Usage" as negative amounts. Do not duplicate subtotal/net amount/final total as additional line items. Capture the printed net amount in subtotal when it is the pre-tax net amount, and capture final total in invoiceTotal. SOURCE-TO-FIELD CONSISTENCY (mandatory for every document type): Treat the original document as the sole source of truth. Build a field-to-source map while reading: for every printed label/value pair, preserve the exact label, exact value, and section in documentFields; also populate the matching dedicated schema field when one exists. The dedicated field and documentFields entry must agree exactly (allowing only harmless whitespace normalization). Never populate a field from a nearby but semantically different label. In particular, keep document date, invoice date, due date, order date, required-by date, dispatch date, validity date, acknowledgement date and shipment dates separate. Do not use dueDate as a fallback for invoiceDate or proformaInvoiceDate, or use invoiceDate/orderDate as a fallback for another document type's primary date. Do not move identifiers between invoice/PO/EWB/challan/order/quotation/note/receipt fields. Keep supplier, buyer, bill-to, ship-to, consignee, transporter, carrier, notify party, remittance/payee and contact details distinct; never infer one party from another. Keep every address/contact/tax ID/bank/shipping/vehicle/transporter/HSN/SAC/reference/terms/signature/certification value in its own field or documentFields entry with its original printed label. For every table, preserve column meaning and row order; do not shift quantity into unit, unit into description, unit price into amount, net into gross, or tax into charges. For every monetary label, preserve its own value and sign in chargeBreakdown or the appropriate dedicated totals/tax field; do not merge distinct rows or duplicate a line amount as freight/other charge. Keep rawText as a faithful full transcription and sections as faithful section-level content; neither may be replaced by a summary. Do not silently omit characters, punctuation, leading zeros, decimal places, minus signs, percent signs, date separators, currency symbols, units, or printed dashes. If uncertain, retain the exact source text in rawText/documentFields and leave the uncertain dedicated value blank. Do not manufacture a value to make summary arithmetic or fields appear complete. The summary UI must display the extracted dedicated fields and all documentFields/sections without substituting unrelated fields; a missing dedicated value must display as missing, not as another date/number/value.

QUOTATION-SPECIFIC EXTRACTION: When the primary document is a quotation, quote, estimate or commercial offer, set documentType to Quotation and populate quotationNumber and quotationDate only from their own printed labels. Capture customer RFQ, PR and PO references separately in documentIdentifiers with the exact printed label and value; do not use them as the quotation number. Capture validUntil, quoted scope and every line item, quantity/unit, unitRate, line discount, net/gross amount, tax rate/amount, freight/installation/other charges, subtotal and final quoted total. Capture delivery lead time, payment milestones, warranty, exclusions, assumptions and acceptance/signature terms when printed. Keep unitRate numeric and store discount separately. Preserve optional or absent fields as empty; do not invent validity, warranty, payment or delivery terms. For every line item, keep unitRate strictly numeric and capture any line-specific discount in the separate discount field. Never append text such as '-Discount 10%' to unitRate. Preserve the discount amount or percentage and its printed wording in discount; keep document-level discounts in chargeBreakdown separately. Before returning JSON, perform a completeness pass against the source document: (1) revisit every page and section; (2) compare every visible row containing an amount with lineItems or chargeBreakdown or a totals/tax field; (3) ensure separate shipping, packing, insurance, discounts and other fee rows are individually captured; (4) ensure rawText contains all readable text, not just key fields; (5) check that no description has been shortened or paraphrased. If any visible monetary row is not represented in a structured field, add it to chargeBreakdown with its original label. If a field is not present, return an empty string.`;

const CHEQUE_PROMPT = `You are a careful cheque data extraction system. Read the supplied cheque image/PDF. Return ONLY valid JSON, no markdown. Never invent missing values; use empty strings for unknown values. Preserve the printed/written text as visible. Fields:
{"documentType":"Cheque","bankName":"","branch":"","chequeNumber":"","chequeDate":"","payee":"","amountFigures":"","amountWords":"","accountNumberMaskedOrVisible":"","ifsc":"","micr":"","drawerName":"","rawText":""}
Do not guess obscured digits. If handwriting is unclear, leave that field empty and mention uncertainty in rawText. Preserve the complete MICR line exactly as one raw string in micr. Do not split MICR digits into chequeNumber, accountNumberMaskedOrVisible, IFSC, branch or bank codes, and do not infer or validate MICR components unless the document separately labels them. Keep chequeNumber and accountNumberMaskedOrVisible sourced only from their own printed labels/fields. Preserve date digits as seen; when the date is an unseparated eight-digit DDMMYYYY value, return it in DD/MM/YYYY format only when day, month and year are unambiguous. Preserve the numeric amountFigures value without adding a currency symbol; currency display is handled by the review/export layer. Treat cheque data as sensitive.`;

async function verifyAndConsumePermit(request, env, input) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY || !env.TRIAL_HASH_SECRET) {
    return { error: "Secure extraction authorization is not configured in this Preview.", status: 503 };
  }
  const bearer = request.headers.get("authorization") || "";
  const accessToken = bearer.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return { error: "Please sign in before extracting a document.", status: 401 };

  const userResponse = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user", {
    headers: { apikey: env.SUPABASE_ANON_KEY, authorization: "Bearer " + accessToken }
  });
  if (!userResponse.ok) return { error: "Your session has expired. Please sign in again.", status: 401 };
  const user = await userResponse.json();
  if (!user?.id || !user.email_confirmed_at) return { error: "Verify your email before extracting documents.", status: 403 };

  const parts = typeof input.permit === "string" ? input.permit.split(".") : [];
  if (parts.length !== 2) return { error: "A valid extraction allowance is required. Please retry from the workspace.", status: 403 };
  let payload;
  try {
    const decode = value => atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4));
    const raw = decode(parts[0]);
    payload = JSON.parse(raw);
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.TRIAL_HASH_SECRET), {name:"HMAC",hash:"SHA-256"}, false, ["verify"]);
    const signature = Uint8Array.from(decode(parts[1]), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, signature, new TextEncoder().encode(parts[0]));
    if (!valid) return { error: "Extraction authorization could not be verified.", status: 403 };
  } catch {
    return { error: "Extraction authorization is invalid. Please reserve tokens again.", status: 403 };
  }

  if (payload.userId !== user.id || payload.mode !== input.mode ||
      payload.pageCount !== input.pageCount || !Number.isInteger(payload.pageCount) ||
      payload.pageCount < 1 || payload.pageCount > 20 ||
      !/^[a-f0-9]{64}$/.test(payload.fileSha256 || "") ||
      !Number.isFinite(payload.exp) || payload.exp < Date.now()) {
    return { error: "This extraction authorization has expired or does not match the selected document.", status: 403 };
  }

  let binary;
  try { binary = atob(input.base64); } catch { return { error: "The uploaded document data is invalid.", status: 400 }; }
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const actualHash = [...hash].map(b => b.toString(16).padStart(2, "0")).join("");
  if (actualHash !== payload.fileSha256) return { error: "The selected file changed after token reservation. Please retry.", status: 403 };

  // Admin permits are HMAC-signed, short-lived and bound to the verified admin user and exact file.
  // They intentionally skip customer permit-table consumption and all device/IP trial checks.
  if (payload.admin === true && payload.userEmail === "noreply@conficel.com" &&
      (user.email || "").trim().toLowerCase() === "noreply@conficel.com") {
    return { userId: user.id, admin: true };
  }

  const base = env.SUPABASE_URL.replace(/\/$/, "");
  const now = new Date().toISOString();
  const url = base + "/rest/v1/extraction_permits?jti=eq." + encodeURIComponent(payload.jti) +
    "&user_id=eq." + encodeURIComponent(user.id) +
    "&file_sha256=eq." + payload.fileSha256 +
    "&mode=eq." + payload.mode +
    "&page_count=eq." + payload.pageCount +
    "&used_at=is.null&expires_at=gt." + encodeURIComponent(now);
  const consume = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
      "content-type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({ used_at: now })
  });
  const rows = await consume.json().catch(() => []);
  if (!consume.ok || !Array.isArray(rows) || rows.length !== 1) {
    return { error: "This extraction authorization has already been used or expired. Reserve tokens again.", status: 403 };
  }
  return { userId: user.id };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.OPENAI_API_KEY) {
    return jsonResponse({ error: "OpenAI is not configured. Add OPENAI_API_KEY as a server-side secret in Cloudflare Pages Preview settings." }, 503);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: "Request must be valid JSON." }, 400);
  }

  const { fileName = "document", mimeType, base64, mode = "invoice", permit, pageCount } = input || {};
  if (typeof base64 !== "string" || !base64 || !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    return jsonResponse({ error: "Please provide a PDF, JPG, PNG or WEBP document." }, 400);
  }
  const estimatedBytes = Math.floor(base64.length * 3 / 4);
  if (estimatedBytes > MAX_FILE_BYTES) return jsonResponse({ error: "File is larger than the 10 MB test limit." }, 413);
  if (!["invoice", "cheque", "quotation", "other"].includes(mode)) return jsonResponse({ error: "Please select a supported document type." }, 400);
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 20) return jsonResponse({ error: "A valid document page count is required." }, 400);

  const model = typeof env.OPENAI_MODEL === "string" ? env.OPENAI_MODEL.trim() : "";
  if (!model) {
    return jsonResponse({ error: "OpenAI is not fully configured. Add OPENAI_MODEL as a server-side Cloudflare Pages Preview variable, using a model enabled for your OpenAI API project." }, 503);

  }
  const authorization = await verifyAndConsumePermit(request, env, { permit, pageCount, mode, base64 });
  if (authorization.error) return jsonResponse({ error: authorization.error }, authorization.status);

  const modeInstruction = mode === "quotation"
    ? "\\nSELECTED WORKFLOW: QUOTATION. Apply quotation-specific extraction: quotationNumber and quotationDate from their own labels; capture validUntil, customer RFQ/PR/PO references separately, every quoted line item, quantity/unit/rate, discounts, charges, taxes, subtotal and final quoted total, delivery lead time, payment milestones, warranty, exclusions, assumptions and acceptance terms. Do not substitute invoiceNumber for quotationNumber."
    : mode === "other"
      ? "\\nSELECTED WORKFLOW: OTHER BUSINESS DOCUMENT. Identify the actual primary document type from its title and purpose. Use the matching dedicated schema fields and routing rules for Purchase Order, Proforma Invoice, E-Way Bill, Delivery Challan, Sales Order, Credit/Debit Note, GRN, Packing List, transport document, RFQ, Requisition, Work Order, Receipt or another supported type. Do not force it into an invoice. Preserve printed identifiers in documentIdentifiers/documentFields."
      : "";
  const prompt = (mode === "cheque" ? CHEQUE_PROMPT : INVOICE_PROMPT) +
    modeInstruction +
    "\\nOriginal filename (for reference only): " + String(fileName).slice(0, 160) +
    "\\nReturn a single JSON object only. Do not use markdown fences.";

  const documentPart = mimeType === "application/pdf"
    ? { type: "input_file", filename: String(fileName).slice(0, 160) || "document.pdf", file_data: "data:application/pdf;base64," + base64 }
    : { type: "input_image", image_url: "data:" + mimeType + ";base64," + base64, detail: "high" };

  let response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer " + env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model,
        store: false,
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            documentPart
          ]
        }],
        text: { format: { type: "json_object" } },
        max_output_tokens: 8192
      })
    });
  } catch {
    return jsonResponse({ error: "Could not reach OpenAI. Please try again." }, 502);
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerMessage = typeof result?.error?.message === "string"
      ? result.error.message.replace(/[\r\n\t]+/g, " ").slice(0, 500)
      : "No error detail was returned by OpenAI.";
    const userMessage = response.status === 429
      ? "OpenAI rate limit or quota reached. Check API billing, project limits and usage, then retry."
      : response.status === 400
        ? "OpenAI rejected the request. Check the model, file format and request payload."
        : response.status === 401 || response.status === 403
          ? "OpenAI rejected the API key or its permissions. Check the Preview secret and API project access."
          : "OpenAI provider request failed.";
    return jsonResponse({
      error: userMessage,
      providerStatus: response.status,
      providerMessage,
      model
    }, 502);
  }

  // The Responses API normally provides output_text, but also inspect output content
  // blocks so a valid text response is not lost if the convenience field is absent.
  const outputBlocks = Array.isArray(result.output)
    ? result.output.flatMap(item => Array.isArray(item.content) ? item.content : [])
    : [];
  const text = (typeof result.output_text === "string" ? result.output_text : "")
    .trim() || outputBlocks
      .filter(item => item && (item.type === "output_text" || item.type === "text") && typeof item.text === "string")
      .map(item => item.text)
      .join("\n")
      .trim();

  if (!text) {
    const refusal = outputBlocks.some(item => item && item.type === "refusal");
    const incomplete = result.status === "incomplete";
    const details = refusal
      ? "The model declined the request. Try another document or review the request."
      : incomplete
        ? "The model response was incomplete. Retry once; if it repeats, reduce the document size or raise the output limit."
        : "OpenAI returned a successful HTTP response but no text content. The response format may have changed.";
    return jsonResponse({
      error: "Could not read extraction text from the OpenAI response.",
      details,
      responseStatus: result.status || "unknown",
      incompleteReason: result.incomplete_details?.reason || null,
      outputItemTypes: Array.isArray(result.output) ? result.output.map(item => item.type || "unknown") : [],
      model,
      providerStatus: response.status
    }, 502);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return jsonResponse({ error: "OpenAI response was not valid JSON. Please retry.", model }, 502);
  }

  return jsonResponse({
    ok: true,
    provider: "OpenAI",
    model,
    mode,
    fileName: String(fileName).slice(0, 160),
    usage: result.usage ? {
      inputTokens: result.usage.input_tokens ?? null,
      outputTokens: result.usage.output_tokens ?? null,
      totalTokens: result.usage.total_tokens ?? null
    } : null,
    extracted: data,
    note: "AI extraction is a best-effort result. Verify every field, especially amounts, tax values, dates and cheque digits, before use."
  });
}
