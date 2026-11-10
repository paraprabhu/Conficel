(() => {
  const fileInput = document.getElementById('file-input');
  const dropZone = document.getElementById('drop-zone');
  const selectedFile = document.getElementById('selected-file');
  const selectedName = document.getElementById('selected-file-name');
  const extractButton = document.getElementById('extract-button');
  const removeButton = document.getElementById('remove-file');
  const downloadButton = document.getElementById('download-button');
  const clearDocumentButton = document.getElementById('clear-document-button');
  const maxBytes = 10 * 1024 * 1024;
  let currentMode = 'invoice';
  let selectedDocumentType = 'invoice';
  let file = null;
  let extractedRows = [];
  let extractedDocument = null;
  document.getElementById('year').textContent = new Date().getFullYear();

  // The selected document is sent securely to the server-side OpenAI parser after sign-in and token reservation.
  function setMode(mode, documentType = (mode === 'cheque' ? 'cheque' : 'invoice')) {
    currentMode = mode;
    selectedDocumentType = documentType;
    document.querySelectorAll('.document-type-card').forEach(button => {
      const active = button.dataset.documentType === documentType;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('.tool-card[data-mode]').forEach(card => {
      card.classList.toggle('selected-tool', card.dataset.mode === mode);
    });
    dropZone.querySelector('strong').textContent = mode === 'cheque' ? 'Choose a cheque image or PDF' : 'Choose a file or drop it here';
    const chequeVisual = document.getElementById('cheque-workspace-art');
    if (chequeVisual) chequeVisual.hidden = mode !== 'cheque';
    const workspace = document.querySelector('.workspace');
    if (workspace) workspace.classList.toggle('workspace-cheque-mode', mode === 'cheque');
    const heading = document.querySelector('.workspace-heading p');
    if (heading) heading.textContent = 'Upload a PDF, JPG or PNG. OpenAI extracts document fields on the secure server; review every result before exporting.';
  }
  document.querySelectorAll('.document-type-card').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode, button.dataset.documentType)));
  document.querySelectorAll('.tool-card[data-mode]').forEach(card => card.addEventListener('click', () => setMode(card.dataset.mode)));

  function setNotice(message, isError = false) {
    // Processing details and model usage are intentionally not shown to customers.
    if (isError) setProgress(100, message, 'error');
  }
  function setProgress(percent, message, state = 'active') {
    const wrap = document.getElementById('extraction-progress');
    const bar = document.getElementById('extraction-progress-bar');
    const label = document.getElementById('extraction-progress-label');
    const value = document.getElementById('extraction-progress-value');
    if (!wrap || !bar || !label || !value) return;
    wrap.hidden = false;
    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
    bar.style.width = safePercent + '%';
    bar.setAttribute('aria-valuenow', String(safePercent));
    value.textContent = safePercent + '%';
    label.textContent = message;
    wrap.dataset.state = state;
  }
  function resetProgress() {
    const wrap = document.getElementById('extraction-progress');
    if (wrap) { wrap.hidden = true; wrap.dataset.state = 'active'; }
  }
  function getDocumentDisplayName() {
    const raw = (file?.name || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    return raw || ({invoice:'Invoice',other:'Purchase Order',quotation:'Quotation',cheque:'Cheque'}[currentMode] || 'Document');
  }
  function getExportBaseName() {
    const raw = (file?.name || getDocumentDisplayName()).replace(/\.[^.]+$/, '');
    const safe = raw.normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
    return 'CONFICEL_' + (safe || 'DOCUMENT');
  }
  function showFile(candidate) {
    if (!candidate) return;
    const allowed = /\.(pdf|png|jpe?g|webp)$/i.test(candidate.name);
    if (!allowed) { alert('Please choose a PDF, JPG or PNG file.'); return; }
    if (candidate.size > maxBytes) { alert('Please choose a file smaller than 10 MB.'); return; }
    file = candidate;
    resetProgress();
    extractedRows = [];
    extractedDocument = null;
    selectedName.textContent = candidate.name + ' · ' + (candidate.size < 1024 * 1024 ? Math.max(1, Math.round(candidate.size / 1024)) + ' KB' : (candidate.size / (1024 * 1024)).toFixed(1) + ' MB');
    selectedFile.hidden = false;
    dropZone.hidden = true;
    extractButton.disabled = false;
    extractButton.textContent = 'Extract Document →';
    setNotice('Your file will be uploaded over HTTPS for OpenAI extraction after your sign-in and free-token allowance are verified.');
  }
  fileInput.addEventListener('change', event => showFile(event.target.files[0]));
  removeButton.addEventListener('click', () => {
    resetProgress();
    file = null; extractedRows = []; extractedDocument = null; fileInput.value = ''; selectedFile.hidden = true; dropZone.hidden = false;
    extractButton.disabled = true; extractButton.textContent = 'Extract Document →';
    setNotice('Choose a PDF, JPG, PNG or WEBP document to extract.');
  });
  function clearCurrentDocument() {
    resetProgress();
    file = null;
    extractedRows = [];
    extractedDocument = null;
    fileInput.value = '';
    selectedFile.hidden = true;
    dropZone.hidden = false;
    extractButton.disabled = true;
    extractButton.textContent = 'Extract Document →';
    const remarks = document.getElementById('invoice-remarks');
    if (remarks) remarks.value = '';
    const body = document.getElementById('preview-body');
    const table = document.querySelector('.data-table');
    if (table) table.querySelector('thead').innerHTML = '<tr><th>Item</th><th>Qty</th><th>Amount (₹)</th></tr>';
    if (body) body.innerHTML = '<tr><td contenteditable="true">Laboratory supplies</td><td contenteditable="true">2</td><td contenteditable="true">8,000.00</td></tr><tr><td contenteditable="true">Service charge</td><td contenteditable="true">1</td><td contenteditable="true">4,450.00</td></tr><tr class="total-row"><td colspan="2">Total (sample)</td><td>12,450.00</td></tr>';
    const toolbar = document.querySelector('.preview-toolbar');
    if (toolbar) {
      toolbar.querySelector('b').textContent = 'extracted-data';
      toolbar.querySelector('small').textContent = 'Spreadsheet preview';
      toolbar.querySelector('.preview-status').innerHTML = '<i></i> Sample data';
    }
    const badge = document.querySelector('.preview-badge');
    if (badge) badge.textContent = 'SAMPLE PREVIEW';
    const reviewHeading = document.getElementById('review-heading');
    if (reviewHeading) reviewHeading.textContent = 'Review your data';
    const note = document.querySelector('.review-note');
    if (note) note.textContent = 'Extracted values become editable here after processing. Verify them before export.';
    setNotice('Previous document cleared. Choose the next PDF, JPG, PNG or WEBP document.');
  }
  clearDocumentButton?.addEventListener('click', clearCurrentDocument);

  ['dragenter','dragover'].forEach(name => dropZone.addEventListener(name, event => { event.preventDefault(); dropZone.classList.add('dragover'); }));
  ['dragleave','drop'].forEach(name => dropZone.addEventListener(name, event => { event.preventDefault(); dropZone.classList.remove('dragover'); }));
  dropZone.addEventListener('drop', event => showFile(event.dataTransfer.files[0]));

  function loadScript(src, readyCheck) {
    return new Promise((resolve, reject) => {
      if (readyCheck()) return resolve();
      const existing = document.querySelector('script[data-extraction-lib="' + src + '"]');
      const script = existing || document.createElement('script');
      script.src = src;
      script.dataset.extractionLib = src;
      script.onload = () => readyCheck() ? resolve() : reject(new Error('The extraction library did not initialize.'));
      script.onerror = () => reject(new Error('Could not load a processing library. Check your internet connection and try again.'));
      if (!existing) document.head.appendChild(script);
    });
  }
  async function getPdfText(blob) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', () => !!window.pdfjsLib);
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await window.pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise;
    let pages = [];
    let ocrPages = [];
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const page = await pdf.getPage(pageNo);
      const textContent = await page.getTextContent();
      const text = textContent.items.map(item => item.str).join(' ').replace(/\s+/g, ' ').trim();
      if (text.length > 25) {
        pages.push({ page: pageNo, text });
      } else {
        ocrPages.push({ page, pageNo });
      }
    }
    if (ocrPages.length) {
      await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js', () => !!window.Tesseract);
      const worker = await window.Tesseract.createWorker('eng');
      try {
        for (const item of ocrPages) {
          setNotice('Reading scanned PDF page ' + item.pageNo + ' with in-browser OCR…');
          const viewport = item.page.getViewport({ scale: 1.6 });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
          await item.page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          const result = await worker.recognize(canvas);
          pages.push({ page: item.pageNo, text: (result.data.text || '').trim() });
        }
      } finally { await worker.terminate(); }
    }
    return pages.sort((a,b) => a.page - b.page);
  }
  async function getImageText(blob) {
    await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js', () => !!window.Tesseract);
    setNotice('Reading image with in-browser OCR. This may take a little time…');
    const worker = await window.Tesseract.createWorker('eng');
    try {
      const result = await worker.recognize(blob);
      return [{ page: 1, text: (result.data.text || '').trim() }];
    } finally { await worker.terminate(); }
  }
  function firstMatch(text, patterns) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) return match[1].replace(/\s+/g, ' ').trim().replace(/[,:;]+$/, '');
    }
    return '';
  }
  function structuredRecord(text) {
    const clean = text.replace(/\s+/g, ' ').trim();
    const pick = patterns => firstMatch(clean, patterns);
    const amount = labels => {
      for (const label of labels) {
        const re = new RegExp('(?:' + label + ')\\s*(?:[:#-]\\s*)?(?:₹\\s*|INR\\s*)?([0-9][0-9,]*(?:\\.[0-9]{1,2})?)', 'i');
        const m = clean.match(re);
        if (m) return m[1].replace(/,/g, '');
      }
      return '';
    };
    const gstins = [...clean.matchAll(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z])\b/g)].map(m => m[1]);
    if (currentMode === 'cheque') {
      return {
        'Document Type': 'Cheque',
        'Cheque Number': pick([/cheque\s*(?:no|number|#)\s*[:#-]?\s*([A-Z0-9-]+)/i]),
        'Cheque Date': pick([/(?:date)\s*[:#-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i]),
        'Payee': pick([/(?:pay(?:ee)?\s+to|pay\s+to)\s*[:#-]?\s*(.{2,70}?)(?=\s+(?:rupees|₹|\*|a\/c|account|date)\b)/i]),
        'Amount': amount(['amount in figures','amount','₹']),
        'Amount in words': pick([/(?:rupees|amount in words)\s*[:#-]?\s*(.{3,100}?)(?=\s+(?:a\/c|account|signature|date)\b)/i]),
        'Raw extracted text': clean
      };
    }
    const docType = /pro[\s-]?forma\s+invoice/i.test(clean) ? 'Proforma Invoice' : (pick([/(tax invoice|invoice|credit note|debit note)/i]) || 'Invoice');
    const invoiceNo = pick([/(?:invoice\s*(?:no|number|#)|inv\.?\s*(?:no|#))\s*[:#-]?\s*([A-Z0-9/-]+)/i, /\binvoice\s*no\s+([A-Z0-9/-]+)/i]);
    const date = pick([/(?:invoice\s*date|invoice\s*dated|date)\s*[:#-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/i]);
    const supplierGstin = gstins[0] || '';
    const buyerGstin = gstins.length > 1 && gstins[1] !== supplierGstin ? gstins[1] : '';
    const buyer = pick([/(?:details of receiver\s*\|?\s*billed to|billed to|bill to|buyer|customer)\s*[:#-]?\s*(?:name\s*[:#-]?\s*)?(.{2,100}?)(?=\s+(?:address|gstin|gst\s*no|state|invoice date|invoice no|date)\b)/i]);
    const afterHeader = clean.match(/name\s+of\s+product\s+qty\s+rate\s*(?:₹|rs\.?|inr)?\s*amount\s*(?:₹|rs\.?|inr)?\s+(.{1,220}?)(?=\s+(?:add:?\s*(?:cgst|sgst|igst|cess)|cgst|sgst|igst|cess|sub\s*total|subtotal|total amount|grand total|freight|electronically generated)\b|$)/i);
    const lineText = afterHeader ? afterHeader[1] : '';
    const lineMatch = lineText.match(/^(.+?)\s+(\d{1,8}(?:\.\d+)?)\s+([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s+([0-9][0-9,]*(?:\.[0-9]{1,2})?)(?:\s|$)/i);
    const productMatch = lineMatch || clean.match(/(?:^|\s)([A-Za-z][A-Za-z0-9 &().,/-]{2,60}?)\s+(\d{1,8})\s+([0-9][0-9,]*\.\d{2})\s+([0-9][0-9,]*\.\d{2})(?=\s+(?:add:|cgst|sgst|igst|cess|sub\s*total|subtotal|total amount|grand total|freight|electronically generated)\b)/i);
    const hsn = pick([/(?:hsn\s*(?:acs|sac|code)?|sac\s*(?:code)?)\s*[:#-]?\s*([0-9]{4,8})/i]);
    const productName = productMatch ? productMatch[1].trim().replace(/^(?:name\s+of\s+product\s+)?/i,'') : '';
    const quantity = productMatch ? productMatch[2] : '';
    const total = amount(['total amount','grand total','total invoice amount','invoice total','amount payable','net amount']);
    const subtotal = amount(['sub\s*total','subtotal','taxable amount','taxable value','total before tax','assessable value']);
    const cgst = amount(['add:?\s*cgst','cgst']);
    const sgst = amount(['add:?\s*sgst','sgst']);
    const igst = amount(['add:?\s*igst','igst']);
    const taxValues = [cgst, sgst, igst].map(v => Number(v || 0));
    const totalTax = taxValues.some(v => v > 0) ? String(taxValues.reduce((x,y) => x+y, 0)) : '';
    const buyerAddress = pick([/(?:billed to|bill to|details of receiver|buyer|customer)[^:]{0,35}[:#-]?\s*.*?\baddress\s*[:#-]?\s*(.{8,140}?)(?=\s+(?:gstin|gst\s*no|state|state code|place of supply|invoice date)\b)/i]);
    const consignee = pick([/(?:details of consignee\s*\|?\s*shipped to|ship to|consignee)\s*[:#-]?\s*(.{2,80}?)(?=\s+(?:address|gstin|state)\b)/i]);
    return {
      'Document Type': docType, 'Invoice Number': invoiceNo, 'Invoice Date': date,
      'Supplier': pick([/\b(EMCULE)\b/i, /(?:supplier|seller|billed by|sold by|from)\s*[:#-]?\s*([A-Z][A-Z0-9 &.,()/-]{2,70}?)(?=\s+(?:gstin|gst\s*no|address|invoice|buyer|bill to|customer)\b)/i]),
      'Supplier GSTIN': supplierGstin,
      'Supplier Address': pick([/(?:h\.?o\.?|head office)\s*[:#-]?\s*(.{10,120}?)(?=\s+(?:mumbai office|office|phone|email|gst)\b)/i]),
      'Head Office Address': pick([/(?:h\.?o\.?|head office)\s*[:#-]?\s*(.{10,120}?)(?=\s+(?:mumbai office|office|phone|email|gst)\b)/i]),
      'Office Address': pick([/(?:mumbai office|office)\s*[:#-]?\s*(.{10,120}?)(?=\s+(?:phone|tel|mobile|email|gst|for\s+emcule)\b)/i]),
      'Supplier Contact': pick([/(?:phone|tel|mobile)\s*[:#-]?\s*([+0-9 ()-]{8,20})/i]),
      'Buyer / Customer': buyer, 'Buyer GSTIN': buyerGstin, 'Buyer Address': buyerAddress, 'Consignee / Ship To': consignee,
      'State': pick([/state\s+(Uttar Pradesh|Maharashtra|Karnataka|Gujarat|Delhi|Tamil Nadu|Rajasthan|Haryana|Telangana|Kerala|West Bengal|Punjab|Madhya Pradesh|Andhra Pradesh)\b/i]),
      'State Code': pick([/state code\s*[:#-]?\s*(\d{1,2})/i]),
      'Purchase Order Number': pick([/(?:ref\.?\s*po\s*no|purchase\s*order|po)\s*(?:no|number|#)\s*[:#-]?\s*([A-Z0-9/-]{3,30})/i]),
      'Product Description': productName, 'HSN / SAC': hsn, 'Quantity': quantity,
      'Unit': pick([/\b(?:unit)\s*[:#-]?\s*(kg|kgs|lit|ltr|ltrs|nos|pcs|units?)\b/i]),
      'Unit Rate': productMatch ? productMatch[3].replace(/,/g,'') : '',
      'Product Line Amount': productMatch ? productMatch[4].replace(/,/g,'') : '',
      'Taxable Amount': subtotal, 'CGST': cgst, 'SGST': sgst, 'IGST': igst,
      'CESS': amount(['add:?\s*cess','cess']), 'Total Tax': totalTax,
      'Other Charges': pick([/(?:other charges\s*\/\s*cost)\s*[:#-]?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i]),
      'Freight Charges': pick([/freight charges\s*[:#-]?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i]),
      'Invoice Total': total,
      'Invoice Total in Words': pick([/(?:total invoice amount in words|amount in words)\s*[:#-]?\s*(.{5,100}?)(?=\s+(?:terms|payment|deliver|certified)\b)/i]),
      'Payment Terms': pick([/(payment\s+[^.]{2,60}?advance)/i]),
      'Delivery Terms': pick([/(deliver\s*[:#-]?\s*[^.]{2,60})/i]),
      'Additional Costs': pick([/(additional cost to customer\s*:?\s*(?:[0-9.]\s*)?.{3,100}?)(?=\s+(?:electronically generated|terms|certified)\b)/i]),
      'Due Date': pick([/(?:due\s*date|payment\s*due)\s*[:#-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/i]),
      'Raw extracted text': clean
    };
  }
  function extractLineItems(text) {
    const clean = text.replace(/\s+/g, ' ').trim();
    const items = [];
    // Match common invoice table order: description, HSN/SAC, quantity, unit, rate, amount.
    const pattern = /([A-Za-z][A-Za-z0-9 &().,/-]{2,60}?)\s+(\d{4,8})\s+([0-9][0-9,]*(?:\.[0-9]+)?)\s+(kg|kgs|lit|ltr|ltrs|nos|pcs|units?)\s+(?:₹\s*)?([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s+(?:₹\s*)?([0-9][0-9,]*(?:\.[0-9]{1,2})?)(?=\s|$)/gi;
    let m;
    while ((m = pattern.exec(clean)) !== null) {
      const description = m[1].trim().replace(/^(?:sr\s*no\s*)/i, '');
      if (/^(invoice|date|gstin|subtotal|sub total|total|cgst|sgst|igst|cess|freight|tax|amount|qty|quantity|rate|hsn|unit|state code)$/i.test(description)) continue;
      items.push({
        'Item Description': description, 'HSN / SAC': m[2],
        'Quantity': Number(m[3].replace(/,/g, '')), 'Unit': m[4],
        'Unit Rate': Number(m[5].replace(/,/g, '')), 'Line Amount': Number(m[6].replace(/,/g, ''))
      });
    }
    return items.filter((item, i, all) => all.findIndex(other => JSON.stringify(other) === JSON.stringify(item)) === i);
  }

  function flattenExtracted(value, prefix = '', output = {}) {
    if (Array.isArray(value)) {
      if (!value.length) { output[prefix] = '[]'; return output; }
      value.forEach((item, index) => flattenExtracted(item, prefix + '[' + index + ']', output));
    } else if (value && typeof value === 'object') {
      const entries = Object.entries(value);
      if (!entries.length && prefix) output[prefix] = '{}';
      entries.forEach(([key, item]) => flattenExtracted(item, prefix ? prefix + '.' + key : key, output));
    } else if (prefix) {
      output[prefix] = value === null || value === undefined ? '' : String(value);
    }
    return output;
  }

  function hasCapturedValue(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'number' || typeof value === 'boolean') return true;
    if (Array.isArray(value)) return value.some(hasCapturedValue);
    if (typeof value === 'object') return Object.values(value).some(hasCapturedValue);
    return false;
  }

  // Presentation/export filter only: the original extractedDocument remains complete.
  function pruneEmptyFields(value, parentKey = '') {
    if (Array.isArray(value)) {
      return value.map(item => pruneEmptyFields(item)).filter(item => {
        if (parentKey === 'documentFields' && item && typeof item === 'object' &&
            !Array.isArray(item) && hasCapturedValue(item.label)) return true;
        return hasCapturedValue(item);
      });
    }
    if (value && typeof value === 'object') {
      const cleaned = {};
      Object.entries(value).forEach(([key, item]) => {
        const next = pruneEmptyFields(item, key);
        const explicitBlankLabelValue = parentKey === 'documentFields' &&
          key === 'value' && hasCapturedValue(value.label);
        if (hasCapturedValue(next) || explicitBlankLabelValue) cleaned[key] = next;
      });
      return cleaned;
    }
    return value;
  }

  function buildCleanReviewView(source) {
    if (currentMode === 'invoice') return buildCleanInvoiceView(source);
    const pick = (object, keys) => {
      const result = {};
      keys.forEach(key => {
        if (object && Object.prototype.hasOwnProperty.call(object, key) && hasCapturedValue(object[key])) result[key] = object[key];
      });
      return result;
    };
    const view = pick(source, [
      'documentType','documentSubtype',
      'quotationNumber','quotationDate','validUntil','quoteReference','customerRFQ','customerPR','customerPO',
      'purchaseOrderNumber','orderDate','requiredByDate','proformaInvoiceNumber','proformaInvoiceDate',
      'supplier','supplierAddress','supplierContact','supplierEmail','supplierGSTIN',
      'buyerCustomer','buyerAddress','buyerContact','buyerEmail','buyerGSTIN','consigneeShipTo',
      'quotedScope','currency','currencySymbol','countryOrJurisdiction',
      'paymentTerms','paymentMilestones','deliveryTerms','deliveryLeadTime','warranty',
      'exclusions','assumptions','acceptanceTerms','notes','termsAndConditions',
      'discount','subtotal','taxableAmount','taxRate','taxDue','totalTax',
      'orderTotal','documentTotal','invoiceTotal','quotationTotal','quotedTotal','grandTotal',
      'otherCharges','freightCharges','installationCharges'
    ]);
    if (Array.isArray(source.lineItems)) {
      view.lineItems = source.lineItems.map(item => pick(item, [
        'description','hsnSac','quantity','unit','unitRate','discount','netAmount','taxRate','taxAmount','grossAmount','amount'
      ])).filter(hasCapturedValue);
    }
    if (Array.isArray(source.taxBreakdown)) {
      view.taxBreakdown = source.taxBreakdown.map(item => pick(item, ['label','category','rate','taxableAmount','amount'])).filter(hasCapturedValue);
    }
    if (Array.isArray(source.chargeBreakdown)) {
      view.chargeBreakdown = source.chargeBreakdown.map(item => pick(item, ['label','amount','currency','type'])).filter(hasCapturedValue);
    }
    return pruneEmptyFields(view);
  }

  function buildCleanInvoiceView(source) {
    const pick = (object, keys) => {
      const result = {};
      keys.forEach(key => {
        if (object && Object.prototype.hasOwnProperty.call(object, key) && hasCapturedValue(object[key])) result[key] = object[key];
      });
      return result;
    };
    const view = pick(source, [
      'documentType','documentSubtype','invoiceNumber','invoiceDate','dueDate',
      'supplier','supplierGSTIN','supplierAddress','buyerCustomer','buyerGSTIN',
      'buyerAddress','currency','currencySymbol','countryOrJurisdiction','paymentTerms','discount','notes','termsAndConditions'
    ]);
    if (Array.isArray(source.lineItems)) {
      view.lineItems = source.lineItems.map(item => pick(item, [
        'description','quantity','unit','unitRate','netAmount','taxRate','taxAmount','grossAmount'
      ])).filter(hasCapturedValue);
    }
    if (Array.isArray(source.taxBreakdown)) {
      view.taxBreakdown = source.taxBreakdown.map(item => pick(item, [
        'label','rate','taxableAmount','amount'
      ])).filter(hasCapturedValue);
    }
    Object.assign(view, pick(source, ['subtotal','taxDue','invoiceTotal']));
    return pruneEmptyFields(view);
  }

  function buildCleanChequeView(source) {
    const keys = [
      'documentType','bankName','branch','chequeNumber','chequeDate','payee',
      'amountFigures','amountWords','accountNumberMaskedOrVisible','ifsc','micr','drawerName'
    ];
    const view = {};
    keys.forEach(key => {
      if (Object.prototype.hasOwnProperty.call(source || {}, key) && hasCapturedValue(source[key])) view[key] = source[key];
    });
    return pruneEmptyFields(view);
  }

  function normalizeChequeDate(value) {
    const raw = String(value ?? '').trim();
    if (/^\d{8}$/.test(raw)) {
      const day = Number(raw.slice(0, 2));
      const month = Number(raw.slice(2, 4));
      const year = Number(raw.slice(4, 8));
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2099) {
        return raw.slice(0, 2) + '/' + raw.slice(2, 4) + '/' + raw.slice(4, 8);
      }
    }
    return raw;
  }

  function formatChequeAmount(value) {
    const numeric = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
    if (!Number.isFinite(numeric)) return String(value ?? '');
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric);
  }

  function parseChequeAmount(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const numeric = Number(raw.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(numeric) ? numeric : raw;
  }

  function formatInvoiceFieldLabel(path) {
    const itemMatch = path.match(/^lineItems\[(\d+)\]\.(.+)$/);
    if (itemMatch) return humanizeInvoiceKey(itemMatch[2]);
    const taxMatch = path.match(/^taxBreakdown\[(\d+)\]\.(.+)$/);
    if (taxMatch) return humanizeInvoiceKey(taxMatch[2]);
    return humanizeInvoiceKey(path);
  }

  function humanizeInvoiceKey(key) {
    return String(key).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ')
      .replace(/\b[a-z]/g, letter => letter.toUpperCase());
  }

  function invoiceSectionForPath(path) {
    if (/^lineItems\[\d+\]\./.test(path)) return 'line-item';
    if (/^taxBreakdown\[\d+\]\./.test(path)) return 'tax-row';
    if (['subtotal','taxDue','invoiceTotal','orderTotal','documentTotal','totalTax'].includes(path)) return 'invoice-total';
    return 'invoice-detail';
  }

  function applyExcelSectionStyle(sheet, headerColor, bodyColor) {
    if (!sheet || !sheet['!ref']) return;
    const range = window.XLSX.utils.decode_range(sheet['!ref']);
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const address = window.XLSX.utils.encode_cell({r:row,c:col});
        if (!sheet[address]) continue;
        sheet[address].s = {
          fill: { patternType: 'solid', fgColor: { rgb: row === range.s.r ? headerColor : bodyColor } },
          font: { name: 'Aptos', sz: 10, bold: row === range.s.r, color: { rgb: row === range.s.r ? 'FFFFFF' : '26384A' } },
          alignment: { vertical: 'center', wrapText: true },
          border: { bottom: { style: 'thin', color: { rgb: 'D9E3EC' } } }
        };
      }
    }
    sheet['!rows'] = Array.from({length: range.e.r + 1}, (_, index) => index === 0 ? {hpt:24} : {hpt:20});
  }

  function renderResults(data, pageCount) {
    const body = document.getElementById('preview-body');
    const table = document.querySelector('.data-table');
    const toolbar = document.querySelector('.preview-toolbar');
    const badge = document.querySelector('.preview-badge');
    const note = document.querySelector('.review-note');
    if (!body || !table) return;
    extractedDocument = data && typeof data === 'object' ? data : {};
    if (currentMode === 'cheque' && extractedDocument.chequeDate) {
      extractedDocument.chequeDate = normalizeChequeDate(extractedDocument.chequeDate);
    }
    const displayDocument = currentMode === 'cheque' ? buildCleanChequeView(extractedDocument) : buildCleanReviewView(extractedDocument);
    const record = flattenExtracted(displayDocument);
    const fields = Object.entries(record).map(([path, value]) => ({
      path,
      value,
      label: currentMode === 'cheque' ? humanizeInvoiceKey(path) : formatInvoiceFieldLabel(path)
    }));
    extractedRows = [{ page: pageCount, text: String(extractedDocument.rawText || ''), record, extracted: extractedDocument }];
    table.querySelector('thead').innerHTML = '<tr><th>Extracted field</th><th>Value (editable)</th></tr>';
    body.innerHTML = '';
    let previousGroup = '';
    fields.forEach(({path, value, label}) => {
      if (currentMode !== 'cheque') {
        const itemMatch = path.match(/^lineItems\[(\d+)\]\./);
        const taxMatch = path.match(/^taxBreakdown\[(\d+)\]\./);
        const group = itemMatch ? 'line-' + itemMatch[1] : taxMatch ? 'tax-' + taxMatch[1] : '';
        if (group && group !== previousGroup) {
          const heading = document.createElement('tr');
          heading.className = itemMatch ? 'invoice-group-heading invoice-group-line-item' : 'invoice-group-heading invoice-group-tax';
          const headingCell = document.createElement('td');
          headingCell.colSpan = 2;
          headingCell.textContent = itemMatch ? 'LINE ITEM ' + (Number(itemMatch[1]) + 1) : 'TAX ROW ' + (Number(taxMatch[1]) + 1);
          heading.appendChild(headingCell);
          body.appendChild(heading);
        }
        previousGroup = group;
      }
      const tr = document.createElement('tr');
      if (currentMode === 'cheque') {
        tr.classList.add(/^amount/.test(path) ? 'cheque-section-amount' :
          /^(bankName|branch|ifsc|micr)/.test(path) ? 'cheque-section-bank' :
          'cheque-section-detail');
      } else {
        tr.classList.add('invoice-section-' + invoiceSectionForPath(path));
      }
      const keyCell = document.createElement('td');
      keyCell.textContent = label;
      const valueCell = document.createElement('td');
      const isChequeAmount = currentMode === 'cheque' && path === 'amountFigures';
      valueCell.textContent = isChequeAmount && value !== '' ? formatChequeAmount(value) : value;
      valueCell.contentEditable = 'true';
      valueCell.dataset.field = path;
      valueCell.setAttribute('aria-label', 'Edit ' + label);
      tr.append(keyCell, valueCell);
      body.appendChild(tr);
    });
    if (toolbar) {
      toolbar.querySelector('b').textContent = currentMode === 'cheque' ? 'cheque-data' : 'document-data';
      toolbar.querySelector('small').textContent = 'Structured document fields · ' + fields.length + ' editable fields';
      toolbar.querySelector('.preview-status').innerHTML = '<i></i> Ready to review';
    }
    if (badge) badge.textContent = 'READY TO REVIEW';
    const reviewHeading = document.getElementById('review-heading');
    if (reviewHeading) reviewHeading.textContent = "Review your '" + getDocumentDisplayName() + "' data.";
    setProgress(100, 'Extraction complete. Review your fields before exporting.', 'complete');
    if (note) note.textContent = currentMode === 'invoice' ? 'Clean invoice review: key invoice details, line items, tax breakdown and totals. Full extraction remains preserved in the background.' : currentMode === 'cheque' ? 'Review and edit every cheque value before downloading.' : currentMode === 'quotation' ? 'Quotation review: verify quote references, validity, line items, charges, taxes and commercial terms before export.' : 'Review the detected document type and all extracted fields before export.';
    downloadButton.textContent = 'Download Excel workbook (.xlsx) ↓';
    setNotice('OpenAI extraction completed across ' + pageCount + ' page(s). Check identifiers, amounts, VAT, cheque digits and all editable fields before using the workbook.');
  }

  async function countDocumentPages(blob) {
    if (blob.type !== 'application/pdf' && !/\.pdf$/i.test(file?.name || '')) return 1;
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', () => !!window.pdfjsLib);
    const pdf = await window.pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise;
    return pdf.numPages;
  }

  async function sha256File(blob) {
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function fileToBase64(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
  }

  function setNestedValue(target, path, value) {
    const tokens = [];
    path.replace(/([^.[\]]+)|\[(\d+)\]/g, (_, key, index) => tokens.push(index === undefined ? key : Number(index)));
    if (!tokens.length) return;
    let current = target;
    tokens.forEach((token, index) => {
      if (index === tokens.length - 1) {
        current[token] = value;
      } else {
        if (current[token] === undefined || current[token] === null) current[token] = typeof tokens[index + 1] === 'number' ? [] : {};
        current = current[token];
      }
    });
  }

  async function reserveFreeDocument(pageCount, fileSha256) {
    const client = window.conficelSupabase;
    if (!client) throw new Error('Please sign in before using your free token allowance.');
    const {data:{session},error:sessionError} = await client.auth.getSession();
    if (sessionError || !session) throw new Error('Please sign in to use your free token allowance.');
    let deviceId = localStorage.getItem('conficel_trial_device_id');
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem('conficel_trial_device_id', deviceId);
    }
    const response = await fetch('/api/free-trial', {
      method:'POST',
      headers:{'content-type':'application/json',authorization:'Bearer '+session.access_token},
      body:JSON.stringify({device_id:deviceId,document_type:currentMode,page_count:pageCount,mode:currentMode,file_sha256:fileSha256})
    });
    const result = await response.json().catch(()=>({}));
    if (!response.ok || !result.allowed) throw new Error(result.message || result.error || 'Could not verify your free allowance.');
    return result;
  }
  extractButton.addEventListener('click', async () => {
    if (!file) return;
    extractButton.disabled = true;
    extractButton.textContent = 'Processing document…';
    setProgress(5, 'Preparing your document…');
    try {
      const pageCount = await countDocumentPages(file);
      setProgress(18, 'Checking document pages…');
      if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 20) throw new Error('This preview supports documents with 1 to 20 pages.');
      const fileSha256 = await sha256File(file);
      setProgress(28, 'Verifying page allowance…');
      const allowance = await reserveFreeDocument(pageCount, fileSha256);
      if (!allowance.permit) throw new Error('The server did not issue a valid extraction authorization. Please contact support before retrying.');
      const tokenBalance = document.getElementById('token-balance');
      if (tokenBalance) { const value = tokenBalance.querySelector('.token-balance-value'); if (value) value.textContent = 'ELIGIBLE ' + allowance.tokens_remaining + ' OF 20 FREE TOKENS'; }
      extractButton.textContent = 'Processing document…';
      setProgress(42, 'Uploading document securely…');
      const mimeType = /\.pdf$/i.test(file.name) ? 'application/pdf' : /\.png$/i.test(file.name) ? 'image/png' : /\.webp$/i.test(file.name) ? 'image/webp' : 'image/jpeg';
      const base64 = await fileToBase64(file);
      setProgress(58, 'Preparing document for processing…');
      const {data:{session},error:sessionError} = await window.conficelSupabase.auth.getSession();
      if (sessionError || !session) throw new Error('Your sign-in session expired. Please sign in again.');
      setProgress(68, 'Extracting document information…');
      const response = await fetch('/api/openai-parse', {
        method:'POST',
        headers:{'content-type':'application/json',authorization:'Bearer '+session.access_token},
        body:JSON.stringify({fileName:file.name,mimeType,base64,mode:currentMode,pageCount,permit:allowance.permit})
      });
      const result = await response.json().catch(()=>({}));
      setProgress(88, 'Organizing extracted fields for review…');
      if (!response.ok || !result.ok || !result.extracted) throw new Error(result.error || result.details || 'Document extraction failed. Please retry with a supported document.');
      renderResults(result.extracted, pageCount);
    } catch (err) {
      setProgress(100, err.message || 'Processing failed. Please try again.', 'error');
      if (/sign in/i.test(err.message || '')) document.getElementById('auth-open-button')?.click();
    } finally {
      extractButton.disabled = false;
      extractButton.textContent = 'Extract Document →';
    }
  });
  downloadButton.addEventListener('click', async () => {
    if (!extractedRows.length || !extractedDocument) {
      alert('Please extract a document first. The sample data is not a real extraction result.');
      return;
    }
    const extracted = JSON.parse(JSON.stringify(extractedDocument));
    const edited = {};
    [...document.querySelectorAll('#preview-body tr')].forEach(tr => {
      const cells = tr.querySelectorAll('td');
      if (cells.length > 1) {
        const field = cells[0].innerText.trim();
        const value = cells[1].innerText.trim();
        edited[field] = currentMode === 'cheque' && field === 'amountFigures' ? parseChequeAmount(value) : value;
      }
    });
    Object.entries(edited).forEach(([path, value]) => setNestedValue(extracted, path, value));
    const exportDocument = currentMode === 'cheque' ? pruneEmptyFields(extracted) : buildCleanReviewView(extracted);
    const flattened = flattenExtracted(exportDocument);
    const summary = Object.entries(flattened).map(([Field, Value]) => ({Field,Value}));
    const rawText = String(extracted.rawText || '');
    const rawRows = rawText.split(/\r?\n/).map((line,index)=>({Line:index+1,Text:line}));
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.min.js', () => !!window.XLSX);
      const wb = window.XLSX.utils.book_new();
      if (currentMode !== 'cheque') {
        // One record per row: grouped columns for document details, each line item, tax, totals and remarks.
        const headerFields = Object.fromEntries(Object.entries(exportDocument).filter(([key]) =>
          !['lineItems','taxBreakdown','chargeBreakdown','subtotal','discount','taxDue','invoiceTotal','orderTotal','documentTotal','totalTax'].includes(key)));
        const columns = [];
        const groupMerges = [];
        const addGroup = (title, entries, color) => {
          if (!entries.length) return;
          const first = columns.length;
          entries.forEach(([key,label,value]) => columns.push({key,label,value,group:title,color}));
          groupMerges.push({s:{r:0,c:first},e:{r:0,c:columns.length-1}});
        };
        addGroup('NOTES / REMARKS', [['remarks','Note / Remarks',document.getElementById('invoice-remarks')?.value || '']]);
        addGroup('DOCUMENT DETAILS', Object.entries(headerFields).map(([key,value]) => [key,formatInvoiceFieldLabel(key),value]));
        (exportDocument.lineItems || []).forEach((item,index) => {
          addGroup('LINE ITEM ' + (index+1), [
            ['description','Description',item.description],
            ['quantity','Quantity',item.quantity],
            ['unitRate','Unit Rate',item.unitRate],
            ['discount','Discount',item.discount],
            ['taxRate','Tax Rate',item.taxRate],
            ['grossAmount','Gross Amount',item.grossAmount]
          ]);
        });
        (exportDocument.taxBreakdown || []).forEach((item,index) => {
          addGroup('TAX ' + (index+1), [
            ['label','Tax Label',item.label],
            ['rate','Tax Rate',item.rate],
            ['taxableAmount','Taxable Amount',item.taxableAmount],
            ['amount','Tax Amount',item.amount]
          ].filter(([, ,value]) => hasCapturedValue(value)));
        });
        addGroup('TOTALS', [
          ['subtotal','Subtotal',exportDocument.subtotal],
          ['discount','Discount',exportDocument.discount],
          ['taxDue','Tax Due',exportDocument.taxDue],
          ['invoiceTotal','Invoice Total',exportDocument.invoiceTotal],
          ['orderTotal','Order Total',exportDocument.orderTotal],
          ['documentTotal','Document Total',exportDocument.documentTotal],
          ['totalTax','Total Tax',exportDocument.totalTax]
        ].filter(([, ,value]) => hasCapturedValue(value)));
        const rows = [
          columns.map(col => col.group),
          columns.map(col => col.label),
          columns.map(col => col.value ?? '')
        ];
        const invoiceSheet = window.XLSX.utils.aoa_to_sheet(rows);
        invoiceSheet['!merges'] = groupMerges;
        const palette = { 'NOTES / REMARKS':'E6F3E9', 'DOCUMENT DETAILS':'E8E1FA', 'TOTALS':'D8F0E2' };
        columns.forEach((col,index) => {
          const groupColor = col.group.startsWith('LINE ITEM') ? 'D7F0F1' : col.group.startsWith('TAX') ? 'FFEDCC' : (palette[col.group] || 'E8E1FA');
          [0,1,2].forEach(row => {
            const cell = invoiceSheet[window.XLSX.utils.encode_cell({r:row,c:index})];
            if (!cell) return;
            cell.s = {
              fill:{patternType:'solid',fgColor:{rgb:row===0?groupColor:(row===1?'F2F5F9':(col.group.startsWith('LINE ITEM')?'F0FAFB':groupColor))}},
              font:{name:'Aptos',sz:10,bold:row<2 || col.group==='TOTALS',color:{rgb:'24364B'}},
              alignment:{vertical:'center',wrapText:true},
              border:{bottom:{style:'thin',color:{rgb:'D7E2ED'}}}
            };
          });
        });
        invoiceSheet['!cols'] = columns.map(col => ({wch:col.label==='Description'?26:col.label==='Remarks'?32:16}));
        invoiceSheet['!rows'] = [{hpt:24},{hpt:38},{hpt:30}];
        invoiceSheet['!autofilter'] = {ref:window.XLSX.utils.encode_range({s:{r:1,c:0},e:{r:2,c:columns.length-1}})};
        window.XLSX.utils.book_append_sheet(wb, invoiceSheet, 'Invoice Data');
      } else {
        const chequeExport = buildCleanChequeView(extracted);
        const chequeFlat = { 'Note / Remarks': document.getElementById('invoice-remarks')?.value || '', ...flattenExtracted(chequeExport) };
        const wideSheet = window.XLSX.utils.json_to_sheet([chequeFlat]);
        const summarySheet = window.XLSX.utils.json_to_sheet(Object.entries(chequeFlat).map(([Field,Value])=>({Field,Value})));
        if (typeof extracted.amountFigures === 'number') {
          const amountColumn = Object.keys(chequeFlat).indexOf('amountFigures');
          if (amountColumn >= 0) {
            const amountCell = window.XLSX.utils.encode_cell({ r: 1, c: amountColumn });
            if (wideSheet[amountCell]) wideSheet[amountCell].z = '₹#,##0.00';
          }
          const amountRow = Object.keys(chequeFlat).indexOf('amountFigures');
          if (amountRow >= 0) {
            const amountCell = window.XLSX.utils.encode_cell({ r: amountRow + 1, c: 1 });
            if (summarySheet[amountCell]) summarySheet[amountCell].z = '₹#,##0.00';
          }
        }
        wideSheet['!cols'] = Object.keys(chequeFlat).map(key=>({wch:key==='amountWords'?34:key==='Remarks'?32:20}));
        applyExcelSectionStyle(wideSheet,'DCE8F8','F3F7FC');
        applyExcelSectionStyle(summarySheet,'DCE8F8','F3F7FC');
        window.XLSX.utils.book_append_sheet(wb, wideSheet, 'Cheque Data');
        window.XLSX.utils.book_append_sheet(wb, summarySheet, 'Field Summary');
        const textSheet = window.XLSX.utils.json_to_sheet(rawRows.length ? rawRows : [{Line:1,Text:rawText}]);
        window.XLSX.utils.book_append_sheet(wb, textSheet, 'Full Extracted Text');
      }
      window.XLSX.writeFile(wb, getExportBaseName() + '.xlsx');
    } catch (err) {
      const rows = [['Field','Value'],['Note / Remarks',document.getElementById('invoice-remarks')?.value || ''],...Object.entries(flattened)];
      const csv = rows.map(row=>row.map(value=>'"'+String(value??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}));
      const link = document.createElement('a'); link.href=url; link.download=getExportBaseName()+'.csv';
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      setNotice('Excel library could not load, so a CSV fallback was downloaded. Check your internet connection.',true);
    }
  });


})();

// Supplied dynamic document presets and linked field highlighting.
(() => {
  const samples = {
    tax_invoice:{label:"TAX INVOICE",supplier:"Northerner Ltd",number:"INV-1048",date:"18 Oct 2026",total:"$2,480.00",itemOne:"Polymer Resin · 2 kg",itemTwo:"Processing charge · 1 lot"},
    purchase_order:{label:"PURCHASE ORDER",supplier:"Acme Logistics Corp",number:"PO-88219",date:"04 Nov 2026",total:"$12,350.50",itemOne:"Industrial components · 5 pcs",itemTwo:"Packaging materials · 20 units"},
    proforma:{label:"PROFORMA INVOICE",supplier:"Global Tech Supplies",number:"PF-4402",date:"01 Nov 2026",total:"$6,120.00",itemOne:"Laboratory equipment · 2 pcs",itemTwo:"Technical service · 1 lot"},
    cheque:{label:"CHEQUE RECEIPT",supplier:"Apex Financial Services",number:"CHQ-00912",date:"29 Oct 2026",total:"₹1,850.25",itemOne:"",itemTwo:""}
  };
  const put=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
  document.querySelectorAll(".ddh-preset").forEach(button=>{
    button.addEventListener("click",()=>{
      const sample=samples[button.dataset.preset];if(!sample)return;
      document.querySelectorAll(".ddh-preset").forEach(b=>b.classList.toggle("active",b===button));
      const heroCard=document.getElementById("heroDocumentCard");if(heroCard)heroCard.classList.toggle("is-cheque",button.dataset.preset==="cheque");
      put("docTypeLabel",sample.label);
      put("docSupplierVal",sample.supplier);put("tableSupplierVal",sample.supplier);
      put("docInvNoVal",sample.number);put("tableInvNoVal",sample.number);
      put("docDateVal",sample.date);put("tableDateVal",sample.date);
      put("docTotalVal",sample.total);put("tableTotalVal",sample.total);
      put("docItemOneVal",sample.itemOne);put("docItemTwoVal",sample.itemTwo);
      put("tableItemOneVal",sample.itemOne);put("tableItemTwoVal",sample.itemTwo);
      const chequeMode=button.dataset.preset==="cheque";
      ["bbox-item-one","bbox-item-two","row-item-one","row-item-two"].forEach(id=>{const el=document.getElementById(id);if(el)el.hidden=chequeMode;});
      const itemOne=document.getElementById("row-item-one"),itemTwo=document.getElementById("row-item-two");
      if(itemOne)itemOne.hidden=button.dataset.preset==="cheque";
      if(itemTwo)itemTwo.hidden=button.dataset.preset==="cheque";
    });
  });
  document.querySelectorAll(".field-bbox[data-pair],.data-row[data-pair]").forEach(el=>{
    const key=el.dataset.pair;
    el.addEventListener("mouseenter",()=>document.querySelectorAll('[data-pair="'+key+'"]').forEach(pair=>pair.classList.add("active")));
    el.addEventListener("mouseleave",()=>document.querySelectorAll('[data-pair="'+key+'"]').forEach(pair=>pair.classList.remove("active")));
  });
  if(window.lucide)window.lucide.createIcons();
})();
