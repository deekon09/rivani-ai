// RIVANI AI V37.4 · PDF to Text extension for Image to Text
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const input = $('ocrFileInput');
  const drop = $('ocrDropZone');
  const imageEditor = $('ocrEditor');
  const runButton = $('runOcrBtn');
  const workbench = $('pdfWorkbench');
  if (!input || !drop || !runButton || !workbench) return;

  const ui = {
    fileName: $('pdfFileName'), fileMeta: $('pdfFileMeta'), clear: $('pdfClear'), another: $('pdfChooseAnother'),
    canvas: $('pdfPreviewCanvas'), previewLoading: $('pdfPreviewLoading'), previewMethod: $('pdfPreviewMethod'),
    prev: $('pdfPrevPage'), next: $('pdfNextPage'), pageLabel: $('pdfPageLabel'),
    summary: $('pdfDetectionSummary'), list: $('pdfPageList'), strategy: $('pdfStrategy'),
    all: $('pdfSelectAll'), scanned: $('pdfSelectScanned'), text: $('pdfSelectText'), none: $('pdfSelectNone'),
    runNote: $('pdfRunNote'), extract: $('pdfExtractBtn'),
    processing: $('pdfProcessing'), processingTitle: $('pdfProcessingTitle'), processingText: $('pdfProcessingText'),
    progressFill: $('pdfProgressFill'), progressPercent: $('pdfProgressPercent'), progressStep: $('pdfProgressStep'),
    result: $('pdfResult'), resultBadge: $('pdfResultBadge'), resultPages: $('pdfResultPages'), directPages: $('pdfDirectPages'),
    ocrPages: $('pdfOcrPages'), ocrConfidence: $('pdfOcrConfidence'), view: $('pdfResultView'), output: $('pdfTextOutput'),
    copy: $('pdfCopy'), txt: $('pdfDownloadTxt'), md: $('pdfDownloadMd'), json: $('pdfDownloadJson'), csv: $('pdfExportCsv'),
    privacy: $('pdfPrivacyScan'), privacyNote: $('pdfPrivacyNote'), find: $('pdfFind'), findNote: $('pdfFindNote')
  };

  const MAX_PDF_BYTES = 40 * 1024 * 1024;
  const MAX_PDF_PAGES = 80;
  const MAX_RENDER_PIXELS = 8_000_000;
  const MIN_DIRECT_CHARS = 20;
  const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

  const state = {
    active: false,
    busy: false,
    file: null,
    doc: null,
    pages: [],
    currentPage: 1,
    results: [],
    worker: null,
    workerLang: '',
    previewTask: null
  };

  const isPdf = file => !!file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || ''));
  const formatBytes = bytes => {
    if (!Number.isFinite(bytes)) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 100 * 1024 ? 1 : 0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  // Capture PDF selections before the image-only handler sees them.
  input.addEventListener('change', event => {
    const files = [...(input.files || [])];
    const pdf = files.find(isPdf);
    if (!pdf) return;
    event.stopImmediatePropagation();
    input.value = '';
    openPdf(pdf);
  }, true);

  drop.addEventListener('drop', event => {
    const files = [...(event.dataTransfer?.files || [])];
    const pdf = files.find(isPdf);
    if (!pdf) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    drop.classList.remove('drag');
    openPdf(pdf);
  }, true);

  // When a PDF is active, the main OCR button becomes the PDF run button.
  runButton.addEventListener('click', event => {
    if (!state.active) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    extractSelectedPages();
  }, true);

  ui.extract?.addEventListener('click', extractSelectedPages);
  ui.clear?.addEventListener('click', resetPdf);
  ui.another?.addEventListener('click', async () => { await resetPdf(); setTimeout(() => input.click(), 0); });
  ui.prev?.addEventListener('click', () => showPage(Math.max(1, state.currentPage - 1)));
  ui.next?.addEventListener('click', () => showPage(Math.min(state.pages.length || 1, state.currentPage + 1)));
  ui.all?.addEventListener('click', () => setSelection(() => true));
  ui.scanned?.addEventListener('click', () => setSelection(page => page.scanned));
  ui.text?.addEventListener('click', () => setSelection(page => !page.scanned));
  ui.none?.addEventListener('click', () => setSelection(() => false));
  ui.strategy?.addEventListener('change', syncRunState);

  ui.list?.addEventListener('change', event => {
    const box = event.target.closest('input[data-pdf-page]');
    if (!box) return;
    const page = state.pages[Number(box.dataset.pdfPage) - 1];
    if (page) page.selected = box.checked;
    syncRunState();
  });
  ui.list?.addEventListener('click', event => {
    const preview = event.target.closest('[data-pdf-preview]');
    if (preview) showPage(Number(preview.dataset.pdfPreview));
  });

  ui.view?.addEventListener('change', renderResultView);
  ui.copy?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(ui.output.value || ''); ui.copy.textContent = 'Copied ✓'; setTimeout(() => ui.copy.textContent = 'Copy Text', 1100); }
    catch (_) { ui.output.select(); document.execCommand?.('copy'); }
  });
  ui.txt?.addEventListener('click', () => downloadText(buildCombinedText(), fileStem() + '-text.txt', 'text/plain;charset=utf-8'));
  ui.md?.addEventListener('click', () => downloadText(buildMarkdown(), fileStem() + '-text.md', 'text/markdown;charset=utf-8'));
  ui.json?.addEventListener('click', () => downloadText(JSON.stringify(buildJson(), null, 2), fileStem() + '-text.json', 'application/json;charset=utf-8'));
  ui.csv?.addEventListener('click', () => downloadText(textToCsv(ui.output.value || buildCombinedText()), fileStem() + '-table.csv', 'text/csv;charset=utf-8'));
  ui.privacy?.addEventListener('click', scanPrivacy);
  ui.find?.addEventListener('input', updateFindCount);

  async function openPdf(file) {
    if (state.busy) return;
    if (file.size > MAX_PDF_BYTES) {
      alert('This PDF is larger than the 40 MB Public Beta limit. Please use a smaller PDF.');
      return;
    }
    if (!window.pdfjsLib?.getDocument) {
      alert('PDF engine could not load. Check your connection and refresh the page.');
      return;
    }

    document.getElementById('ocrClearAll')?.click();
    await resetPdf(false);
    state.active = true;
    state.file = file;
    drop.style.display = 'none';
    imageEditor?.classList.add('hidden');
    workbench.classList.remove('hidden');
    runButton.disabled = true;
    runButton.textContent = '✦ Preparing PDF…';
    ui.fileName.textContent = file.name;
    ui.fileMeta.textContent = `${formatBytes(file.size)} · reading PDF structure`;
    ui.summary.textContent = 'Scanning PDF…';
    ui.list.innerHTML = '<div class="pdf-empty-state">Checking pages for selectable text…</div>';
    ui.result.classList.add('hidden');
    setPdfProgress(3, 'Loading PDF');
    showPdfProcessing(true, 'Opening PDF…', 'The file stays in this browser while pages are inspected.');

    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      const bytes = new Uint8Array(await file.arrayBuffer());
      state.doc = await pdfjsLib.getDocument({ data: bytes }).promise;
      if (state.doc.numPages > MAX_PDF_PAGES) {
        throw new Error(`This PDF has ${state.doc.numPages} pages. Public Beta currently supports up to ${MAX_PDF_PAGES} pages per PDF.`);
      }
      state.pages = [];
      for (let pageNo = 1; pageNo <= state.doc.numPages; pageNo++) {
        const page = await state.doc.getPage(pageNo);
        const textContent = await page.getTextContent({ disableCombineTextItems: false }).catch(() => ({ items: [] }));
        const directText = textContentToText(textContent, true);
        const nativeChars = directText.replace(/\s/g, '').length;
        const scanned = nativeChars < MIN_DIRECT_CHARS;
        state.pages.push({ number: pageNo, selected: true, scanned, nativeChars, directText });
        setPdfProgress(5 + (pageNo / state.doc.numPages) * 25, `Checking page ${pageNo}/${state.doc.numPages}`);
      }
      ui.fileMeta.textContent = `${formatBytes(file.size)} · ${state.doc.numPages} page${state.doc.numPages === 1 ? '' : 's'}`;
      renderPageList();
      state.currentPage = 1;
      await showPage(1);
      syncRunState();
      const scannedCount = state.pages.filter(p => p.scanned).length;
      const directCount = state.pages.length - scannedCount;
      ui.summary.textContent = `${directCount} text · ${scannedCount} scanned`;
      ui.runNote.textContent = scannedCount
        ? `${scannedCount} page${scannedCount === 1 ? '' : 's'} may need OCR. Smart mode reads normal text pages directly and OCRs scanned pages sequentially.`
        : 'All pages contain a usable text layer. Smart mode can extract them directly without OCR.';
    } catch (error) {
      console.error('RIVANI PDF open error', error);
      const message = /PasswordException|password/i.test(String(error?.name || '') + String(error?.message || ''))
        ? 'Password-protected PDFs are not supported in this Public Beta yet.'
        : (error?.message || 'PDF could not be opened.');
      alert(message);
      resetPdf();
    } finally {
      showPdfProcessing(false);
    }
  }

  function renderPageList() {
    ui.list.innerHTML = state.pages.map(page => `
      <label class="pdf-page-item ${page.scanned ? 'scanned' : 'direct'}">
        <input type="checkbox" data-pdf-page="${page.number}" ${page.selected ? 'checked' : ''}/>
        <span><b>Page ${page.number}</b><small>${page.scanned ? 'Scanned / image page' : `Text layer · ${page.nativeChars} chars`}</small></span>
        <button type="button" data-pdf-preview="${page.number}">Preview</button>
      </label>`).join('');
  }

  function setSelection(test) {
    state.pages.forEach(page => page.selected = !!test(page));
    renderPageList();
    syncRunState();
  }

  function selectedPages() { return state.pages.filter(page => page.selected); }

  function syncRunState() {
    if (!state.active) return;
    const selected = selectedPages();
    const strategy = ui.strategy.value;
    const estimatedOcr = strategy === 'ocr' ? selected.length : strategy === 'smart' ? selected.filter(p => p.scanned).length : 0;
    const label = selected.length ? `✦ Extract ${selected.length} Page${selected.length === 1 ? '' : 's'} →` : '✦ Select PDF Pages';
    runButton.textContent = label;
    ui.extract.textContent = label;
    runButton.disabled = state.busy || selected.length === 0;
    ui.extract.disabled = state.busy || selected.length === 0;
    if (selected.length) {
      ui.runNote.textContent = `${selected.length} selected · ${estimatedOcr} expected OCR page${estimatedOcr === 1 ? '' : 's'} · ${strategy === 'text' ? 'no OCR fallback' : 'browser-side processing'}`;
    }
  }

  async function showPage(pageNo) {
    if (!state.doc || pageNo < 1 || pageNo > state.pages.length) return;
    state.currentPage = pageNo;
    ui.pageLabel.textContent = `Page ${pageNo} / ${state.pages.length}`;
    ui.prev.disabled = pageNo <= 1;
    ui.next.disabled = pageNo >= state.pages.length;
    const info = state.pages[pageNo - 1];
    ui.previewMethod.textContent = info.scanned ? 'Scanned page · OCR likely' : 'Selectable text detected';
    ui.previewLoading.style.display = 'grid';
    try {
      state.previewTask?.cancel?.();
      const page = await state.doc.getPage(pageNo);
      const base = page.getViewport({ scale: 1 });
      const targetWidth = Math.min(900, Math.max(320, ui.canvas.parentElement?.clientWidth || 760));
      const scale = Math.max(0.6, Math.min(1.7, targetWidth / Math.max(1, base.width)));
      const viewport = page.getViewport({ scale });
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      ui.canvas.width = Math.max(1, Math.floor(viewport.width * ratio));
      ui.canvas.height = Math.max(1, Math.floor(viewport.height * ratio));
      ui.canvas.style.width = `${Math.floor(viewport.width)}px`;
      ui.canvas.style.height = `${Math.floor(viewport.height)}px`;
      const ctx = ui.canvas.getContext('2d', { alpha: false });
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      state.previewTask = page.render({ canvasContext: ctx, viewport });
      await state.previewTask.promise;
    } catch (error) {
      if (error?.name !== 'RenderingCancelledException') console.warn('PDF preview error', error);
    } finally {
      ui.previewLoading.style.display = 'none';
    }
  }

  async function extractSelectedPages() {
    if (!state.active || state.busy) return;
    const selected = selectedPages();
    if (!selected.length) return;

    let allowed = false;
    if (typeof window.RIVANI_REQUIRE_AUTH !== 'function') {
      try { await Promise.race([window.RIVANI_AUTH_READY || Promise.resolve(), delay(1800)]); } catch (_) {}
    }
    if (typeof window.RIVANI_REQUIRE_AUTH === 'function') allowed = await window.RIVANI_REQUIRE_AUTH({ tool: 'Image & PDF to Text' });
    else { alert('Sign-in is still loading. Please try again in a moment.'); return; }
    if (!allowed) return;

    const strategy = ui.strategy.value || 'smart';
    if (strategy !== 'text' && !window.Tesseract?.createWorker) {
      const needsOcr = strategy === 'ocr' || selected.some(page => page.scanned);
      if (needsOcr) { alert('OCR engine could not load. Check your connection and try again.'); return; }
    }

    state.busy = true;
    state.results = [];
    ui.result.classList.add('hidden');
    workbench.classList.add('pdf-busy');
    showPdfProcessing(true, 'Extracting PDF text…', 'Pages are processed one at a time to reduce browser memory use.');
    syncRunState();

    let ocrWorker = null;
    try {
      for (let index = 0; index < selected.length; index++) {
        const pageInfo = selected[index];
        const baseProgress = (index / selected.length) * 100;
        setPdfProgress(baseProgress, `Page ${pageInfo.number} · preparing`);
        let result;
        const useDirect = strategy !== 'ocr' && !pageInfo.scanned;
        if (useDirect) {
          result = {
            page: pageInfo.number,
            method: 'text-layer',
            confidence: null,
            path: 'Direct PDF text',
            text: normalizeOutput(pageInfo.directText),
            createdAt: new Date().toISOString()
          };
        } else if (strategy === 'text') {
          result = {
            page: pageInfo.number,
            method: 'text-layer-missing',
            confidence: null,
            path: 'No usable text layer',
            text: '',
            createdAt: new Date().toISOString()
          };
        } else {
          if (!ocrWorker) ocrWorker = await ensurePdfOcrWorker();
          result = await ocrPdfPage(pageInfo.number, ocrWorker, index, selected.length);
        }
        state.results.push(result);
        setPdfProgress(((index + 1) / selected.length) * 100, `Page ${pageInfo.number} · complete`);
      }
      renderPdfResult();
      setPdfProgress(100, 'Complete');
      ui.processingTitle.textContent = 'PDF text ready';
      ui.processingText.textContent = 'Review important names, numbers, tables and OCR pages before relying on them.';
      await delay(250);
    } catch (error) {
      console.error('RIVANI PDF extraction error', error);
      alert(`PDF extraction could not finish: ${error?.message || 'Unknown error'}`);
    } finally {
      state.busy = false;
      workbench.classList.remove('pdf-busy');
      showPdfProcessing(false);
      syncRunState();
    }
  }

  async function ensurePdfOcrWorker() {
    const lang = $('ocrLanguage')?.value || 'eng';
    if (state.worker && state.workerLang === lang) return state.worker;
    if (state.worker) { try { await state.worker.terminate(); } catch (_) {} state.worker = null; }
    ui.processingTitle.textContent = 'Loading OCR language…';
    ui.processingText.textContent = 'First use of a language can take longer while its OCR data downloads to this device.';
    state.worker = await Tesseract.createWorker(lang, 1, { logger: message => {
      if (!state.busy) return;
      const progress = Math.max(0, Math.min(1, Number(message.progress || 0)));
      ui.progressStep.textContent = friendlyStatus(message.status);
      const current = Number(ui.progressFill.dataset.base || 0);
      const span = Number(ui.progressFill.dataset.span || 0);
      setPdfProgress(current + progress * span, friendlyStatus(message.status));
    }});
    state.workerLang = lang;
    return state.worker;
  }

  async function ocrPdfPage(pageNo, worker, index, total) {
    ui.processingTitle.textContent = total > 1 ? `OCR page ${index + 1} of ${total}…` : 'OCR scanned PDF page…';
    ui.processingText.textContent = `Rendering PDF page ${pageNo} locally for OCR.`;
    const page = await state.doc.getPage(pageNo);
    const first = await renderPageForOcr(page, false);
    const base = (index / total) * 100;
    const span = 100 / total;
    ui.progressFill.dataset.base = String(base);
    ui.progressFill.dataset.span = String(span * ($('ocrRace')?.classList.contains('enabled') ? 0.5 : 1));
    await worker.setParameters(parametersForMode());
    const one = await worker.recognize(first.blob);
    let winner = packOcrResult(one, pageNo, first.label);

    if ($('ocrRace')?.classList.contains('enabled')) {
      ui.processingText.textContent = `Smart OCR Race: testing a stronger cleanup for PDF page ${pageNo}.`;
      const second = await renderPageForOcr(page, true);
      ui.progressFill.dataset.base = String(base + span * 0.5);
      ui.progressFill.dataset.span = String(span * 0.5);
      const two = await worker.recognize(second.blob);
      const candidate = packOcrResult(two, pageNo, second.label);
      if (candidate.confidence > winner.confidence + 0.5 || (candidate.confidence >= winner.confidence && candidate.text.trim().length > winner.text.trim().length)) winner = candidate;
    }
    winner.text = normalizeOutput(winner.text);
    return winner;
  }

  function packOcrResult(recognition, pageNo, path) {
    return {
      page: pageNo,
      method: 'ocr',
      confidence: Number(recognition?.data?.confidence || 0),
      path,
      text: String(recognition?.data?.text || ''),
      createdAt: new Date().toISOString()
    };
  }

  async function renderPageForOcr(page, strong) {
    const base = page.getViewport({ scale: 1 });
    let scale = $('ocrTinyText')?.classList.contains('enabled') ? 2.2 : 1.8;
    const pixels = base.width * base.height * scale * scale;
    if (pixels > MAX_RENDER_PIXELS) scale *= Math.sqrt(MAX_RENDER_PIXELS / pixels);
    scale = Math.max(1, scale);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    const mode = activeMode();
    const extraContrast = Number($('ocrContrast')?.value || 0) / 100;
    const autoClean = $('ocrAutoClean')?.classList.contains('enabled');
    const shouldGray = mode !== 'screenshot';
    const strength = (autoClean ? 0.18 : 0) + extraContrast + (strong ? 0.32 : 0);
    if (strength !== 0 || ['document', 'table', 'handwriting'].includes(mode)) {
      applyPixelCleanup(ctx, canvas.width, canvas.height, strength, shouldGray);
    }
    const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not prepare PDF page for OCR')), 'image/png'));
    const labels = ['PDF render'];
    if (autoClean || extraContrast) labels.push('clean');
    if (strong) labels.push('high contrast');
    return { blob, label: labels.join(' + ') };
  }

  function applyPixelCleanup(ctx, width, height, strength, grayscale) {
    const image = ctx.getImageData(0, 0, width, height);
    const data = image.data;
    const factor = Math.max(0.55, Math.min(2.15, 1 + strength * 1.45));
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i], g = data[i + 1], b = data[i + 2];
      if (grayscale) {
        const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        r = g = b = y;
      }
      data[i] = clampByte((r - 128) * factor + 128);
      data[i + 1] = clampByte((g - 128) * factor + 128);
      data[i + 2] = clampByte((b - 128) * factor + 128);
    }
    ctx.putImageData(image, 0, 0);
  }
  const clampByte = value => Math.max(0, Math.min(255, Math.round(value)));

  function parametersForMode() {
    const mode = activeMode();
    const psm = mode === 'table' ? '6' : mode === 'screenshot' ? '11' : mode === 'handwriting' ? '6' : '3';
    return { tessedit_pageseg_mode: psm, preserve_interword_spaces: mode === 'table' ? '1' : '0' };
  }
  function activeMode() { return document.querySelector('#ocrModeGrid [data-ocr-mode].active')?.dataset.ocrMode || 'auto'; }

  function textContentToText(content, preserveLines) {
    const items = [...(content?.items || [])].filter(item => item && typeof item.str === 'string' && item.str.trim());
    if (!items.length) return '';
    const rows = [];
    for (const item of items) {
      const x = Number(item.transform?.[4] || 0);
      const y = Number(item.transform?.[5] || 0);
      let row = rows.find(entry => Math.abs(entry.y - y) <= 2.5);
      if (!row) { row = { y, parts: [] }; rows.push(row); }
      row.parts.push({ x, text: item.str });
    }
    rows.sort((a, b) => b.y - a.y);
    const lines = rows.map(row => row.parts.sort((a, b) => a.x - b.x).map(part => part.text).join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
    return preserveLines ? lines.join('\n') : lines.join(' ');
  }

  function normalizeOutput(text) {
    let value = String(text || '').replace(/\r/g, '');
    const preserve = $('ocrPreserveLines')?.classList.contains('enabled');
    if (preserve) return value.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    return value.replace(/\s+/g, ' ').trim();
  }

  function renderPdfResult() {
    ui.result.classList.remove('hidden');
    const direct = state.results.filter(item => item.method === 'text-layer').length;
    const ocr = state.results.filter(item => item.method === 'ocr');
    const avg = ocr.length ? ocr.reduce((sum, item) => sum + Number(item.confidence || 0), 0) / ocr.length : null;
    ui.resultPages.textContent = String(state.results.length);
    ui.directPages.textContent = String(direct);
    ui.ocrPages.textContent = String(ocr.length);
    ui.ocrConfidence.textContent = avg == null ? 'Direct' : `${Math.round(avg)}%`;
    ui.resultBadge.textContent = ocr.length ? 'MIXED · REVIEW OCR' : 'DIRECT TEXT';
    ui.view.innerHTML = '<option value="combined">Combined document</option>' + state.results.map(item => `<option value="${item.page}">Page ${item.page} · ${item.method === 'ocr' ? `OCR ${Math.round(item.confidence || 0)}%` : item.method === 'text-layer' ? 'Direct text' : 'No text layer'}</option>`).join('');
    ui.view.value = 'combined';
    renderResultView();
    ui.privacyNote.textContent = ocr.length
      ? 'Some pages used OCR. Review names, digits, punctuation, table structure and other important details.'
      : 'All selected pages were extracted from the PDF text layer without OCR.';
    ui.result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderResultView() {
    const value = ui.view.value;
    if (value === 'combined') ui.output.value = buildCombinedText();
    else ui.output.value = state.results.find(item => String(item.page) === String(value))?.text || '';
    updateFindCount();
  }

  function buildCombinedText() {
    return state.results.map(item => `--- Page ${item.page} ---\n${item.text || '[No text extracted]'}`).join('\n\n').trim();
  }
  function buildMarkdown() {
    return state.results.map(item => `## Page ${item.page}\n\n${item.text || '_No text extracted_'}\n`).join('\n');
  }
  function buildJson() {
    return {
      tool: 'RIVANI Image & PDF to Text',
      fileName: state.file?.name || '',
      strategy: ui.strategy.value,
      language: $('ocrLanguage')?.value || 'eng',
      createdAt: new Date().toISOString(),
      pages: state.results.map(item => ({ page: item.page, method: item.method, confidence: item.confidence, path: item.path, text: item.text }))
    };
  }

  function textToCsv(text) {
    const lines = String(text || '').split(/\n+/).map(line => line.trim()).filter(line => line && !/^--- Page \d+ ---$/.test(line));
    const rows = lines.map(line => line.split(/\t+|\s{2,}|\s*\|\s*/).filter(Boolean));
    const width = Math.max(1, ...rows.map(row => row.length));
    return rows.map(row => Array.from({ length: width }, (_, index) => csvEscape(row[index] || '')).join(',')).join('\n');
  }
  const csvEscape = value => `"${String(value).replace(/"/g, '""')}"`;

  function scanPrivacy() {
    const text = ui.output.value || '';
    const emails = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    const phones = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) || [];
    ui.privacyNote.textContent = emails.length || phones.length
      ? `Local pattern scan: ${emails.length} email-like and ${phones.length} phone-like pattern${emails.length + phones.length === 1 ? '' : 's'} found. Review before sharing.`
      : 'Local pattern scan found no obvious email-like or phone-like patterns. This is not a guarantee that the text contains no sensitive information.';
  }

  function updateFindCount() {
    const query = (ui.find.value || '').trim().toLocaleLowerCase();
    if (!query) { ui.findNote.textContent = 'Type a word to count matches.'; return; }
    const haystack = (ui.output.value || '').toLocaleLowerCase();
    let count = 0, position = 0;
    while ((position = haystack.indexOf(query, position)) !== -1) { count++; position += Math.max(1, query.length); }
    ui.findNote.textContent = `${count} match${count === 1 ? '' : 'es'} in this view.`;
  }

  function downloadText(content, name, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function fileStem() { return (state.file?.name || 'rivani-pdf').replace(/\.pdf$/i, '').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'rivani-pdf'; }

  function showPdfProcessing(show, title, text) {
    ui.processing.classList.toggle('hidden', !show);
    if (title) ui.processingTitle.textContent = title;
    if (text) ui.processingText.textContent = text;
  }
  function setPdfProgress(percent, step, updateWidth = true) {
    const value = Math.max(0, Math.min(100, Number(percent || 0)));
    if (updateWidth) ui.progressFill.style.width = `${value}%`;
    ui.progressPercent.textContent = `${Math.round(value)}%`;
    if (step) ui.progressStep.textContent = step;
  }
  function friendlyStatus(status) {
    const value = String(status || '').replace(/_/g, ' ');
    if (/recognizing text/i.test(value)) return 'Recognizing text';
    if (/loading language/i.test(value)) return 'Loading language';
    if (/initializing/i.test(value)) return 'Initializing OCR';
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'OCR';
  }

  async function resetPdf(showDrop = true) {
    if (state.busy) return;
    try { state.previewTask?.cancel?.(); } catch (_) {}
    if (state.worker) { try { await state.worker.terminate(); } catch (_) {} }
    state.active = false; state.busy = false; state.file = null; state.doc = null; state.pages = []; state.results = []; state.currentPage = 1; state.worker = null; state.workerLang = '';
    workbench.classList.add('hidden'); workbench.classList.remove('pdf-busy'); ui.result.classList.add('hidden'); ui.list.innerHTML = ''; ui.output.value = '';
    runButton.textContent = '✦ Extract Text →'; runButton.disabled = true;
    if (showDrop) drop.style.display = '';
  }

  // Keep LUKI's local fallback accurate on this tool page without changing the backend worker.
  (function patchLocalLuki(attempt = 0) {
    if (typeof window.lukiFallbackReply !== 'function') { if (attempt < 30) setTimeout(() => patchLocalLuki(attempt + 1), 80); return; }
    if (window.__RIVANI_PDF_LUKI_PATCHED__) return;
    window.__RIVANI_PDF_LUKI_PATCHED__ = true;
    const original = window.lukiFallbackReply;
    window.lukiFallbackReply = function(question) {
      const q = String(question || '').toLowerCase();
      if (/(pdf to text|pdf ocr|scan(?:ned)? pdf|extract.*pdf|pdf.*text)/.test(q)) {
        return 'RIVANI Image & PDF to Text can open a PDF in the browser, extract a usable PDF text layer directly, and OCR scanned or image-only pages when needed. You can choose all pages or selected pages, use Indian and world OCR languages, and export combined or page-wise text as TXT, Markdown or JSON. Files stay in the browser; sign-in is required before extraction.';
      }
      return original(question);
    };
  })();
})();
