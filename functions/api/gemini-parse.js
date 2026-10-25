const MAX_FILE_BYTES = 10 * 1024 * 1024;

const INVOICE_PROMPT = `You are a careful business-document data extraction system. Read the supplied invoice or proforma invoice image/PDF directly. Return ONLY valid JSON, no markdown. Never invent missing values; use empty strings for unknown scalar fields and [] for unknown line items. Preserve values as printed, including date format and currency. Distinguish supplier from buyer and consignee. Do not mistake website text, headings, or terms for invoice numbers. Extract every visible line item separately. Include rawText with the readable text you can identify. Fields:
{
  "documentType": "Invoice | Proforma Invoice | Credit Note | Debit Note | Other",
  "invoiceNumber": "", "invoiceDate": "", "dueDate": "",
  "supplier": "", "supplierGSTIN": "", "supplierAddress": "", "supplierContact": "",
  "buyerCustomer": "", "buyerGSTIN": "", "buyerAddress": "",
  "consigneeShipTo": "", "state": "", "stateCode": "", "purchaseOrderNumber": "",
  "lineItems": [{"description":"","hsnSac":"","quantity":"","unit":"","unitRate":"","amount":"","taxable":""}],
  "taxableAmount": "", "cgst": "", "sgst": "", "igst": "", "cess": "",
  "totalTax": "", "otherCharges": "", "freightCharges": "", "invoiceTotal": "",
  "invoiceTotalInWords": "", "paymentTerms": "", "deliveryTerms": "", "additionalCosts": "",
  "rawText": ""
}
Accuracy rules: read numbers carefully; do not infer a GSTIN, HSN/SAC, state code, or tax breakdown when not visible. Keep multiple line items separate. If the invoice has subtotal and final total, report each in the correct field. If a field is not present, return an empty string.`;

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
  if (!env.GEMINI_API_KEY) {
    return jsonResponse({ error: "Gemini is not configured. Add GEMINI_API_KEY as a server-side secret in Cloudflare Pages." }, 503);
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

  const model = env.GEMINI_MODEL || "gemini-3.8-flash";
  const prompt = mode === "cheque" ? CHEQUE_PROMPT : INVOICE_PROMPT;
  const payload = {
    contents: [{
      role: "user",
      parts: [
        { text: prompt + "\nOriginal filename (for reference only): " + String(fileName).slice(0, 160) },
        { inline_data: { mime_type: mimeType, data: base64 } }
      ]
    }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0,
      maxOutputTokens: 8192
    }
  };

  async function callModel(modelName) {
    return fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(modelName) + ":generateContent", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify(payload)
    });
  }

  let response;
  let usedModel = model;
  try {
    // Retry temporary Google 503 overloads: initial request, then waits of 2s and 4s.
    response = await callModel(model);
    if (response.status === 503) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      response = await callModel(model);
    }
    if (response.status === 503) {
      await new Promise(resolve => setTimeout(resolve, 4000));
      response = await callModel(model);
    }

    // Optional fallback: set GEMINI_FALLBACK_MODEL in Preview secrets/variables
    // only after confirming that model is available to this API key.
    if (response.status === 503 && env.GEMINI_FALLBACK_MODEL && env.GEMINI_FALLBACK_MODEL !== model) {
      usedModel = env.GEMINI_FALLBACK_MODEL;
      response = await callModel(usedModel);
    }
  } catch {
    return jsonResponse({ error: "Could not reach Gemini. Please try again." }, 502);
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerMessage = typeof result?.error?.message === "string"
      ? result.error.message.replace(/[\r\n\t]+/g, " ").slice(0, 500)
      : "No error detail was returned by Google.";
    const userMessage = response.status === 429
      ? "Gemini quota or rate limit reached. Check Google AI Studio quota/billing, then retry."
      : response.status === 400
        ? "Gemini rejected the request. Check the model name and document payload."
        : response.status === 401 || response.status === 403
          ? "Gemini rejected the API key or its permissions. Check the key and API access."
          : response.status === 404
            ? "Gemini model was not found. Check GEMINI_MODEL."
            : "Gemini provider request failed.";
    return jsonResponse({
      error: userMessage,
      providerStatus: response.status,
      providerMessage,
      model: usedModel
    }, 502);
  }

  const text = result?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("").trim();
  if (!text) {
    const finishReason = result?.candidates?.[0]?.finishReason || "";
    return jsonResponse({
      error: "Gemini returned no extractable response. Try a clearer or smaller document.",
      finishReason,
      model: usedModel: usedModel
    }, 502);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return jsonResponse({ error: "Gemini response was not valid JSON. Please retry.", model: usedModel }, 502);
  }

  return jsonResponse({
    ok: true,
    model: usedModel,
    mode,
    fileName: String(fileName).slice(0, 160),
    extracted: data,
    note: "AI extraction is a best-effort result. Verify every field, especially amounts, tax values, dates and cheque digits, before use."
  });
}
