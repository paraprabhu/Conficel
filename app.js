(() => {
  const fileInput = document.getElementById('file-input');
  const dropZone = document.getElementById('drop-zone');
  const selectedFile = document.getElementById('selected-file');
  const selectedName = document.getElementById('selected-file-name');
  const extractButton = document.getElementById('extract-button');
  const removeButton = document.getElementById('remove-file');
  const downloadButton = document.getElementById('download-button');
  const maxBytes = 10 * 1024 * 1024;
  let currentMode = 'invoice';
  let file = null;
  let extractedRows = [];
  document.getElementById('year').textContent = new Date().getFullYear();

  // This first extraction stage runs in the user's browser. Files are not sent to ConfiCel servers.
  function setMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-tab').forEach(button => {
      const active = button.dataset.mode === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.tool-card[data-mode]').forEach(card => {
      card.classList.toggle('selected-tool', card.dataset.mode === mode);
    });
    dropZone.querySelector('strong').textContent = mode === 'cheque' ? 'Choose a cheque image or PDF' : 'Choose a file or drop it here';
    const heading = document.querySelector('.workspace-heading p');
    if (heading) heading.textContent = 'Choose a PDF, JPG or PNG. Text extraction and OCR run locally in your browser in this initial version.';
  }
  document.querySelectorAll('.mode-tab').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
  document.querySelectorAll('.tool-card[data-mode]').forEach(card => card.addEventListener('click', () => setMode(card.dataset.mode)));

  function setNotice(message, isError = false) {
    const notice = document.querySelector('.notice');
    if (!notice) return;
    notice.innerHTML = '<span>' + (isError ? '⚠' : 'ⓘ') + '</span><p><b>' +
      (isError ? 'Could not extract this file' : 'Browser-based processing') +
      '</b><br>' + message + '</p>';
    notice.classList.toggle('notice-error', isError);
  }
  function showFile(candidate) {
    if (!candidate) return;
    const allowed = /\.(pdf|png|jpe?g)$/i.test(candidate.name);
    if (!allowed) { alert('Please choose a PDF, JPG or PNG file.'); return; }
    if (candidate.size > maxBytes) { alert('Please choose a file smaller than 10 MB.'); return; }
    file = candidate;
    extractedRows = [];
    selectedName.textContent = candidate.name + ' · ' + (candidate.size < 1024 * 1024 ? Math.max(1, Math.round(candidate.size / 1024)) + ' KB' : (candidate.size / (1024 * 1024)).toFixed(1) + ' MB');
    selectedFile.hidden = false;
    dropZone.hidden = true;
    extractButton.disabled = false;
    extractButton.textContent = 'Extract document text →';
    setNotice('The selected file will be processed locally in your browser. It is not uploaded to ConfiCel servers. Check the extracted text before relying on it.');
  }
  fileInput.addEventListener('change', event => showFile(event.target.files[0]));
  removeButton.addEventListener('click', () => {
    file = null; extractedRows = []; fileInput.value = ''; selectedFile.hidden = true; dropZone.hidden = false;
    extractButton.disabled = true; extractButton.textContent = 'Extract document text →';
    setNotice('Choose a file to extract text locally in your browser.');
  });
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
        const re = new RegExp('(?:' + label + ')\\s*(?:[:#-]\\s*)?(?:₹|INR\\s*)?([0-9][0-9,]*(?:\\.[0-9]{1,2})?)', 'i');
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
    const invoiceNo = pick([/(?:invoice\s*(?:no|number|#)|inv\.?\s*(?:no|#))\s*[:#-]?\s*([A-Z0-9/-]+)/i, /\binvoice\s*no\s+([A-Z0-9/-]+)/i]);
    const date = pick([/(?:invoice\s*date|invoice\s*dated|date)\s*[:#-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/i]);
    const supplierGstin = gstins[0] || '';
    const buyerGstin = gstins.length > 1 ? gstins[1] : '';
    const buyer = pick([/(?:details of receiver\s*\|?\s*billed to|billed to|bill to|customer|buyer)\s*[:#-]?\s*(?:name\s*[:#-]?\s*)?(.{2,80}?)(?=\s+(?:address|gstin|state|invoice date|invoice no|date)\b)/i]);
    const productMatch = clean.match(/([A-Za-z][A-Za-z0-9 &().,/-]{2,60}?)\s+(\d{4,8})\s+([0-9,]+(?:\.[0-9]+)?)\s+(kg|kgs|lit|ltr|ltrs|nos|pcs|unit|units)\s+(?:₹\s*)?([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s+(?:₹\s*)?([0-9][0-9,]*(?:\.[0-9]{1,2})?)(?=\s|$)/i);
    const hsn = productMatch ? productMatch[2] : pick([/(?:hsn\s*(?:acs|sac|code)?|sac\s*(?:code)?)\s*[:#-]?\s*([0-9]{4,8})/i]);
    const productName = productMatch ? productMatch[1].trim() : '';
    const quantity = productMatch ? productMatch[3] : '';
    const total = amount(['total amount','grand total','total invoice amount','invoice total','amount payable','net amount']);
    const subtotal = amount(['sub\s*total','subtotal','taxable amount','taxable value','total before tax','assessable value']);
    const cgst = amount(['add:?\s*cgst','cgst']);
    const sgst = amount(['add:?\s*sgst','sgst']);
    const igst = amount(['add:?\s*igst','igst']);
    const taxValues = [cgst, sgst, igst].map(v => Number(v || 0));
    const totalTax = taxValues.some(v => v > 0) ? String(taxValues.reduce((x,y) => x+y, 0)) : '';
    return {
      'Document Type': pick([/(proforma\s+invoice|tax invoice|invoice|credit note|debit note)/i]) || 'Invoice',
      'Invoice Number': invoiceNo,
      'Invoice Date': date,
      'Supplier': pick([/\bEMCULE\b/i, /(?:supplier|seller|billed by|sold by|from)\s*[:#-]?\s*([A-Z][A-Z0-9 &.,()/-]{2,70}?)(?=\s+(?:gstin|gst\s*no|address|invoice|buyer|bill to|customer)\b)/i]),
      'Supplier GSTIN': supplierGstin,
      'Supplier Address': pick([/(?:h\.?o\.?|head office)\s*[:#-]?\s*(.{10,120}?)(?=\s+(?:mumbai office|phone|email|gst)\b)/i]),
      'Supplier Contact': pick([/(?:phone|tel|mobile)\s*[:#-]?\s*([+0-9 ()-]{8,20})/i]),
      'Buyer / Customer': buyer,
      'Buyer GSTIN': buyerGstin,
      'Buyer Address': pick([/(?:address\s*[:#-]?\s*)(121\s+ansal town.{5,100}?)(?=\s+(?:gstin|state|state code)\b)/i]),
      'Consignee / Ship To': pick([/(?:details of consignee\s*\|?\s*shipped to.{0,80}?name\s*[:#-]?\s*)(.{2,80}?)(?=\s+address\b)/i]),
      'State': pick([/state\s+(Uttar Pradesh|Maharashtra|Karnataka|Gujarat|Delhi|Tamil Nadu|Rajasthan|Haryana|Telangana|Kerala|West Bengal|Punjab|Madhya Pradesh|Andhra Pradesh)\b/i]),
      'State Code': pick([/state code\s*[:#-]?\s*(\d{1,2})/i]),
      'Purchase Order Number': pick([/(?:ref\.?\s*po\s*no|purchase\s*order|po)\s*(?:no|number|#)?\s*[:#-]?\s*([A-Z0-9/-]{3,30})/i]),
      'Product Description': productName,
      'HSN / SAC': hsn,
      'Quantity': quantity,
      'Unit': pick([/\b(?:unit)\s*[:#-]?\s*(kg|kgs|lit|ltr|ltrs|nos|pcs|units?)\b/i]),
      'Unit Rate': pick([/\b(?:rate)\s*(?:₹)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i]),
      'Taxable Amount': subtotal,
      'CGST': cgst,
      'SGST': sgst,
      'IGST': igst,
      'CESS': amount(['add:?\s*cess','cess']),
      'Total Tax': totalTax,
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

  function renderResults(pages) {
    const body = document.getElementById('preview-body');
    const table = document.querySelector('.data-table');
    const toolbar = document.querySelector('.preview-toolbar');
    const badge = document.querySelector('.preview-badge');
    const note = document.querySelector('.review-note');
    if (!body || !table) return;
    const allText = pages.map(p => p.text || '').filter(Boolean);
    const fullText = allText.join(' ');
    const record = structuredRecord(fullText);
    const fields = Object.entries(record).filter(([key]) => key !== 'Raw extracted text');
    extractedRows = [{ page: 1, text: fullText, record }];
    table.querySelector('thead').innerHTML = '<tr><th>Invoice / cheque field</th><th>Extracted value (editable)</th></tr>';
    body.innerHTML = '';
    fields.forEach(([key, value], index) => {
      const tr = document.createElement('tr');
      const keyCell = document.createElement('td'); keyCell.textContent = key;
      const valueCell = document.createElement('td'); valueCell.textContent = value || ''; valueCell.contentEditable = 'true';
      valueCell.dataset.field = key;
      valueCell.setAttribute('aria-label', 'Edit ' + key);
      tr.append(keyCell, valueCell); body.appendChild(tr);
    });
    if (toolbar) {
      toolbar.querySelector('b').textContent = currentMode === 'cheque' ? 'cheque-data' : 'invoice-data';
      toolbar.querySelector('small').textContent = 'Editable fields · ' + fields.length + ' columns';
      toolbar.querySelector('.preview-status').innerHTML = '<i></i> Review extracted fields';
    }
    if (badge) badge.textContent = 'STRUCTURED PREVIEW';
    if (note) note.textContent = 'Field detection is best-effort and may miss or mislabel values. Check every field and edit it before exporting. Full extracted text is also included in the workbook.';
    downloadButton.textContent = 'Download Excel workbook (.xlsx) ↓';
    setNotice('Text extraction finished in your browser. Detected invoice/cheque fields are estimates; review them carefully. Your file was not uploaded to ConfiCel servers.');
  }
  extractButton.addEventListener('click', async () => {
    if (!file) return;
    extractButton.disabled = true;
    extractButton.textContent = 'Processing…';
    try {
      let pages;
      if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') pages = await getPdfText(file);
      else pages = await getImageText(file);
      renderResults(pages);
    } catch (err) {
      setNotice(err.message || 'Extraction failed. Try another file.', true);
    } finally {
      extractButton.disabled = false;
      extractButton.textContent = 'Extract document text →';
    }
  });
  downloadButton.addEventListener('click', async () => {
    if (!extractedRows.length) {
      alert('Please extract a document first. The sample data is not a real extraction result.');
      return;
    }
    const record = { ...(extractedRows[0].record || {}) };
    [...document.querySelectorAll('#preview-body tr')].forEach(tr => {
      const cells = tr.querySelectorAll('td');
      if (cells.length > 1) record[cells[0].innerText.trim()] = cells[1].innerText.trim();
    });
    const rawRows = (record['Raw extracted text'] || extractedRows[0].text || '').split(/\r?\n/).map((line, index) => ({ Line: index + 1, Text: line }));
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', () => !!window.XLSX);
      const wb = window.XLSX.utils.book_new();
      const fields = Object.entries(record).filter(([key]) => key !== 'Raw extracted text');
      // One document per row, with each detected field in its own column.
      const wideRecord = Object.fromEntries(fields);
      const wideSheet = window.XLSX.utils.json_to_sheet([wideRecord]);
      const summary = fields.map(([Field, Value]) => ({ Field, Value }));
      const summarySheet = window.XLSX.utils.json_to_sheet(summary);
      const textSheet = window.XLSX.utils.json_to_sheet(rawRows);
      const lineItems = currentMode === 'invoice' ? extractLineItems(extractedRows[0].text || '') : [];
      const itemsSheet = window.XLSX.utils.json_to_sheet(lineItems.length ? lineItems : [{ 'Item Description': 'No line items confidently detected — review source invoice', 'Quantity': '', 'Unit Rate': '', 'Line Amount': '' }]);
      window.XLSX.utils.book_append_sheet(wb, wideSheet, currentMode === 'cheque' ? 'Cheque Data' : 'Invoice Data');
      window.XLSX.utils.book_append_sheet(wb, summarySheet, 'Field Summary');
      window.XLSX.utils.book_append_sheet(wb, textSheet, 'Full Extracted Text');
      if (currentMode === 'invoice') window.XLSX.utils.book_append_sheet(wb, itemsSheet, 'Line Items');
      window.XLSX.writeFile(wb, currentMode === 'cheque' ? 'conficel-cheque-data.xlsx' : 'conficel-invoice-data.xlsx');
    } catch (err) {
      const rows = [['Field', 'Value'], ...Object.entries(record).filter(([key]) => key !== 'Raw extracted text'), ['Full extracted text', record['Raw extracted text'] || extractedRows[0].text || '']];
      const csv = rows.map(row => row.map(value => '"' + String(value ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a'); link.href = url; link.download = 'conficel-extracted-data.csv';
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      setNotice('Excel library could not load, so a CSV fallback was downloaded. Check your internet connection.', true);
    }
  });
})();