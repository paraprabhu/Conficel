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
