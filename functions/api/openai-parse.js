const MAX_FILE_BYTES = 10 * 1024 * 1024;

const INVOICE_PROMPT = `You are a careful business-document data extraction system. Read the supplied invoice or proforma invoice image/PDF directly. Return ONLY valid JSON, no markdown. Never invent missing values; use empty strings for unknown scalar fields and [] for unknown line items. Preserve values as printed, including date format and currency. Distinguish supplier from buyer and consignee. Do not mistake website text, headings, or terms for invoice numbers. Extract every visible line item separately. Include rawText with the readable text you can identify. Fields:
{
  "documentType": "Invoice | Proforma Invoice | Credit Note | Debit Note | Other",
  "invoiceNumber": "", "invoiceDate": "", "dueDate": "",
  "supplier": "", "supplierGSTIN": "", "supplierAddress": "", "supplierContact": "",
  "buyerCustomer": "", "buyerGSTIN": "", "buyerAddress": "",
  "consigneeShipTo": "", "state": "", "stateCode": "", "purchaseOrderNumber": "",
  "currency": "", "currencySymbol": "",
  "lineItems": [{"description":"","hsnSac":"","quantity":"","unit":"","unitRate":"","amount":"","taxable":""}],
  "subtotal": "", "taxableAmount": "",
  "taxRate": "", "taxDue": "", "taxDescription": "",
  "cgst": "", "sgst": "", "igst": "", "cess": "", "totalTax": "",
  "otherCharges": "", "freightCharges": "", "invoiceTotal": "",
  "invoiceTotalInWords": "", "paymentTerms": "", "deliveryTerms": "", "additionalCosts": "",
  "rawText": ""
}
Accuracy rules: read numbers carefully; do not infer a GSTIN, HSN/SAC, state code, or tax breakdown when not visible. Keep multiple line items separate. Extract currency exactly from visible symbols/codes; use "USD" for $ only when the document context supports US dollars, otherwise preserve the symbol in currencySymbol and leave currency empty if ambiguous. Never assume INR. Extract "Subtotal", "Taxable", generic "Tax rate", "Tax due", GST component taxes, "Other", and final "TOTAL" into their distinct fields. Do not treat subtotal and taxable amount as interchangeable. For generic/non-GST invoices, preserve generic tax in taxRate/taxDue/taxDescription and leave CGST/SGST/IGST/cess blank unless those fields are explicitly printed. If a field is not present, return an empty string.`;

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
