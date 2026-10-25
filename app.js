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
    const productMatch = clean.match(/(?:name\\s+of\\s+product\\s+qty\\s+rate\\s*(?:₹|rs\\.?|inr)?\\s*amount\\s*(?:₹|rs\\.?|inr)?\\s*)?([A-Za-z][A-Za-z0-9 &().,/-]{2,60}?)\\s+(\\d{1,8})\\s+([0-9][0-9,]*(?:\\.[0-9]{1,2})?)\\s+([0-9][0-9,]*(?:\\.[0-9]{1,2})?)(?=\\s+(?:add:|cgst|sgst|igst|cess|sub\\s*total|total|freight|electronically generated|$))/i);;