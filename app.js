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
  function renderResults(pages) {
    const body = document.getElementById('preview-body');
    const table = document.querySelector('.data-table');
    const toolbar = document.querySelector('.preview-toolbar');
    const badge = document.querySelector('.preview-badge');
    const note = document.querySelector('.review-note');
    if (!body || !table) return;
    const lines = [];
    pages.forEach(p => (p.text || '').split(/\r?\n|(?<=\.)\s{2,}/).map(s => s.trim()).filter(Boolean).forEach(text => lines.push({ page: p.page, text })));
    extractedRows = lines.length ? lines : [{ page: 1, text: 'No readable text detected. Try a clearer scan or image.' }];
    table.querySelector('thead').innerHTML = '<tr><th>Page</th><th>Extracted text</th></tr>';
    body.innerHTML = '';
    extractedRows.forEach((row, index) => {
      const tr = document.createElement('tr');
      const pageCell = document.createElement('td'); pageCell.textContent = String(row.page);
      const textCell = document.createElement('td'); textCell.textContent = row.text; textCell.contentEditable = 'true'; textCell.setAttribute('aria-label', 'Edit extracted text line ' + (index + 1));
      tr.append(pageCell, textCell); body.appendChild(tr);
    });
    if (toolbar) {
      toolbar.querySelector('b').textContent = 'extracted-text';
      toolbar.querySelector('small').textContent = 'Editable text · ' + extractedRows.length + ' lines';
      toolbar.querySelector('.preview-status').innerHTML = '<i></i> Extracted text';
    }
    if (badge) badge.textContent = 'EXTRACTED TEXT';
    if (note) note.textContent = 'Review the text for OCR errors. This initial version extracts text; it does not yet reliably classify invoice fields or validate cheque details.';
    downloadButton.textContent = 'Download extracted text CSV ↓';
    setNotice('Extraction finished in your browser. Review the text for errors before using it. No file was uploaded to ConfiCel servers.');
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
  downloadButton.addEventListener('click', () => {
    if (!extractedRows.length) {
      alert('Please extract a document first. The sample data is not a real extraction result.');
      return;
    }
    const bodyRows = [...document.querySelectorAll('#preview-body tr')].map((tr, i) => {
      const cells = tr.querySelectorAll('td');
      return [cells[0]?.innerText.trim() || String(i + 1), cells[1]?.innerText.trim() || ''];
    });
    const rows = [['Page', 'Extracted text'], ...bodyRows].map(row => row.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(','));
    const blob = new Blob(['\ufeff' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'conficel-extracted-text.csv'; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  });
})();