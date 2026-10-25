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
      if (match && match[1]) return match[1].replace(/\\s+/g, ' ').trim().replace(/[,:;]+$/, '');
    }
    return '';
  }
  function structuredRecord(text) {
    const clean = text.replace(/\\s+/g, ' ').trim();
    const amount = (labels) => firstMatch(clean, labels.map(label =>
      new RegExp('(?:' + label + ')\\\\s*(?:[:#-]\\\\s*)?(?:₹|INR\\\\s*)?([0-9][0-9,]*(?:\\\\.[0-9]{1,2})?)', 'i')
    ));
    if (currentMode === 'cheque') {
      return {
        'Document Type': 'Cheque',
        'Cheque Number': firstMatch(clean, [/cheque\\s*(?:no|number|#)\\s*[:#-]?\\s*([A-Z0-9-]+)/i]),
        'Cheque Date': firstMatch(clean, [/(?:date)\\s*[:#-]?\\s*(\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4})/i]),
        'Payee': firstMatch(clean, [/(?:pay(?:ee)?\\s+to|pay\\s+to)\\s*[:#-]?\\s*(.{2,70}?)(?=\\s+(?:rupees|₹|\*|a/c|account|date)\\b)/i]),
        'Amount': amount(['amount in figures','amount','₹']),
        'Amount in words': firstMatch(clean, [/(?:rupees|amount in words)\\s*[:#-]?\\s*(.{3,100}?)(?=\\s+(?:a/c|account|signature|date)\\b)/i]),
        'Raw extracted text': clean
      };
    }
    return {
      'Document Type': 'Invoice',
      'Invoice Number': firstMatch(clean, [/(?:invoice\\s*(?:no|number|#)|inv\\.?\\s*(?:no|#))\\s*[:#-]?\\s*([A-Z0-9/-]+)/i]),
      'Invoice Date': firstMatch(clean, [/(?:invoice\\s*date|date)\\s*[:#-]?\\s*(\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}|\\d{1,2}\\s+[A-Za-z]{3,9}\\s+\\d{4})/i]),
      'Supplier': firstMatch(clean, [/(?:supplier|seller|billed\\s*by|sold\\s*by|from)\\s*[:#-]?\\s*([A-Z][A-Z0-9 &.,()/-]{2,70}?)(?=\\s+(?:gstin|gst\\s*no|address|invoice|buyer|bill\\s*to|customer)\\b)/i]),
      'Supplier GSTIN': firstMatch(clean, [/(?:supplier\\s*)?gstin\\s*[:#-]?\\s*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z])/i, /gstin\\s*[:#-]?\\s*([A-Z0-9]{15})/i]),
      'Buyer / Customer': firstMatch(clean, [/(?:billed\\s*to|bill\\s*to|customer|buyer)\\s*[:#-]?\\s*(.{2,70}?)(?=\\s+(?:gstin|gst\\s*no|address|invoice\\s*date|invoice\\s*no|date)\\b)/i]),
      'Taxable Amount': amount(['taxable amount','taxable value','sub total','subtotal','total before tax']),
      'CGST': amount(['add:?\\s*cgst','cgst']),
      'SGST': amount(['add:?\\s*sgst','sgst']),
      'IGST': amount(['add:?\\s*igst','igst']),
      'Invoice Total': amount(['grand total','invoice total','total amount','total']),
      'Raw extracted text': clean
    };
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
    const rawRows = (record['Raw extracted text'] || extractedRows[0].text || '').split(/\\r?\\n/).map((line, index) => ({ Line: index + 1, Text: line }));
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', () => !!window.XLSX);
      const wb = window.XLSX.utils.book_new();
      const summary = Object.entries(record).filter(([key]) => key !== 'Raw extracted text').map(([Field, Value]) => ({ Field, Value }));
      const summarySheet = window.XLSX.utils.json_to_sheet(summary);
      const textSheet = window.XLSX.utils.json_to_sheet(rawRows);
      window.XLSX.utils.book_append_sheet(wb, summarySheet, currentMode === 'cheque' ? 'Cheque Fields' : 'Invoice Fields');
      window.XLSX.utils.book_append_sheet(wb, textSheet, 'Full Extracted Text');
      window.XLSX.writeFile(wb, currentMode === 'cheque' ? 'conficel-cheque-data.xlsx' : 'conficel-invoice-data.xlsx');
    } catch (err) {
      const rows = [['Field', 'Value'], ...Object.entries(record).filter(([key]) => key !== 'Raw extracted text'), ['Full extracted text', record['Raw extracted text'] || extractedRows[0].text || '']];
      const csv = rows.map(row => row.map(value => '"' + String(value ?? '').replace(/"/g, '""') + '"').join(',')).join('\\r\\n');
      const url = URL.createObjectURL(new Blob(['\\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a'); link.href = url; link.download = 'conficel-extracted-data.csv';
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      setNotice('Excel library could not load, so a CSV fallback was downloaded. Check your internet connection.', true);
    }
  });
})();