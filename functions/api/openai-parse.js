const MAX_FILE_BYTES = 10 * 1024 * 1024;

const INVOICE_PROMPT = `You are a careful business-document data extraction system. Read the supplied invoice or proforma invoice image/PDF directly. Return ONLY valid JSON, no markdown. Never invent missing values; use empty strings for unknown scalar fields and [] for unknown line items. Preserve values as printed, including date format and currency. Distinguish supplier from buyer and consignee. Do not mistake website text, headings, or terms for invoice numbers. Extract every visible line item separately. Include rawText with the readable text you can identify. Fields:
{
  "documentType": "Invoice | Proforma Invoice | Credit Note | Debit Note | Other",
  "invoiceNumber": "", "invoiceDate": "", "dueDate": "",
  "waybillNumber": "", "billOfLadingNumber": "", "shipmentReference": "", "trackingNumber": "",
  "supplier": "", "supplierGSTIN": "", "supplierAddress": "", "supplierContact": "",
  "buyerCustomer": "", "buyerGSTIN": "", "buyerAddress": "",
  "consigneeShipTo": "", "state": "", "stateCode": "", "purchaseOrderNumber": "",
  "currency": "", "currencySymbol": "", "currencyEvidence": "", "countryOrJurisdiction": "",
  "lineItems": [{"description":"","hsnSac":"","quantity":"","unit":"","unitRate":"","amount":"","taxable":"","sourceLabel":"","sourceSection":""}],
  "chargeBreakdown": [{"label":"","amount":"","currency":"","type":"","includedInTotal":"","sourceSection":""}],
  "subtotal": "", "taxableAmount": "",
  "taxRate": "", "taxDue": "", "taxDescription": "", "taxLabel": "", "taxCategory": "", "taxBreakdown": [{"label":"","category":"","rate":"","taxableAmount":"","amount":""}],
  "cgst": "", "sgst": "", "igst": "", "cess": "", "totalTax": "",
  "otherCharges": "", "freightCharges": "", "invoiceTotal": "",
  "invoiceTotalInWords": "", "paymentTerms": "", "deliveryTerms": "", "additionalCosts": "",
  "sections": [{"heading":"","content":""}], "documentFields": [{"label":"","value":"","section":""}],
  "rawText": ""
}
DOCUMENT IDENTIFIER DICTIONARY: Recognize and preserve document/reference identifiers even when they are not invoice numbers. The identifier dictionary includes invoice number/no./#, proforma invoice number, credit note number, debit note number, purchase order/PO number, waybill number/no., air waybill/AWB number, bill of lading/BOL number, shipment reference, consignment note number, tracking number, delivery note number, dispatch note number, order reference, customer reference, and payment reference. Keep each identifier in its own matching field when available (for example waybillNumber, billOfLadingNumber, shipmentReference, trackingNumber, purchaseOrderNumber, invoiceNumber) and also preserve the exact printed label and value in documentFields. Never substitute one identifier type for another: a waybill number is not automatically an invoice number, and a certification date is not automatically the invoice date. If a known identifier type is not yet represented by a dedicated field, retain it in documentFields with its original label and value rather than dropping it.\n\nMANDATORY FULL-DOCUMENT CAPTURE (core requirement): Treat this as a document digitization job, not a short invoice summary. Inspect EVERY page and read the document from top to bottom and left to right, including headers, footers, side panels, tables, small print, notes, payment blocks, signatures/certifications, and text near logos or QR codes. Do not stop after identifying the supplier, one service/product table, or the invoice total. Capture every legible word and every meaningful printed value. Populate rawText with the fullest faithful transcription of all readable source text, preserving original wording, labels, number formats, signs, dates, and currency symbols; do not replace it with a summary. If the document is multi-page, include content from every page. Never silently omit content because it does not fit the standard schema.

LINE ITEMS VS OTHER AMOUNTS: Extract every product/service row as its own lineItems entry, retaining full descriptions, model/SKU/reference, quantity, unit, unit price, discounts and line amount when printed. QUANTITY/RATE STRUCTURING: When a line description contains an explicit measurable quantity and rate (for example, '5 hours @ $24.23 per hour'), extract quantity='5', unit='hours', and unitRate='$24.23' into their dedicated fields while preserving the full original description. Do not leave explicit quantities/rates embedded only in description. Preserve units exactly as printed when possible. For deductions/credits such as 'Minus first 15 minutes of staff time', preserve the amount with a negative sign when the printed amount is negative; never convert a deduction into a positive charge. If the source shows a negative amount but OCR makes its sign uncertain, preserve the printed row in rawText and leave uncertainty for review rather than changing the sign. Also capture EVERY separate monetary row outside the product/service table into chargeBreakdown, one row per printed label, including but not limited to shipping/freight/delivery, packing/packaging, insurance, handling, customs/duty, fees, surcharges, discounts, credits, deposits, prepayments, withholding, rounding, deposits, adjustments, other costs, tax rows and subtotals/totals. Do not collapse packing + shipping + insurance into otherCharges or one combined amount. Keep each original label and amount separately; indicate whether it appears included in the final total only when the document makes that clear. Include chargeBreakdown rows even if the heading is unfamiliar. Avoid duplicating the same charge across lineItems and chargeBreakdown unless the document presents it separately in both places; totals are not product/service line items.

RECONCILIATION AND COMPLETENESS: Extract printed subtotal/net amount, taxable base, each tax label/rate/base/amount, each additional charge, total before tax, amount paid/credit, balance due, and final invoice total into their distinct fields when present. Do not assume subtotal equals sum of product rows if the invoice includes adjustments or fees. Preserve negative signs and credits. Never calculate a missing source value as if it were printed; arithmetic checks belong to validation. If the model cannot confidently read a value, preserve the surrounding text in rawText and leave the structured field blank rather than guessing. Keep original labels in sourceLabel/sourceSection and chargeBreakdown. Include all other meaningful non-financial details in sections and documentFields.

Generic document structure rule: do not assume fixed section headings such as Billing Summary, Description, Payment Instructions, Other Comments, Charges, or Line Items. Read information by meaning, nearby labels, table headers, layout and context. Section names/order vary by issuer and country. Preserve unfamiliar headings and labels verbatim. Do not classify text as a payment instruction or tax based only on a familiar heading; use actual content. Currency and tax recognition: recognize common ISO 4217 currencies including INR (₹), USD ($), EUR (€), GBP (£), AED, CAD, AUD, CNY, JPY, SGD, CHF, SAR, MYR and ZAR. Currency symbols can be ambiguous; use printed currency code and invoice/country context, and do not guess if still ambiguous. Recognize tax labels including Indian CGST, SGST, UTGST, IGST and Cess; VAT and local variants (MwSt, TVA, IVA); US Sales Tax; Canada GST/HST/PST/QST; Australia/New Zealand GST; UAE/Saudi VAT; Japan Consumption Tax; and other printed tax labels. Preserve the exact printed label in taxLabel/taxBreakdown.label and classify only when evidence supports a category such as cgst, sgst, utgst, igst, cess, vat, sales_tax, gst, hst, pst, qst, consumption_tax or other. If the invoice has multiple taxes, capture each separately in taxBreakdown with its own printed rate, taxable base and amount. Never relabel Sales Tax as VAT or GST, never relabel VAT as Indian GST, and never infer missing tax components. Keep legacy CGST/SGST/IGST/cess fields only for those exact printed Indian GST components. If a generic tax is printed, preserve it in taxDescription/taxLabel/taxDue and taxBreakdown. Currency code should be ISO 4217 when clear; preserve original symbol in currencySymbol. Accuracy rules: read numbers carefully; do not infer a GSTIN, HSN/SAC, state code, or tax breakdown when not visible. Keep multiple line items separate. Extract currency exactly from visible symbols/codes; use "USD" for $ only when the document context supports US dollars, otherwise preserve the symbol in currencySymbol and leave currency empty if ambiguous. Never assume INR. Extract "Subtotal", "Taxable", generic "Tax rate", "Tax due", GST component taxes, "Other", and final "TOTAL" into their distinct fields. Do not treat subtotal and taxable amount as interchangeable. For generic/non-GST invoices, preserve generic tax in taxRate/taxDue/taxDescription and leave CGST/SGST/IGST/cess blank unless those fields are explicitly printed. For invoices from any country, preserve that country's tax structure without forcing it into Indian GST fields. Populate cgst/sgst/igst/cess only when those exact components are printed. For US and other non-GST invoices, use taxDescription, taxRate, and taxDue for generic taxes; leave GST component fields blank. When the invoice has a billing-summary table rather than conventional product rows, extract meaningful charge/adjustment rows into lineItems using description and amount, even if quantity and unitRate are absent. Preserve negative adjustments such as "LESS: Commitment Usage" as negative amounts. Do not duplicate subtotal/net amount/final total as additional line items. Capture the printed net amount in subtotal when it is the pre-tax net amount, and capture final total in invoiceTotal. Before returning JSON, perform a completeness pass against the source document: (1) revisit every page and section; (2) compare every visible row containing an amount with lineItems or chargeBreakdown or a totals/tax field; (3) ensure separate shipping, packing, insurance, discounts and other fee rows are individually captured; (4) ensure rawText contains all readable text, not just key fields; (5) check that no description has been shortened or paraphrased. If any visible monetary row is not represented in a structured field, add it to chargeBreakdown with its original label. If a field is not present, return an empty string.`;

const CHEQUE_PROMPT = `You are a careful cheque data extraction system. Read the supplied cheque image/PDF. Return ONLY valid JSON, no markdown. Never invent missing values; use empty strings for unknown values. Preserve the printed/written text as visible. Fields:
{"documentType":"Cheque","bankName":"","branch":"","chequeNumber":"","chequeDate":"","payee":"","amountFigures":"","amountWords":"","accountNumberMaskedOrVisible":"","ifsc":"","micr":"","drawerName":"","rawText":""}
Do not guess obscured digits. If handwriting is unclear, leave that field empty and mention uncertainty in rawText. Treat cheque data as sensitive.`;

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

  const { fileName = "document", mimeType, base64, mode = "invoice" } = input || {};
  if (typeof base64 !== "string" || !base64 || !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    return jsonResponse({ error: "Please provide a PDF, JPG, PNG or WEBP document." }, 400);
  }
  const estimatedBytes = Math.floor(base64.length * 3 / 4);
  if (estimatedBytes > MAX_FILE_BYTES) return jsonResponse({ error: "File is larger than the 10 MB test limit." }, 413);
  if (mode !== "invoice" && mode !== "cheque") return jsonResponse({ error: "Mode must be invoice or cheque." }, 400);

  const model = env.OPENAI_MODEL || "gpt-6-luna";
  const prompt = (mode === "cheque" ? CHEQUE_PROMPT : INVOICE_PROMPT) +
    "\nOriginal filename (for reference only): " + String(fileName).slice(0, 160) +
    "\nReturn a single JSON object only. Do not use markdown fences.";

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
