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
  assert.ok(page.includes("Required field: '+name"));
});
