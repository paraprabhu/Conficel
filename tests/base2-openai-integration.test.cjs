const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const fixture = JSON.parse(read('tests/fixtures/us5-uk-invoice.json'));

test('November 1 UK invoice fixture retains four line items and separate VAT bands', () => {
  const d = fixture.extracted;
  assert.equal(d.lineItems.length, 4);
  assert.deepEqual(d.taxBreakdown.map(x => x.rate), ['20%', '0%']);
  assert.equal(d.lineItems[3].taxAmount, '–');
  assert.equal(d.lineItems[3].taxRate, '0%');
  assert.equal(d.invoiceTotal, '£2,973.50');
  assert.match(d.rawText, /Customer Ref CUST-001/);
});

test('UK line-item arithmetic validation reports no mismatches for the training fixture', () => {
  const sandbox = {};
  vm.runInNewContext(read('invoice-validation.js'), sandbox);
  const result = sandbox.ConfiCelInvoiceValidation.validateUkLineItems(fixture);
  const checks = Array.from(result);
  assert.ok(checks.length >= 19);
  assert.deepEqual(checks.filter(check => !check.ok).map(check => check.name), []);
});

test('UK validation catches a changed VAT amount', () => {
  const sandbox = {};
  vm.runInNewContext(read('invoice-validation.js'), sandbox);
  const altered = JSON.parse(JSON.stringify(fixture));
  altered.extracted.lineItems[0].taxAmount = '£241.00';
  const result = sandbox.ConfiCelInvoiceValidation.validateUkLineItems(altered);
  assert.ok(Array.from(result).some(x => x.ok === false || x.review === true));
});

test('document router keeps PO, Proforma and Quotation identifiers separate from invoice numbers', () => {
  const sandbox = {};
  vm.runInNewContext(read('document-type-router.js'), sandbox);
  const classify = sandbox.ConfiCelDocumentRouter.classifyDocument;
  const po = classify({documentType:'Purchase Order',purchaseOrderNumber:'PO-77',invoiceNumber:''});
  const pi = classify({documentType:'Proforma Invoice',proformaInvoiceNumber:'PI-12',invoiceNumber:''});
  const quote = classify({documentType:'Quotation',quotationNumber:'QT-9',invoiceNumber:''});
  assert.equal(po.identifierField,'purchaseOrderNumber');
  assert.equal(po.identifierValue,'PO-77');
  assert.equal(pi.identifierField,'proformaInvoiceNumber');
  assert.equal(quote.identifierField,'quotationNumber');
});

test('document checklist can find PO total from documentTotal and amount summary rows', () => {
  const sandbox = {window:{}}; sandbox.globalThis = sandbox;
  vm.runInNewContext(read('document-checklists.js'), sandbox);
  const result = sandbox.window.ConfiCelDocumentChecklists.buildChecklist({extracted:{
    documentType:'Purchase Order',
    documentTotal:'£230.04',
    amountSummaryRows:[{label:'ORDER TOTAL',amount:'£230.04',type:'total'}]
  }});
  assert.equal(result.configured,true);
  assert.equal(result.items.find(x=>x.id==='po_total').status,'FOUND');
});

test('OpenAI invoice prompt retains the trained VAT, gross/net, quotation and raw-text rules', () => {
  const parser = read('functions/api/openai-parse.js');
  assert.match(parser,/LINE ITEMS VS OTHER AMOUNTS/);
  assert.match(parser,/QUOTATION-SPECIFIC EXTRACTION/);
  assert.match(parser,/customer RFQ, PR and PO references separately/i);
  assert.match(parser,/"netAmount"/);
  assert.match(parser,/"grossAmount"/);
  assert.match(parser,/rawText/);
});

test('cheque prompt retains bank, cheque number, date, payee and amount fields', () => {
  const parser = read('functions/api/openai-parse.js');
  for (const field of ['bankName','branch','chequeNumber','chequeDate','payee','amountFigures','amountWords','ifsc','micr']) {
    assert.ok(parser.includes('"'+field+'"'), field);
  }
});

test('OpenAI endpoint authenticates the Supabase user and consumes a one-use permit', () => {
  const parser = read('functions/api/openai-parse.js');
  assert.match(parser,/verifyAndConsumePermit/);
  assert.match(parser,/auth\/v1\/user/);
  assert.match(parser,/HMAC/);
  assert.match(parser,/used_at=is.null/);
  assert.match(parser,/return=representation/);
});

test('free-trial endpoint signs permits only after successful page-token reservation', () => {
  const endpoint = read('functions/api/free-trial.js');
  assert.match(endpoint,/consume_conficel_free_tokens/);
  assert.match(endpoint,/signPermit/);
  assert.match(endpoint,/file_sha256/);
  assert.match(endpoint,/return json\(\{\.\.\.result,permit\}\)/);
});

test('base-2 workspace calls OpenAI and exports nested extraction arrays to workbook sheets', () => {
  const app = read('app.js');
  assert.match(app,/fetch\('\/api\/openai-parse'/);
  assert.match(app,/renderResults\(result\.extracted/);
  for (const sheet of ['lineItems','taxBreakdown','chargeBreakdown','amountSummaryRows','documentIdentifiers','documentFields','sections']) {
    assert.ok(app.includes("addArraySheet('"+sheet+"'"), sheet);
  }
  assert.match(app,/setNestedValue/);
});

test('base-2 homepage keeps its Supabase authentication and animated document presets', () => {
  const html = read('index.html');
  const app = read('app.js');
  assert.match(html,/id="auth-modal"/);
  assert.match(html,/supabase-config\.js/);
  assert.match(app,/Supplied dynamic document presets/);
  assert.match(html,/heroDocumentCard/);
});

\ntest('cheque review normalizes compact dates and formats rupee amounts without losing numeric export values', () => {
  const app = read('app.js');
  assert.match(app,/function normalizeChequeDate/);
  assert.match(app,/raw\.slice\(0, 2\) \+ '\/' \+ raw\.slice\(2, 4\) \+ '\/' \+ raw\.slice\(4, 8\)/);
  assert.match(app,/function formatChequeAmount/);
  assert.match(app,/function parseChequeAmount/);
  assert.match(app,/amountFigures.*parseChequeAmount/);
  assert.match(app,/₹#,##0\.00/);
});

test('cheque prompt preserves MICR as a complete line and forbids inferred component routing', () => {
  const parser = read('functions/api/openai-parse.js');
  assert.match(parser,/Preserve the complete MICR line exactly as one raw string in micr/);
  assert.match(parser,/Do not split MICR digits into chequeNumber/);
  assert.match(parser,/numeric amountFigures value without adding a currency symbol/);
});
