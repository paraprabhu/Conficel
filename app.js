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
  let extractedDocument = null;
  document.getElementById('year').textContent = new Date().getFullYear();

  // The selected document is sent securely to the server-side OpenAI parser after sign-in and token reservation.
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
    const chequeVisual = document.getElementById('cheque-workspace-art');
    if (chequeVisual) chequeVisual.hidden = mode !== 'cheque';
    const workspace = document.querySelector('.workspace');
    if (workspace) workspace.classList.toggle('workspace-cheque-mode', mode === 'cheque');
    const heading = document.querySelector('.workspace-heading p');
    if (heading) heading.textContent = 'Upload a PDF, JPG or PNG. OpenAI extracts document fields on the secure server; review every result before exporting.';
  }
  document.querySelectorAll('.mode-tab').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
  document.querySelectorAll('.tool-card[data-mode]').forEach(card => card.addEventListener('click', () => setMode(card.dataset.mode)));

  function setNotice(message, isError = false) {
    const notice = document.querySelector('.notice');
    if (!notice) return;
    notice.innerHTML = '<span>' + (isError ? '⚠' : 'ⓘ') + '</span><p><b>' +
      (isError ? 'Could not extract this file' : 'Secure AI document processing') +
      '</b><br>' + message + '</p>';
    notice.classList.toggle('notice-error', isError);
  }
  function showFile(candidate) {
    if (!candidate) return;
    const allowed = /\.(pdf|png|jpe?g|webp)$/i.test(candidate.name);
    if (!allowed) { alert('Please choose a PDF, JPG or PNG file.'); return; }
    if (candidate.size > maxBytes) { alert('Please choose a file smaller than 10 MB.'); return; }
    file = candidate;
    extractedRows = [];
    extractedDocument = null;
    selectedName.textContent = candidate.name + ' · ' + (candidate.size < 1024 * 1024 ? Math.max(1, Math.round(candidate.size / 1024)) + ' KB' : (candidate.size / (1024 * 1024)).toFixed(1) + ' MB');
    selectedFile.hidden = false;
    dropZone.hidden = true;
    extractButton.disabled = false;
    extractButton.textContent = 'Extract with OpenAI →';
    setNotice('Your file will be uploaded over HTTPS for OpenAI extraction after your sign-in and free-token allowance are verified.');
  }
  fileInput.addEventListener('change', event => showFile(event.target.files[0]));
  removeButton.addEventListener('click', () => {
    file = null; extractedRows = []; extractedDocument = null; fileInput.value = ''; selectedFile.hidden = true; dropZone.hidden = false;
    extractButton.disabled = true; extractButton.textContent = 'Extract with OpenAI →';
    setNotice('Choose a PDF, JPG, PNG or WEBP document to extract.');
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

  function renderResults(data, pageCount) {
    const body = document.getElementById('preview-body');
    const table = document.querySelector('.data-table');
    const toolbar = document.querySelector('.preview-toolbar');
    const badge = document.querySelector('.preview-badge');
    const note = document.querySelector('.review-note');
    if (!body || !table) return;
    extractedDocument = data && typeof data === 'object' ? data : {};
    const record = flattenExtracted(extractedDocument);
    const fields = Object.entries(record);
    extractedRows = [{ page: pageCount, text: String(extractedDocument.rawText || ''), record, extracted: extractedDocument }];
    table.querySelector('thead').innerHTML = '<tr><th>Extracted field</th><th>Value (editable)</th></tr>';
    body.innerHTML = '';
    fields.forEach(([key, value]) => {
      const tr = document.createElement('tr');
      const keyCell = document.createElement('td');
      keyCell.textContent = key;
      const valueCell = document.createElement('td');
      valueCell.textContent = value;
      valueCell.contentEditable = 'true';
      valueCell.dataset.field = key;
      valueCell.setAttribute('aria-label', 'Edit ' + key);
      tr.append(keyCell, valueCell);
      body.appendChild(tr);
    });
    if (toolbar) {
      toolbar.querySelector('b').textContent = currentMode === 'cheque' ? 'cheque-data' : 'invoice-data';
      toolbar.querySelector('small').textContent = 'OpenAI structured extraction · ' + fields.length + ' editable fields';
      toolbar.querySelector('.preview-status').innerHTML = '<i></i> Review extracted fields';
    }
    if (badge) badge.textContent = 'OPENAI EXTRACTION';
    if (note) note.textContent = 'Review and edit every value before downloading. Nested line items, tax rows, document references, sections and full source text are retained in the workbook.';
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
    extractButton.textContent = 'Preparing secure extraction…';
    try {
      const pageCount = await countDocumentPages(file);
      if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 20) throw new Error('This preview supports documents with 1 to 20 pages.');
      const fileSha256 = await sha256File(file);
      const allowance = await reserveFreeDocument(pageCount, fileSha256);
      if (!allowance.permit) throw new Error('The server did not issue a valid extraction authorization. Please contact support before retrying.');
      const tokenBalance = document.getElementById('token-balance');
      if (tokenBalance) tokenBalance.textContent = allowance.tokens_remaining + ' of 20 free tokens remaining · ' + pageCount + ' token(s) reserved';
      extractButton.textContent = 'Extracting with OpenAI…';
      setNotice('Uploading securely and extracting all pages with OpenAI. Please keep this page open.');
      const mimeType = file.type || (/\.pdf$/i.test(file.name) ? 'application/pdf' : /\.png$/i.test(file.name) ? 'image/png' : /\.webp$/i.test(file.name) ? 'image/webp' : 'image/jpeg');
      const base64 = await fileToBase64(file);
      const {data:{session},error:sessionError} = await window.conficelSupabase.auth.getSession();
      if (sessionError || !session) throw new Error('Your sign-in session expired. Please sign in again.');
      const response = await fetch('/api/openai-parse', {
        method:'POST',
        headers:{'content-type':'application/json',authorization:'Bearer '+session.access_token},
        body:JSON.stringify({fileName:file.name,mimeType,base64,mode:currentMode,pageCount,permit:allowance.permit})
      });
      const result = await response.json().catch(()=>({}));
      if (!response.ok || !result.ok || !result.extracted) throw new Error(result.error || result.details || 'OpenAI extraction failed. Please retry with a supported document.');
      renderResults(result.extracted, pageCount);
      const usage = result.usage?.totalTokens ? ' OpenAI used ' + result.usage.totalTokens + ' model tokens.' : '';
      setNotice('Document extracted by OpenAI across ' + pageCount + ' page(s). ' + allowance.tokens_remaining + ' of 20 free page tokens remain.' + usage + ' Verify every value before export.');
    } catch (err) {
      setNotice(err.message || 'Extraction failed. Try another file.', true);
      if (/sign in/i.test(err.message || '')) document.getElementById('auth-open-button')?.click();
    } finally {
      extractButton.disabled = false;
      extractButton.textContent = 'Extract with OpenAI →';
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
      if (cells.length > 1) edited[cells[0].innerText.trim()] = cells[1].innerText.trim();
    });
    Object.entries(edited).forEach(([path, value]) => setNestedValue(extracted, path, value));
    const flattened = flattenExtracted(extracted);
    const summary = Object.entries(flattened).map(([Field, Value]) => ({Field,Value}));
    const rawText = String(extracted.rawText || '');
    const rawRows = rawText.split(/\\r?\\n/).map((line,index)=>({Line:index+1,Text:line}));
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', () => !!window.XLSX);
      const wb = window.XLSX.utils.book_new();
      const wideSheet = window.XLSX.utils.json_to_sheet([flattened]);
      const summarySheet = window.XLSX.utils.json_to_sheet(summary);
      const textSheet = window.XLSX.utils.json_to_sheet(rawRows.length ? rawRows : [{Line:1,Text:rawText}]);
      window.XLSX.utils.book_append_sheet(wb, wideSheet, currentMode === 'cheque' ? 'Cheque Data' : 'Document Data');
      window.XLSX.utils.book_append_sheet(wb, summarySheet, 'Field Summary');
      window.XLSX.utils.book_append_sheet(wb, textSheet, 'Full Extracted Text');
      const addArraySheet = (key, title) => {
        if (Array.isArray(extracted[key]) && extracted[key].length) {
          const rows = extracted[key].map(row => row && typeof row === 'object' ? row : {Value:row});
          window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(rows), title);
        }
      };
      addArraySheet('lineItems','Line Items');
      addArraySheet('taxBreakdown','Tax Breakdown');
      addArraySheet('chargeBreakdown','Charges');
      addArraySheet('amountSummaryRows','Amount Summary');
      addArraySheet('documentIdentifiers','References');
      addArraySheet('documentFields','Other Fields');
      addArraySheet('sections','Document Sections');
      window.XLSX.writeFile(wb, currentMode === 'cheque' ? 'conficel-cheque-data.xlsx' : 'conficel-document-data.xlsx');
    } catch (err) {
      const rows = [['Field','Value'],...Object.entries(flattened),['Full extracted text',rawText]];
      const csv = rows.map(row=>row.map(value=>'"'+String(value??'').replace(/"/g,'""')+'"').join(',')).join('\\r\\n');
      const url = URL.createObjectURL(new Blob(['\\ufeff'+csv],{type:'text/csv;charset=utf-8;'}));
      const link = document.createElement('a'); link.href=url; link.download='conficel-extracted-data.csv';
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      setNotice('Excel library could not load, so a CSV fallback was downloaded. Check your internet connection.',true);
    }
  });
