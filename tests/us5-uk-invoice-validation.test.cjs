const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sandbox = { window: {}, console };
sandbox.globalThis = sandbox;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "invoice-validation.js"), "utf8"), sandbox);
const validation = sandbox.window.ConfiCelInvoiceValidation;
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "us5-uk-invoice.json"), "utf8"));

test("US5 UK invoice has four separate line items with no VAT/net/gross mismatches", () => {
  const checks = validation.validateUkLineItems(fixture);
  assert.equal(fixture.extracted.lineItems.length, 4);
  assert.ok(checks.length >= 19);
  assert.deepEqual(checks.filter(c => !c.ok).map(c => c.name), []);
});

test("US5 reconciles multi-rate VAT bases and amounts", () => {
  const checks = validation.validateUkLineItems(fixture);
  for (const name of ["VAT taxable base at 20%", "VAT amount at 20%", "VAT taxable base at 0%", "VAT amount at 0%", "Multi-rate VAT bases vs overall taxable amount", "Multi-rate VAT total"]) {
    assert.equal(checks.find(c => c.name === name)?.ok, true, name);
  }
  assert.equal(validation.money(fixture.extracted.taxBreakdown[1].amount), null);
  assert.equal(fixture.extracted.taxBreakdown[1].amount, "–");
  assert.equal(fixture.extracted.lineItems[3].taxAmount, "–");
});

test("US5 preserves blank supplier template placeholders", () => {
  const d = fixture.extracted;
  assert.equal(d.supplier, "");
  assert.equal(d.supplierAddress, "");
  assert.equal(d.supplierContact, "");
  assert.ok(d.documentFields.filter(f => f.section === "Footer placeholder").every(f => f.value === ""));
});

test("US5 rejects a deliberately incorrect VAT amount", () => {
  const bad = structuredClone(fixture);
  bad.extracted.lineItems[0].taxAmount = "£241.00";
  const checks = validation.validateUkLineItems(bad);
  assert.ok(checks.some(c => c.name.includes("Professional services") && c.name.endsWith("VAT calculation") && !c.ok));
});
test("US5 OpenAI prompt requires distinct net, VAT, tax and gross line fields", () => {
  const apiSource = fs.readFileSync(path.join(__dirname, "..", "functions", "api", "openai-parse.js"), "utf8");
  for (const field of ["netAmount", "taxRate", "taxAmount", "grossAmount"]) {
    assert.ok(apiSource.includes('"' + field + '"'), "schema includes " + field);
  }
  assert.ok(apiSource.includes("Preserve a printed dash"));
  assert.ok(apiSource.includes("Do not merge different rates into one average rate"));
  assert.ok(apiSource.includes("TEMPLATE PLACEHOLDERS"));
});



test("US5 preview renders quantity without an empty unit placeholder", () => {
  const page = fs.readFileSync(path.join(__dirname, "..", "openai-test.html"), "utf8");
  assert.ok(page.includes("String(it.unit||'').trim()?' '+val(it.unit):''"));
});

test("US5 preview deduplicates identical document fields", () => {
  const page = fs.readFileSync(path.join(__dirname, "..", "openai-test.html"), "utf8");
  assert.ok(page.includes("new Map(d.documentFields.map(f=>[String(f.section||'')+'|'+String(f.label||'').trim().toLowerCase()+'|'+String(f.value||'').trim(),f]))"));
});

test("US5 preview distinguishes amount summary rows from extra charges", () => {
  const page = fs.readFileSync(path.join(__dirname, "..", "openai-test.html"), "utf8");
  assert.ok(page.includes("'Amount summary rows':'Additional charges and amount rows'"));
  assert.ok(page.includes("add('Amount summary rows'"));
});

test("US5 recognizes purchase orders and uses PO-specific required fields", () => {
  const apiSource = fs.readFileSync(path.join(__dirname, "..", "functions", "api", "openai-parse.js"), "utf8");
  const page = fs.readFileSync(path.join(__dirname, "..", "openai-test.html"), "utf8");
  assert.ok(apiSource.includes("Purchase Order"));
  assert.ok(apiSource.includes('"orderDate"'));
  assert.ok(apiSource.includes('"requiredByDate"'));
  assert.ok(page.includes("isPurchaseOrder"));
  assert.ok(page.includes("Required-by date"));
  assert.ok(page.includes("PURCHASE ORDER"));
  assert.ok(page.includes("Required field: '+name"));
});

test("US5 routes common business document types to their own identifier fields", () => {
  const routerSandbox = { window: {} };
  routerSandbox.globalThis = routerSandbox;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "document-type-router.js"), "utf8"), routerSandbox);
  const classify = routerSandbox.window.ConfiCelDocumentRouter.classifyDocument;
  const cases = [
    [{ documentType: "Purchase Order", purchaseOrderNumber: "PO-77" }, "Purchase Order", "purchaseOrderNumber"],
    [{ documentType: "Tax Invoice", invoiceNumber: "INV-88" }, "Tax Invoice", "invoiceNumber"],
    [{ documentType: "Proforma Invoice", proformaInvoiceNumber: "PI-9" }, "Proforma Invoice", "proformaInvoiceNumber"],
    [{ documentType: "E-Way Bill", ewayBillNumber: "EWB-22", invoiceNumber: "INV-22" }, "E-Way Bill", "ewayBillNumber"],
    [{ documentType: "Delivery Challan", deliveryChallanNumber: "DC-4" }, "Delivery Challan", "deliveryChallanNumber"],
    [{ documentType: "Credit Note", creditNoteNumber: "CN-2" }, "Credit Note", "creditNoteNumber"],
    [{ documentType: "Debit Note", debitNoteNumber: "DN-2" }, "Debit Note", "debitNoteNumber"],
    [{ documentType: "Goods Receipt Note", goodsReceiptNumber: "GRN-1" }, "Goods Receipt Note", "goodsReceiptNumber"],
    [{ documentType: "Sales Order", salesOrderNumber: "SO-1" }, "Sales Order", "salesOrderNumber"],
    [{ documentType: "Quotation", quotationNumber: "Q-1" }, "Quotation", "quotationNumber"],
    [{ documentType: "Request for Quotation", rfqNumber: "RFQ-1" }, "Request for Quotation", "rfqNumber"],
    [{ documentType: "Purchase Requisition", purchaseRequisitionNumber: "PR-1" }, "Purchase Requisition", "purchaseRequisitionNumber"],
    [{ documentType: "Work Order", workOrderNumber: "WO-1" }, "Work Order", "workOrderNumber"],
    [{ documentType: "Gate Pass", gatePassNumber: "GP-1" }, "Gate Pass", "gatePassNumber"],
    [{ documentType: "Delivery Receipt", deliveryReceiptNumber: "POD-1" }, "Delivery Receipt", "deliveryReceiptNumber"],
    [{ documentType: "Air Waybill", airWaybillNumber: "AWB-1" }, "Air Waybill", "airWaybillNumber"],
    [{ documentType: "Bill of Lading", billOfLadingNumber: "BL-1" }, "Bill of Lading", "billOfLadingNumber"]
  ];
  for (const [doc, expectedType, expectedField] of cases) {
    const route = classify({ extracted: doc });
    assert.equal(route.type, expectedType);
    assert.equal(route.identifierField, expectedField);
  }
});

test("US5 does not mistake a linked PO reference on an invoice for the primary document type", () => {
  const routerSandbox = { window: {} };
  routerSandbox.globalThis = routerSandbox;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "document-type-router.js"), "utf8"), routerSandbox);
  const route = routerSandbox.window.ConfiCelDocumentRouter.classifyDocument({ extracted: {
    documentType: "Tax Invoice", invoiceNumber: "INV-100", purchaseOrderNumber: "PO-100",
    rawText: "TAX INVOICE\\nInvoice No: INV-100\\nPurchase Order No: PO-100"
  }});
  assert.equal(route.type, "Tax Invoice");
  assert.equal(route.identifierField, "invoiceNumber");
});


test("US5 routes the supplied Proforma Invoice identifier and date to the summary fields", () => {
  const routerSandbox = { window: {} };
  routerSandbox.globalThis = routerSandbox;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "document-type-router.js"), "utf8"), routerSandbox);
  const route = routerSandbox.window.ConfiCelDocumentRouter.classifyDocument({ extracted: {
    documentType: "Proforma Invoice",
    proformaInvoiceNumber: "US-001",
    proformaInvoiceDate: "11/02/2019",
    invoiceNumber: "",
    invoiceDate: "",
    purchaseOrderNumber: "2312/2019"
  }});
  assert.equal(route.type, "Proforma Invoice");
  assert.equal(route.identifierField, "proformaInvoiceNumber");
  assert.equal(route.identifierValue, "US-001");
  assert.equal(route.dateValue, "11/02/2019");
});

test("US5 can recover a Proforma Invoice number from typed document identifiers", () => {
  const routerSandbox = { window: {} };
  routerSandbox.globalThis = routerSandbox;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "document-type-router.js"), "utf8"), routerSandbox);
  const route = routerSandbox.window.ConfiCelDocumentRouter.classifyDocument({ extracted: {
    documentType: "Proforma Invoice",
    proformaInvoiceNumber: "",
    documentIdentifiers: [{ type: "Proforma Invoice Number", label: "INVOICE #", value: "US-001" }]
  }});
  assert.equal(route.identifierValue, "US-001");
});

test("US5 extraction prompt maps document-level-tax line amounts to net only when subtotal reconciles", () => {
  const apiSource = fs.readFileSync(path.join(__dirname, "..", "functions", "api", "openai-parse.js"), "utf8");
  assert.ok(apiSource.includes("printed line amounts sum to the printed pre-tax subtotal"));
  assert.ok(apiSource.includes("Do not allocate document-level tax across individual lines"));
  assert.ok(apiSource.includes("leave grossAmount blank unless a tax-inclusive line gross is explicitly printed"));
});

test("US5 preview displays the routed primary document date", () => {
  const page = fs.readFileSync(path.join(__dirname, "..", "openai-test.html"), "utf8");
  assert.ok(page.includes("val(route.dateValue||(route.dateFields||[]).map(k=>d[k]).find(Boolean)"));
});


test("US5 line-item tax headings use the document's actual tax label rather than always saying VAT", () => {
  const page = fs.readFileSync(path.join(__dirname, "..", "openai-test.html"), "utf8");
  assert.ok(page.includes("lineTaxLabel=String(d.taxLabel||d.taxDescription"));
  assert.ok(page.includes("escapeHtml(lineTaxLabel)+' %'"));
});

test("US5 extraction prompt splits an explicit attached unit such as 3hrs without shortening the description", () => {
  const apiSource = fs.readFileSync(path.join(__dirname, "..", "functions", "api", "openai-parse.js"), "utf8");
  assert.ok(apiSource.includes("Labor 3hrs"));
  assert.ok(apiSource.includes("unit='hrs'"));
  assert.ok(apiSource.includes("retaining the full description"));
});


test("US5 never substitutes a due date or unrelated date for a Proforma Invoice document date", () => {
  const routerSandbox = { window: {} };
  routerSandbox.globalThis = routerSandbox;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "document-type-router.js"), "utf8"), routerSandbox);
  const classify = routerSandbox.window.ConfiCelDocumentRouter.classifyDocument;
  const route = classify({ extracted: {
    documentType: "Proforma Invoice",
    proformaInvoiceNumber: "US-001",
    proformaInvoiceDate: "",
    dueDate: "26/02/2019",
    invoiceDate: "11/02/2019"
  }});
  assert.equal(route.dateValue, "");
  assert.deepEqual(Array.from(route.dateFields), ["proformaInvoiceDate"]);
});

test("US5 summary and extraction prompt enforce source-to-field consistency", async () => {
  const page = fs.readFileSync(path.join(__dirname, "..", "openai-test.html"), "utf8");
  const apiSource = fs.readFileSync(path.join(__dirname, "..", "functions", "api", "openai-parse.js"), "utf8");
  assert.ok(page.includes("val(route.dateValue||'')"));
  assert.ok(!page.includes("route.dateValue||(route.dateFields||[]).map(k=>d[k]).find(Boolean)||d.invoiceDate||d.orderDate"));
  for (const phrase of ["SOURCE-TO-FIELD CONSISTENCY", "documentFields", "rawText", "Never populate a field from a nearby but semantically different label", "Do not use dueDate as a fallback"]) {
    assert.ok(apiSource.includes(phrase), "prompt includes " + phrase);
  }
});


test("US5 OpenAI extraction endpoint has no Gemini dependency", () => {
  const apiSource = fs.readFileSync(path.join(__dirname, "..", "functions", "api", "openai-parse.js"), "utf8");
  assert.ok(!/GEMINI|Gemini|generativelanguage|secondRead|verification/i.test(apiSource));
  assert.ok(apiSource.includes('provider: "OpenAI"'));
  assert.ok(apiSource.includes('extracted: data'));
});


test("document SOP checklist selects invoice, PO and proforma invoice independently", () => {
  const checklistSandbox = { window: {} };
  checklistSandbox.globalThis = checklistSandbox;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "document-checklists.js"), "utf8"), checklistSandbox);
  const build = checklistSandbox.window.ConfiCelDocumentChecklists.buildChecklist;
  const invoice = build({ extracted: { documentType: "Tax Invoice", invoiceNumber: "INV-1", invoiceDate: "01/01/2026", supplier: "Seller", buyerCustomer: "Buyer", currency: "GBP", lineItems: [{description:"Part A",quantity:"2",unitRate:"10",amount:"20"}], invoiceTotal:"20", rawText:"Tax Invoice" } });
  assert.equal(invoice.type, "Tax Invoice");
  assert.equal(invoice.items.find(x => x.id === "invoice_number").status, "FOUND");
  assert.equal(invoice.items.find(x => x.id === "supplier_name").status, "FOUND");
  assert.equal(invoice.items.find(x => x.id === "buyer_name").status, "FOUND");
  assert.equal(invoice.items.find(x => x.id === "supplier_tax_id").status, "NOT APPLICABLE");

  const po = build({ extracted: { documentType: "Purchase Order", purchaseOrderNumber: "PO-1", orderDate: "02/01/2026", supplier: "Vendor", buyerCustomer: "Buyer", lineItems: [{description:"Pump model X",quantity:"1",unit:"Nos"}], rawText:"Purchase Order" } });
  assert.equal(po.type, "Purchase Order");
  assert.equal(po.items.find(x => x.id === "po_number").status, "FOUND");
  assert.equal(po.items.find(x => x.id === "po_date").status, "FOUND");
  assert.equal(po.items.find(x => x.id === "items").status, "FOUND");
  assert.equal(po.items.find(x => x.id === "pi_number"), undefined);

  const pi = build({ extracted: { documentType: "Proforma Invoice", proformaInvoiceNumber: "PI-1", proformaInvoiceDate: "03/01/2026", supplier: "Vendor", buyerCustomer: "Buyer", currency: "INR", lineItems: [{description:"Lathe",quantity:"1"}], invoiceTotal:"50000", rawText:"Proforma Invoice" } });
  assert.equal(pi.type, "Proforma Invoice");
  assert.equal(pi.items.find(x => x.id === "pi_number").status, "FOUND");
  assert.equal(pi.items.find(x => x.id === "pi_date").status, "FOUND");
});

test("document SOP checklist does not substitute linked invoice/PO references for primary identifiers", () => {
  const checklistSandbox = { window: {} };
  checklistSandbox.globalThis = checklistSandbox;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "document-checklists.js"), "utf8"), checklistSandbox);
  const build = checklistSandbox.window.ConfiCelDocumentChecklists.buildChecklist;
  const po = build({ extracted: { documentType: "Purchase Order", invoiceNumber: "INV-LINKED", documentIdentifiers: [{type:"Invoice number",label:"Invoice No",value:"INV-LINKED"}] } });
  assert.equal(po.items.find(x => x.id === "po_number").status, "MISSING");
  const pi = build({ extracted: { documentType: "Proforma Invoice", invoiceNumber: "INV-OTHER", invoiceDate: "01/01/2026" } });
  assert.equal(pi.items.find(x => x.id === "pi_number").status, "MISSING");
  assert.equal(pi.items.find(x => x.id === "pi_date").status, "MISSING");
});

test("document SOP checklist is limited to invoice, purchase order and proforma invoice", () => {
  const checklistSandbox = { window: {} };
  checklistSandbox.globalThis = checklistSandbox;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "document-checklists.js"), "utf8"), checklistSandbox);
  const build = checklistSandbox.window.ConfiCelDocumentChecklists.buildChecklist;
  assert.equal(build({ extracted: { documentType: "E-Way Bill" } }).configured, false);
  assert.equal(build({ extracted: { documentType: "Delivery Challan" } }).configured, false);
});


test("document SOP checklist requires matching populated labels for bank and signature fields", () => {
  const sandbox = { window: {} }; sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "document-checklists.js"), "utf8"), sandbox);
  const build = sandbox.window.ConfiCelDocumentChecklists.buildChecklist;
  const result = build({ extracted: {
    documentType: "Invoice",
    documentFields: [
      { label: "Invoice No", value: "INV-1" },
      { label: "Issued by / Signature", value: "" },
      { label: "Your business name", value: "" },
      { label: "Customer Ref", value: "CUST-1" }
    ]
  }});
  assert.equal(result.items.find(x => x.id === "bank_payment").status, "NOT APPLICABLE");
  assert.equal(result.items.find(x => x.id === "signature").status, "REVIEW");
  const populated = build({ extracted: {
    documentType: "Invoice",
    documentFields: [
      { label: "Bank Account", value: "12345678" },
      { label: "Authorized Signatory", value: "Jane Smith" }
    ]
  }});
  assert.equal(populated.items.find(x => x.id === "bank_payment").status, "FOUND");
  assert.equal(populated.items.find(x => x.id === "signature").status, "FOUND");
});


test("preview does not repeat an invoice's own number as a linked invoice reference", () => {
  const page = fs.readFileSync(path.join(__dirname, "..", "openai-test.html"), "utf8");
  assert.ok(page.includes("linkedRef('invoice')"));
  assert.ok(page.includes("linkedRef('po')"));
  assert.ok(page.includes("route.type==='Tax Invoice'"));
  assert.ok(page.includes("route.type==='Purchase Order'"));
  assert.ok(!page.includes("<p><b>Linked invoice:</b> '+val(d.invoiceNumber)"));
  assert.ok(!page.includes("<p><b>Linked PO:</b> '+val(d.purchaseOrderNumber)"));
});


test("invoice checklist does not count its own invoice number or customer reference as linked documents", () => {
  const box = { window: {} }; box.globalThis = box;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "document-checklists.js"), "utf8"), box);
  const build = box.window.ConfiCelDocumentChecklists.buildChecklist;
  const result = build({ extracted: {
    documentType: "Invoice",
    documentIdentifiers: [
      { type: "Invoice number", label: "Invoice No", value: "INV-2024-001" },
      { type: "Customer reference", label: "Customer Ref", value: "CUST-001" }
    ]
  }});
  assert.equal(result.items.find(x => x.id === "references").status, "REVIEW");
  const linked = build({ extracted: {
    documentType: "Invoice",
    documentIdentifiers: [
      { type: "Invoice number", label: "Invoice No", value: "INV-2024-001" },
      { type: "Purchase Order reference", label: "PO No", value: "PO-100" }
    ]
  }});
  assert.equal(linked.items.find(x => x.id === "references").status, "FOUND");
});


test("PO total validation reconciles subtotal, VAT and order total", () => {
  const sandbox = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "invoice-validation.js"), "utf8"), sandbox);
  const validate = sandbox.ConfiCelInvoiceValidation.validatePurchaseOrderTotals;
  const good = validate({ documentType:"Purchase Order", subtotal:"£191.70", totalTax:"£38.34", orderTotal:"£230.04", amountSummaryRows:[
    {label:"Net Total",amount:"£191.70"},{label:"VAT",amount:"£38.34"},{label:"ORDER TOTAL",amount:"£230.04"}
  ]});
  assert.equal(good.find(x=>x.name==="PO order total captured").ok,true);
  assert.equal(good.find(x=>x.name==="PO subtotal + tax + other charges = order total").ok,true);
  const bad = validate({ documentType:"Purchase Order", subtotal:"£191.70", totalTax:"£38.34", orderTotal:"£231.04" });
  assert.equal(bad.find(x=>x.name==="PO subtotal + tax + other charges = order total").ok,false);
  const missing = validate({ documentType:"Purchase Order", subtotal:"£191.70", totalTax:"£38.34" });
  assert.equal(missing.find(x=>x.name==="PO order total").review,true);
});


test("PO checklist only recognizes explicitly labelled linked PR, RFQ and quotation references", () => {
  const box = { window: {} }; box.globalThis = box;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "document-checklists.js"), "utf8"), box);
  const build = box.window.ConfiCelDocumentChecklists.buildChecklist;
  const primaryOnly = build({ extracted: {
    documentType: "Purchase Order",
    purchaseOrderNumber: "PO-2024-001",
    documentIdentifiers: [{ type: "Purchase Order Number", label: "PO Number", value: "PO-2024-001" }]
  }});
  for (const id of ["pr_reference", "rfq_reference", "quotation_reference"]) {
    assert.equal(primaryOnly.items.find(x => x.id === id).status, "REVIEW", id);
  }
  const linked = build({ extracted: {
    documentType: "Purchase Order",
    documentIdentifiers: [
      { type: "Purchase Requisition Number", label: "PR No", value: "PR-7" },
      { type: "Request for Quotation", label: "RFQ No", value: "RFQ-8" },
      { type: "Supplier Quotation Reference", label: "Quotation Ref", value: "QT-9" }
    ]
  }});
  for (const id of ["pr_reference", "rfq_reference", "quotation_reference"]) {
    assert.equal(linked.items.find(x => x.id === id).status, "FOUND", id);
  }
});

test("PO checklist does not treat subtotal, VAT and order total as freight or extra charges", () => {
  const box = { window: {} }; box.globalThis = box;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "document-checklists.js"), "utf8"), box);
  const build = box.window.ConfiCelDocumentChecklists.buildChecklist;
  const result = build({ extracted: {
    documentType: "Purchase Order",
    chargeBreakdown: [
      { label: "Net Total", amount: "£191.70", type: "subtotal" },
      { label: "VAT", amount: "£38.34", type: "tax" },
      { label: "ORDER TOTAL", amount: "£230.04", type: "total" }
    ]
  }});
  assert.equal(result.items.find(x => x.id === "charges").status, "NOT APPLICABLE");
  const withFreight = build({ extracted: {
    documentType: "Purchase Order",
    chargeBreakdown: [{ label: "Freight Charges", amount: "£15.00" }]
  }});
  assert.equal(withFreight.items.find(x => x.id === "charges").status, "FOUND");
});

test("PO checklist distinguishes captured quantities from missing units and assesses specifications", () => {
  const box = { window: {} }; box.globalThis = box;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "document-checklists.js"), "utf8"), box);
  const build = box.window.ConfiCelDocumentChecklists.buildChecklist;
  const result = build({ extracted: {
    documentType: "Purchase Order",
    lineItems: [
      { description: "Office paper A4 80gsm", quantity: "5", unit: "" },
      { description: "Printer ink cartridges - black", quantity: "4", unit: "" }
    ]
  }});
  assert.equal(result.items.find(x => x.id === "quantity").status, "REVIEW");
  assert.match(result.items.find(x => x.id === "quantity").detail, /Unit missing/);
  assert.equal(result.items.find(x => x.id === "specification").status, "REVIEW");
  const complete = build({ extracted: {
    documentType: "Purchase Order",
    lineItems: [{ description: "Pump model X, 5 kW, stainless steel", quantity: "1", unit: "Nos" }]
  }});
  assert.equal(complete.items.find(x => x.id === "quantity").status, "FOUND");
  assert.equal(complete.items.find(x => x.id === "specification").status, "FOUND");
});


test("Proforma checklist finds document-level total without invoiceTotal", () => {
  const box = { window: {} }; box.globalThis = box;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "document-checklists.js"), "utf8"), box);
  const build = box.window.ConfiCelDocumentChecklists.buildChecklist;
  const result = build({ extracted: {
    documentType: "Proforma Invoice",
    documentTotal: "2832000",
    amountSummaryRows: [{ label: "Total Amount ₹", amount: "2832000", type: "total" }],
    invoiceTotal: ""
  }});
  assert.equal(result.items.find(x => x.id === "total").status, "FOUND");
});

test("Proforma checklist requires populated charge amounts, not blank charge rows", () => {
  const box = { window: {} }; box.globalThis = box;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "document-checklists.js"), "utf8"), box);
  const build = box.window.ConfiCelDocumentChecklists.buildChecklist;
  const blankRows = build({ extracted: {
    documentType: "Proforma Invoice",
    chargeBreakdown: [
      { label: "Others Charges/ cost", amount: "", type: "other charge" },
      { label: "Freight Charges", amount: "", type: "freight" },
      { label: "Sub Total", amount: "2400000", type: "subtotal" },
      { label: "Total Amount", amount: "2832000", type: "total" }
    ]
  }});
  assert.equal(blankRows.items.find(x => x.id === "charges").status, "NOT APPLICABLE");
  const freight = build({ extracted: {
    documentType: "Proforma Invoice",
    chargeBreakdown: [{ label: "Freight Charges", amount: "15000", type: "freight" }]
  }});
  assert.equal(freight.items.find(x => x.id === "charges").status, "FOUND");
});

test("Proforma checklist does not infer validity or warranty from generic document fields and sections", () => {
  const box = { window: {} }; box.globalThis = box;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "document-checklists.js"), "utf8"), box);
  const build = box.window.ConfiCelDocumentChecklists.buildChecklist;
  const result = build({ extracted: {
    documentType: "Proforma Invoice",
    documentFields: [
      { label: "Supplier", value: "EMCULE" },
      { label: "Payment terms", value: "50% advance" },
      { label: "Delivery terms", value: "Ex Factory" }
    ],
    sections: [
      { heading: "Supplier header", content: "EMCULE" },
      { heading: "Terms & Conditions", content: "Payment 50% advance. Deliver Ex Factory." }
    ]
  }});
  assert.equal(result.items.find(x => x.id === "validity").status, "REVIEW");
  assert.equal(result.items.find(x => x.id === "warranty").status, "NOT APPLICABLE");
  assert.equal(result.items.find(x => x.id === "bank_payment").status, "NOT APPLICABLE");
  assert.equal(result.items.find(x => x.id === "payment_terms").status, "FOUND");
  assert.equal(result.items.find(x => x.id === "delivery_terms").status, "FOUND");
});

test("Proforma bank checklist requires bank-specific populated fields or a bank details section", () => {
  const box = { window: {} }; box.globalThis = box;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "document-checklists.js"), "utf8"), box);
  const build = box.window.ConfiCelDocumentChecklists.buildChecklist;
  const result = build({ extracted: {
    documentType: "Proforma Invoice",
    documentFields: [{ label: "Ac No.", value: "41768145267" }],
    sections: [{ heading: "Bank Details", content: "Ac Name: EMCULE; IFSC: SBIN0015284" }]
  }});
  assert.equal(result.items.find(x => x.id === "bank_payment").status, "FOUND");
});


test("Proforma warranty checklist ignores generic PRODUCT / SERVICE NAME wording", () => {
  const box = { window: {} }; box.globalThis = box;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "document-checklists.js"), "utf8"), box);
  const build = box.window.ConfiCelDocumentChecklists.buildChecklist;
  const result = build({ extracted: {
    documentType: "Proforma Invoice",
    lineItems: [{ description: "bidon; recipient for mixture" }],
    sections: [
      { heading: "Line items", content: "NO; PRODUCT / SERVICE NAME; HSN/SAC; QUANTITY UOM" },
      { heading: "Authorization and note", content: "AUTHORIZED SIGNATORY. NOTE: This proforma is valid for 30 days." }
    ]
  }});
  assert.equal(result.items.find(x => x.id === "warranty").status, "NOT APPLICABLE");
});

test("OpenAI extraction prompt separates line-item discounts from unit price", () => {
  const prompt = fs.readFileSync(path.join(__dirname, "..", "functions", "api", "openai-parse.js"), "utf8");
  assert.match(prompt, /"unitRate":"","discount":""/);
  assert.match(prompt, /keep unitRate strictly numeric/i);
});


test("Completeness report falls back to totals-section charge rows when amountSummaryRows is empty", () => {
  const ui = fs.readFileSync(path.join(__dirname, "..", "openai-test.html"), "utf8");
  assert.match(ui, /reportedAmountRows=amountRows\.length\?amountRows:charges\.filter/);
  assert.match(ui, /reportedAmountRows\.length\+' separate amount row\(s\) extracted/);
  assert.match(ui, /Amount rows<strong>'\+reportedAmountRows\.length/);
});
