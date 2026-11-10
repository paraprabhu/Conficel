(function (root) {
  "use strict";
  function money(value) {
    if (value === undefined || value === null || String(value).trim() === "") return null;
    const original = String(value).trim();
    if (/^[–—-]$/.test(original)) return null;
    let s = original.replace(/[£€$₹¥₩₽\\s]/g, "").replace(/[^0-9,.-]/g, "");
    if (!s || !/[0-9]/.test(s)) return null;
    const comma = s.lastIndexOf(","), dot = s.lastIndexOf(".");
    if (comma >= 0 && dot >= 0) {
      if (comma > dot) s = s.replace(/\\./g, "").replace(",", ".");
      else s = s.replace(/,/g, "");
    } else if (comma >= 0) {
      const decimals = s.length - comma - 1;
      if (decimals === 1 || decimals === 2) s = s.replace(",", ".");
      else s = s.replace(/,/g, "");
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  function rate(value) {
    if (value === undefined || value === null || String(value).trim() === "") return null;
    const n = Number(String(value).replace("%", "").trim());
    return Number.isFinite(n) ? n : null;
  }
  function close(a, b) { return Math.abs(a - b) < 0.02; }
  function validateUkLineItems(data) {
    const d = data && data.extracted ? data.extracted : {};
    const items = Array.isArray(d.lineItems) ? d.lineItems : [];
    const taxRows = Array.isArray(d.taxBreakdown) ? d.taxBreakdown : [];
    const jurisdiction = String(d.countryOrJurisdiction || "").toLowerCase();
    const isUkVat = String(d.currency || "").toUpperCase() === "GBP" ||
      jurisdiction.includes("united kingdom") || /\\bVAT\\b/i.test(String(d.taxLabel || d.taxDescription || ""));
    if (!isUkVat || !items.length) return [];
    const checks = [];
    const groups = new Map();
    let allNetKnown = true;
    let netTotal = 0;
    items.forEach((item, index) => {
      const net = money(item.netAmount !== undefined ? item.netAmount : item.taxable);
      const gross = money(item.grossAmount !== undefined ? item.grossAmount : item.amount);
      const taxRate = rate(item.taxRate);
      const taxRaw = item.taxAmount === undefined || item.taxAmount === null ? "" : String(item.taxAmount).trim();
      const taxNumeric = money(taxRaw);
      const tax = taxNumeric === null && taxRate === 0 && /^[–—-]$/.test(taxRaw) ? 0 : taxNumeric;
      const qty = money(item.quantity), unitRate = money(item.unitRate);
      const label = "Line item " + (index + 1) + " — " + String(item.description || "unnamed item");
      if (net === null) {
        allNetKnown = false;
        checks.push({ name: label + " net amount", detail: "Net amount is missing; verify the Net column in the source.", ok: false, review: true });
      } else {
        netTotal += net;
        if (qty !== null && unitRate !== null) {
          const calculatedNet = qty * unitRate;
          checks.push({ name: label + " quantity × unit price = net", detail: qty + " × " + unitRate.toFixed(2) + " = " + calculatedNet.toFixed(2) + "; extracted net " + net.toFixed(2) + ".", ok: close(calculatedNet, net), review: false });
        }
      }
      if (taxRate === null) {
        checks.push({ name: label + " VAT rate", detail: "VAT rate is not structured; review the printed VAT % column.", ok: false, review: true });
      }
      if (tax === null) {
        checks.push({ name: label + " VAT amount", detail: "VAT amount is missing or unreadable; do not infer a value.", ok: false, review: true });
      } else if (taxRate !== null && net !== null) {
        const calculatedTax = net * taxRate / 100;
        checks.push({ name: label + " VAT calculation", detail: net.toFixed(2) + " × " + taxRate + "% = " + calculatedTax.toFixed(2) + "; extracted VAT " + tax.toFixed(2) + (taxRate === 0 && /^[–—-]$/.test(taxRaw) ? " (source dash retained as zero-rated VAT)" : "") + ".", ok: close(calculatedTax, tax), review: false });
      }
      if (gross !== null && net !== null && tax !== null) {
        checks.push({ name: label + " net + VAT = gross", detail: net.toFixed(2) + " + " + tax.toFixed(2) + " = " + (net + tax).toFixed(2) + "; extracted gross " + gross.toFixed(2) + ".", ok: close(net + tax, gross), review: false });
      } else {
        checks.push({ name: label + " gross amount", detail: "Net, VAT and gross values must all be present to reconcile this row.", ok: false, review: true });
      }
      if (taxRate !== null && net !== null) {
        const key = String(taxRate);
        if (!groups.has(key)) groups.set(key, { rate: taxRate, net: 0, tax: 0, taxKnown: true });
        const group = groups.get(key);
        group.net += net;
        if (tax === null) group.taxKnown = false;
        else group.tax += tax;
      }
    });
    const reportedNet = money(d.subtotal);
    if (allNetKnown && reportedNet !== null) {
      checks.push({ name: "Line-item net total vs invoice net total", detail: "Line-item net amounts total " + netTotal.toFixed(2) + "; invoice Net Total is " + reportedNet.toFixed(2) + ".", ok: close(netTotal, reportedNet), review: false });
    } else if (allNetKnown) {
      checks.push({ name: "Line-item net total", detail: "Line-item net amounts total " + netTotal.toFixed(2) + "; no separate subtotal was extracted for comparison.", ok: false, review: true });
    }
    const breakdownByRate = new Map();
    taxRows.forEach(row => {
      const r = rate(row.rate);
      if (r !== null) breakdownByRate.set(String(r), row);
    });
    groups.forEach(group => {
      const row = breakdownByRate.get(String(group.rate));
      if (!row) {
        checks.push({ name: "VAT breakdown at " + group.rate + "%", detail: "Line items at " + group.rate + "% have a net base of " + group.net.toFixed(2) + ", but no matching VAT breakdown row was extracted.", ok: false, review: true });
        return;
      }
      const rowBase = money(row.taxableAmount);
      if (rowBase !== null) {
        checks.push({ name: "VAT taxable base at " + group.rate + "%", detail: "Line-item net base " + group.net.toFixed(2) + "; VAT breakdown base " + rowBase.toFixed(2) + ".", ok: close(group.net, rowBase), review: false });
      } else {
        checks.push({ name: "VAT taxable base at " + group.rate + "%", detail: "VAT breakdown row has no numeric taxable base.", ok: false, review: true });
      }
      const rowTaxRaw = row.amount === undefined || row.amount === null ? "" : String(row.amount).trim();
      const rowTaxValue = money(rowTaxRaw);
      const rowTax = rowTaxValue === null && group.rate === 0 && /^[–—-]$/.test(rowTaxRaw) ? 0 : rowTaxValue;
      if (rowTax !== null && group.taxKnown) {
        checks.push({ name: "VAT amount at " + group.rate + "%", detail: "Line-item VAT totals " + group.tax.toFixed(2) + "; VAT breakdown amount " + rowTax.toFixed(2) + (group.rate === 0 && /^[–—-]$/.test(rowTaxRaw) ? " (source dash retained)." : "") , ok: close(group.tax, rowTax), review: false });
      } else {
        checks.push({ name: "VAT amount at " + group.rate + "%", detail: "VAT amount could not be reconciled numerically; preserve the source notation and review.", ok: false, review: true });
      }
    });
    const groupedNet = Array.from(groups.values()).reduce((sum, group) => sum + group.net, 0);
    const groupedTaxKnown = Array.from(groups.values()).every(group => group.taxKnown);
    const groupedTax = Array.from(groups.values()).reduce((sum, group) => sum + group.tax, 0);
    const overallTaxable = money(d.taxableAmount);
    if (overallTaxable !== null) {
      checks.push({ name: "Multi-rate VAT bases vs overall taxable amount", detail: "VAT-rate taxable bases total " + groupedNet.toFixed(2) + "; overall taxable amount " + overallTaxable.toFixed(2) + ".", ok: close(groupedNet, overallTaxable), review: false });
    }
    const reportedVat = money(d.totalTax) !== null ? money(d.totalTax) : money(d.taxDue);
    if (reportedVat !== null && groupedTaxKnown) {
      checks.push({ name: "Multi-rate VAT total", detail: "VAT amounts across all rates total " + groupedTax.toFixed(2) + "; reported VAT total " + reportedVat.toFixed(2) + ".", ok: close(groupedTax, reportedVat), review: false });
    }
    return checks;
  }

  function validatePurchaseOrderTotals(data) {
    const d = data && data.extracted ? data.extracted : (data || {});
    if (String(d.documentType || "").toLowerCase() !== "purchase order") return [];
    const rows = Array.isArray(d.amountSummaryRows) ? d.amountSummaryRows : [];
    const find = re => rows.find(x => re.test(String(x.label || "")) && money(x.amount) !== null);
    const subtotalRow = find(/net total|subtotal|sub total/i);
    const taxRow = find(/vat|tax total|total tax/i);
    const totalRow = find(/order total|po total|grand total|total amount/i);
    const subtotal = money(d.subtotal) ?? (subtotalRow ? money(subtotalRow.amount) : null);
    const tax = money(d.totalTax) ?? money(d.taxDue) ?? (taxRow ? money(taxRow.amount) : null);
    const total = money(d.orderTotal) ?? money(d.documentTotal) ?? (totalRow ? money(totalRow.amount) : null);
    const checks = [];
    if (total === null) {
      checks.push({name:"PO order total",detail:"No distinct PO order total was extracted. Review the printed ORDER TOTAL / PO TOTAL / GRAND TOTAL.",ok:false,review:true});
    } else {
      checks.push({name:"PO order total captured",detail:"Order total extracted as " + total.toFixed(2) + ".",ok:true,review:false});
    }
    if (subtotal !== null && tax !== null && total !== null) {
      const other = money(d.otherCharges) || 0;
      const expected = subtotal + tax + other;
      checks.push({name:"PO subtotal + tax + other charges = order total",detail:subtotal.toFixed(2)+" + "+tax.toFixed(2)+" + "+other.toFixed(2)+" = "+expected.toFixed(2)+"; PO total "+total.toFixed(2)+".",ok:close(expected,total),review:false});
    } else {
      checks.push({name:"PO total reconciliation",detail:"Subtotal, tax and PO total must all be captured separately before reconciliation.",ok:false,review:true});
    }
    return checks;
  }
  root.ConfiCelInvoiceValidation = { money, validateUkLineItems, validatePurchaseOrderTotals };
})(typeof window !== "undefined" ? window : globalThis);
