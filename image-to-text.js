// RIVANI AI V37 · Image to Text / OCR
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const els = {
    drop: $('ocrDropZone'), input: $('ocrFileInput'), choose: $('chooseOcrImages'), editor: $('ocrEditor'), queue: $('ocrQueue'),
    name: $('ocrCurrentName'), meta: $('ocrCurrentMeta'), preview: $('ocrPreview'), previewBadge: $('ocrPreviewBadge'), add: $('ocrAddMore'), clear: $('ocrClearAll'),
    run: $('runOcrBtn'), modeGrid: $('ocrModeGrid'), language: $('ocrLanguage'), autoClean: $('ocrAutoClean'), tiny: $('ocrTinyText'), preserve: $('ocrPreserveLines'), race: $('ocrRace'),
    rotateLeft: $('ocrRotateLeft'), rotateRight: $('ocrRotateRight'), contrast: $('ocrContrast'), contrastValue: $('ocrContrastValue'),
    processing: $('ocrProcessing'), processingTitle: $('ocrProcessingTitle'), processingText: $('ocrProcessingText'), progressFill: $('ocrProgressFill'), progressPercent: $('ocrProgressPercent'), progressStep: $('ocrProgressStep'),
    scanSummary: $('ocrScanSummary'), scanGrid: $('ocrScanGrid'), result: $('ocrResult'), resultTitle: $('ocrResultTitle'), confidenceBadge: $('ocrConfidenceBadge'), confidence: $('ocrConfidence'), confidenceNote: $('ocrConfidenceNote'), words: $('ocrWords'), chars: $('ocrCharacters'), winning: $('ocrWinningPath'), integrity: $('ocrIntegrity'),
    output: $('ocrTextOutput'), copy: $('ocrCopy'), txt: $('ocrDownloadTxt'), md: $('ocrDownloadMd'), json: $('ocrDownloadJson'), csv: $('ocrExportCsv'), privacy: $('ocrPrivacyScan'), privacyNote: $('ocrPrivacyNote'), find: $('ocrFind'), findNote: $('ocrFindNote'),
    downloadMain: $('ocrDownloadMain'), rerun: $('ocrRerun'), another: $('ocrAnotherImage')
  };

  if (!els.drop || !els.input) return;

  const state = { items: [], selected: -1, mode: 'auto', worker: null, workerLang: '', busy: false, progressBase: 0, progressSpan: 1 };
  const MAX_FILES = 10;
  const MAX_PIXELS = 18_000_000;

  const toggleButton = el => {
    if (!el) return false;
    const next = !el.classList.contains('enabled');
    el.classList.toggle('enabled', next);
    el.setAttribute('aria-pressed', String(next));
    return next;
  };
  [els.autoClean, els.tiny, els.preserve, els.race].forEach(el => el?.addEventListener('click', () => toggleButton(el)));

  els.modeGrid?.addEventListener('click', e => {
    const b = e.target.closest('[data-ocr-mode]'); if (!b || state.busy) return;
    state.mode = b.dataset.ocrMode;
    els.modeGrid.querySelectorAll('[data-ocr-mode]').forEach(x => x.classList.toggle('active', x === b));
    updateModeHelp();
  });
  function updateModeHelp(){
    const m = state.mode;
    if (els.previewBadge) els.previewBadge.textContent = m === 'auto' ? 'AUTO OCR' : `${m.toUpperCase()} MODE`;
  }

  els.contrast?.addEventListener('input', () => { if (els.contrastValue) els.contrastValue.textContent = `${Number(els.contrast.value) > 0 ? '+' : ''}${els.contrast.value}`; });

  els.choose?.addEventListener('click', () => els.input.click());
  els.add?.addEventListener('click', () => els.input.click());
  els.input.addEventListener('change', () => { addFiles([...els.input.files]); els.input.value = ''; });
  ['dragenter','dragover'].forEach(type => els.drop.addEventListener(type, e => { e.preventDefault(); els.drop.classList.add('drag'); }));
  ['dragleave','drop'].forEach(type => els.drop.addEventListener(type, e => { e.preventDefault(); els.drop.classList.remove('drag'); }));
  els.drop.addEventListener('drop', e => addFiles([...e.dataTransfer.files]));
  document.addEventListener('paste', e => {
    if (state.busy) return;
    const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
    if (files.length) addFiles(files);
  });

  async function addFiles(files){
    const valid = files.filter(f => f.type.startsWith('image/')).slice(0, Math.max(0, MAX_FILES - state.items.length));
    if (!valid.length) return;
    for (const file of valid) state.items.push({ file, url: URL.createObjectURL(file), rotation: 0, result: null, scan: null });
    if (state.selected < 0) state.selected = 0;
    els.drop.style.display = 'none'; els.editor.classList.remove('hidden'); els.run.disabled = false;
    renderQueue(); await showSelected();
  }

  function renderQueue(){
    els.queue.innerHTML = '';
    state.items.forEach((item, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = i === state.selected ? 'active' : '';
      b.innerHTML = `<b>${escapeHtml(item.file.name)}</b><small>${formatBytes(item.file.size)}${item.result ? ' · done' : ''}</small>`;
      b.addEventListener('click', async () => { if (state.busy) return; state.selected = i; renderQueue(); await showSelected(); });
      els.queue.appendChild(b);
    });
  }

  async function showSelected(){
    const item = state.items[state.selected]; if (!item) return;
    els.name.textContent = item.file.name; els.meta.textContent = `${formatBytes(item.file.size)} · ${item.file.type || 'image'}`;
    els.preview.src = item.url; els.preview.style.transform = `rotate(${item.rotation}deg)`; updateModeHelp();
    item.scan = await scanImage(item).catch(() => null); renderScan(item.scan);
    if (item.result) renderResult(item.result); else els.result.classList.add('hidden');
  }

  els.clear?.addEventListener('click', clearAll);
  els.another?.addEventListener('click', () => { clearAll(); setTimeout(() => els.input.click(), 0); });
  function clearAll(){
    if (state.busy) return;
    state.items.forEach(x => URL.revokeObjectURL(x.url)); state.items = []; state.selected = -1;
    els.editor.classList.add('hidden'); els.drop.style.display = ''; els.run.disabled = true; els.result.classList.add('hidden'); els.queue.innerHTML = ''; els.scanGrid.innerHTML = ''; els.scanSummary.textContent = 'Ready';
  }

  function rotateSelected(delta){
    const item = state.items[state.selected]; if (!item || state.busy) return;
    item.rotation = (item.rotation + delta + 360) % 360; item.result = null; els.preview.style.transform = `rotate(${item.rotation}deg)`; els.result.classList.add('hidden');
    scanImage(item).then(scan => { item.scan = scan; renderScan(scan); }).catch(()=>{});
  }
  els.rotateLeft?.addEventListener('click', () => rotateSelected(-90)); els.rotateRight?.addEventListener('click', () => rotateSelected(90));

  async function scanImage(item){
    const img = await decodeImage(item.file); const rotated = (item.rotation % 180) !== 0; const width = rotated ? img.height : img.width; const height = rotated ? img.width : img.height;
    const sample = document.createElement('canvas'); const sw = Math.min(480, width); const sh = Math.max(1, Math.round(height * (sw / width))); sample.width = sw; sample.height = sh;
    const ctx = sample.getContext('2d', { willReadFrequently: true }); drawRotated(ctx, img, sw, sh, item.rotation);
    const data = ctx.getImageData(0,0,sw,sh).data; let sum=0,sum2=0,edges=0,prev=0,count=0;
    for(let i=0;i<data.length;i+=16){ const y=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2]; sum+=y;sum2+=y*y;if(count&&Math.abs(y-prev)>38)edges++;prev=y;count++; }
    const mean=sum/Math.max(1,count), variance=Math.max(0,sum2/Math.max(1,count)-mean*mean), contrast=Math.sqrt(variance), edgeRate=edges/Math.max(1,count-1);
    return { width,height,megapixels:(width*height/1e6),brightness:mean,contrast,edgeRate,tinyRisk:Math.min(width,height)<900, lowContrast:contrast<42, dark:mean<70, bright:mean>215 };
  }
  function renderScan(scan){
    if (!scan){ els.scanSummary.textContent='Could not scan'; els.scanGrid.innerHTML=''; return; }
    const quality = scan.lowContrast ? 'Low contrast' : scan.contrast > 72 ? 'Strong contrast' : 'Normal contrast';
    els.scanSummary.textContent = scan.tinyRisk || scan.lowContrast ? 'Cleanup recommended' : 'Ready for OCR';
    els.scanGrid.innerHTML = [
      ['Resolution',`${scan.width} × ${scan.height}`,`${scan.megapixels.toFixed(1)} MP`],
      ['Contrast',quality,`Score ${Math.round(scan.contrast)}`],
      ['Brightness',scan.dark?'Dark':scan.bright?'Very bright':'Balanced',`Level ${Math.round(scan.brightness)}`],
      ['Fine detail',scan.tinyRisk?'Tiny-text risk':scan.edgeRate>.16?'Dense':'Normal',scan.tinyRisk?'Upscale can help':'OCR ready']
    ].map(([a,b,c])=>`<article><span>${a}</span><b>${b}</b><small>${c}</small></article>`).join('');
  }

  els.run?.addEventListener('click', () => runOcr(state.items.map((_,i)=>i)));
  els.rerun?.addEventListener('click', () => { if (state.selected >= 0) runOcr([state.selected]); });

  async function runOcr(indices){
    if (state.busy || !indices.length) return;
    let allowed=false;
    if(typeof window.RIVANI_REQUIRE_AUTH!=='function'){
      try{await Promise.race([window.RIVANI_AUTH_READY||Promise.resolve(),delay(1800)]);}catch(_){ }
    }
    if(typeof window.RIVANI_REQUIRE_AUTH==='function') allowed=await window.RIVANI_REQUIRE_AUTH({tool:'Image to Text'});
    else { alert('Sign-in is still loading. Please try again in a moment.'); return; }
    if (!allowed) return;
    if (!window.Tesseract?.createWorker){ alert('OCR engine could not load. Please check your connection and try again.'); return; }
    state.busy = true; setBusy(true); showProcessing(true); setProgress(1,'Starting OCR…');
    try{
      const lang = els.language.value || 'eng'; const worker = await ensureWorker(lang);
      for(let pos=0; pos<indices.length; pos++){
        const idx=indices[pos], item=state.items[idx]; if(!item) continue;
        state.progressBase=pos/indices.length; state.progressSpan=1/indices.length;
        state.selected=idx; renderQueue(); await showSelected();
        els.processingTitle.textContent = indices.length>1 ? `Reading image ${pos+1} of ${indices.length}…` : 'Reading image…';
        const result = await recognizeItem(worker,item);
        item.result=result; renderQueue(); renderResult(result);
      }
      setProgress(100,'Complete'); els.processingTitle.textContent='Text extracted'; els.processingText.textContent='Review the editable result before relying on important details.';
      await delay(350);
    }catch(err){
      console.error('RIVANI OCR error',err); alert(`OCR could not finish: ${err?.message || 'Unknown error'}`);
    }finally{ showProcessing(false); setBusy(false); }
  }

  async function ensureWorker(lang){
    if(state.worker && state.workerLang===lang) return state.worker;
    if(state.worker){ try{await state.worker.terminate();}catch(_){} state.worker=null; }
    els.processingTitle.textContent='Loading OCR engine…'; els.processingText.textContent='First use can take longer while language data downloads to this device.';
    state.worker = await Tesseract.createWorker(lang, 1, { logger: m => {
      const p = Number(m.progress || 0); const local = Math.max(0,Math.min(1,p)); const overall=(state.progressBase+local*state.progressSpan)*100;
      setProgress(overall, friendlyStatus(m.status));
    }});
    state.workerLang=lang; return state.worker;
  }

  async function recognizeItem(worker,item){
    const scan=item.scan || await scanImage(item); item.scan=scan;
    const base = await prepareImage(item, scan, false); const params = parametersForMode(state.mode);
    await worker.setParameters(params);
    const one = await worker.recognize(base.blob); let winner = packResult(one, base.label, item, scan);
    if(els.race.classList.contains('enabled')){
      els.processingText.textContent='Smart OCR Race: testing a stronger cleanup path.';
      const strong=await prepareImage(item,scan,true); const two=await worker.recognize(strong.blob); const candidate=packResult(two,strong.label,item,scan);
      if(candidate.confidence>winner.confidence+0.5 || (candidate.confidence>=winner.confidence && candidate.text.trim().length>winner.text.trim().length)) winner=candidate;
    }
    winner.text=cleanupText(winner.text, els.preserve.classList.contains('enabled'));
    winner.words=countWords(winner.text); winner.characters=winner.text.length; winner.integrity=integrityLabel(winner.text,winner.confidence);
    return winner;
  }

  function packResult(rec,label,item,scan){
    return { text:String(rec?.data?.text||''), confidence:Number(rec?.data?.confidence||0), path:label, mode:state.mode, language:els.language.value, fileName:item.file.name, width:scan.width, height:scan.height, createdAt:new Date().toISOString() };
  }

  function parametersForMode(mode){
    const psm = mode==='table'?'6':mode==='screenshot'?'11':mode==='handwriting'?'6':'3';
    return { tessedit_pageseg_mode: psm, preserve_interword_spaces: mode==='table'?'1':'0' };
  }

  async function prepareImage(item,scan,strong){
    const img=await decodeImage(item.file); const rotated=(item.rotation%180)!==0; let w=rotated?img.height:img.width, h=rotated?img.width:img.height;
    let scale=1; const tinyEnabled=els.tiny.classList.contains('enabled');
    if(tinyEnabled && Math.min(w,h)<1100) scale=Math.min(2,1400/Math.max(1,Math.min(w,h)));
    if(state.mode==='screenshot' && Math.min(w,h)<1500) scale=Math.max(scale,1.35);
    const pixels=w*h*scale*scale; if(pixels>MAX_PIXELS) scale*=Math.sqrt(MAX_PIXELS/pixels);
    const cw=Math.max(1,Math.round(w*scale)), ch=Math.max(1,Math.round(h*scale)); const canvas=document.createElement('canvas'); canvas.width=cw;canvas.height=ch;
    const ctx=canvas.getContext('2d',{willReadFrequently:true}); ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high'; drawRotated(ctx,img,cw,ch,item.rotation);
    const shouldClean = els.autoClean.classList.contains('enabled') && (scan.lowContrast||scan.dark||scan.bright||state.mode!=='auto');
    const extra=Number(els.contrast.value||0)/100; const cleanStrength=(shouldClean?0.20:0)+extra+(strong?0.30:0);
    if(cleanStrength!==0 || state.mode==='document'||state.mode==='table'||state.mode==='handwriting') applyPixelCleanup(ctx,cw,ch,cleanStrength, state.mode!=='screenshot');
    const blob=await new Promise((res,rej)=>canvas.toBlob(b=>b?res(b):rej(new Error('Could not prepare image')),'image/png'));
    const labels=[]; if(scale>1.08) labels.push(`${scale.toFixed(1)}× upscale`); if(shouldClean||extra) labels.push('clean'); if(strong) labels.push('high contrast'); if(!labels.length) labels.push('original-safe');
    return {blob,label:labels.join(' + ')};
  }

  function applyPixelCleanup(ctx,w,h,strength,grayscale){
    const img=ctx.getImageData(0,0,w,h), d=img.data; const factor=Math.max(.55,Math.min(2,1+strength*1.35));
    for(let i=0;i<d.length;i+=4){ let r=d[i],g=d[i+1],b=d[i+2]; if(grayscale){const y=.2126*r+.7152*g+.0722*b;r=g=b=y;} r=(r-128)*factor+128;g=(g-128)*factor+128;b=(b-128)*factor+128; d[i]=clamp(r);d[i+1]=clamp(g);d[i+2]=clamp(b); }
    ctx.putImageData(img,0,0);
  }

  function drawRotated(ctx,img,w,h,rotation){
    ctx.save(); ctx.clearRect(0,0,w,h);
    if(rotation===90){ctx.translate(w,0);ctx.rotate(Math.PI/2);ctx.drawImage(img,0,0,h,w);} else if(rotation===180){ctx.translate(w,h);ctx.rotate(Math.PI);ctx.drawImage(img,0,0,w,h);} else if(rotation===270){ctx.translate(0,h);ctx.rotate(-Math.PI/2);ctx.drawImage(img,0,0,h,w);} else ctx.drawImage(img,0,0,w,h); ctx.restore();
  }

  async function decodeImage(file){
    if('createImageBitmap' in window){ try{return await createImageBitmap(file);}catch(_){} }
    return await new Promise((res,rej)=>{const img=new Image();const u=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(u);res(img)};img.onerror=()=>{URL.revokeObjectURL(u);rej(new Error('Unsupported image'))};img.src=u;});
  }

  function renderResult(r){
    if(!r) return; els.result.classList.remove('hidden'); els.resultTitle.textContent = r.text.trim() ? 'Text extracted' : 'No readable text found';
    const c=Math.round(r.confidence); els.confidence.textContent=`${c}%`; els.confidenceBadge.textContent=c>=85?'HIGH':c>=65?'REVIEW':'LOW'; els.confidenceNote.textContent=c>=85?'Strong OCR estimate':c>=65?'Check names and numbers':'Image or text may be difficult';
    els.words.textContent=String(r.words??countWords(r.text)); els.chars.textContent=String(r.characters??r.text.length); els.winning.textContent=r.path||'OCR'; els.integrity.textContent=r.integrity||integrityLabel(r.text,r.confidence); els.output.value=r.text||'';
    updateFind(); updateDownloadLabel();
  }

  els.output?.addEventListener('input',()=>{const item=state.items[state.selected];if(item?.result){item.result.text=els.output.value;item.result.words=countWords(els.output.value);item.result.characters=els.output.value.length;els.words.textContent=item.result.words;els.chars.textContent=item.result.characters;}});
  els.copy?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(els.output.value);flash(els.copy,'Copied ✓');}catch(_){els.output.select();document.execCommand('copy');flash(els.copy,'Copied ✓');}});
  els.txt?.addEventListener('click',()=>downloadCurrent('txt')); els.md?.addEventListener('click',()=>downloadCurrent('md')); els.json?.addEventListener('click',()=>downloadCurrent('json')); els.downloadMain?.addEventListener('click',()=>downloadBatchOrCurrent());
  els.csv?.addEventListener('click',()=>{const text=els.output.value.trim();if(!text)return;downloadBlob(`${baseName(currentItem()?.file?.name||'ocr')}.csv`,new Blob([toCsv(text)],{type:'text/csv;charset=utf-8'}));});

  function downloadCurrent(kind){const item=currentItem();const r=item?.result;if(!r)return;const stem=baseName(item.file.name);if(kind==='json'){downloadBlob(`${stem}-ocr.json`,new Blob([JSON.stringify({...r,text:els.output.value},null,2)],{type:'application/json'}));return;}const body=kind==='md'?`# OCR — ${item.file.name}\n\n${els.output.value}\n`:els.output.value;downloadBlob(`${stem}-ocr.${kind}`,new Blob([body],{type:'text/plain;charset=utf-8'}));}
  function downloadBatchOrCurrent(){const done=state.items.filter(x=>x.result);if(done.length<=1){downloadCurrent('txt');return;}const body=done.map((x,i)=>`===== ${i+1}. ${x.file.name} =====\n${x.result.text.trim()}\n`).join('\n');downloadBlob(`rivani-ocr-${done.length}-images.txt`,new Blob([body],{type:'text/plain;charset=utf-8'}));}
  function updateDownloadLabel(){const done=state.items.filter(x=>x.result).length;els.downloadMain.textContent=done>1?`↓ Download ${done} OCR Results`:'↓ Download Text';}

  els.find?.addEventListener('input',updateFind); function updateFind(){const q=els.find.value.trim();if(!q){els.findNote.textContent='Type a word to count matches.';return;}const hay=els.output.value.toLowerCase(),needle=q.toLowerCase();let n=0,pos=0;while((pos=hay.indexOf(needle,pos))>=0){n++;pos+=Math.max(1,needle.length);}els.findNote.textContent=`${n} match${n===1?'':'es'} found.`;}
  els.privacy?.addEventListener('click',()=>{const t=els.output.value;const emails=t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[];const phones=t.match(/(?:\+?\d[\d\s().-]{7,}\d)/g)||[];els.privacyNote.textContent=`Local pattern scan: ${emails.length} email-like and ${phones.length} phone/number-like pattern${phones.length===1?'':'s'} found. This is a heuristic, not a complete sensitive-data detector.`;});

  function toCsv(text){
    const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean); return lines.map(line=>{
      let cells=line.includes('\t')?line.split(/\t+/):line.split(/\s{2,}|\s*\|\s*/); if(cells.length===1 && state.mode==='table') cells=line.split(/\s+/); return cells.map(csvCell).join(',');
    }).join('\n');
  }
  function csvCell(v){const s=String(v).trim().replace(/"/g,'""');return /[",\n]/.test(s)?`"${s}"`:s;}

  function cleanupText(text,preserve){let t=String(text||'').replace(/\u000c/g,'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();if(!preserve)t=t.replace(/-\n(?=[a-z])/g,'').replace(/(?<![.!?:])\n(?!\n)/g,' ').replace(/[ \t]{2,}/g,' ');return t;}
  function integrityLabel(text,confidence){const suspicious=(text.match(/[�□■]/g)||[]).length; if(!text.trim())return 'No text found'; if(confidence<60||suspicious>2)return 'Review carefully'; if(confidence<80)return 'Check names/numbers'; return 'Looks consistent';}
  function countWords(t){return (String(t||'').trim().match(/\S+/g)||[]).length;}
  function friendlyStatus(s){const v=String(s||'').replace(/_/g,' ');if(/recogniz/i.test(v))return 'Recognizing text';if(/load.*language/i.test(v))return 'Loading language';if(/initializ/i.test(v))return 'Initializing OCR';return v? v.charAt(0).toUpperCase()+v.slice(1):'Working';}
  function setProgress(value,step){const n=Math.max(0,Math.min(100,Math.round(value)));els.progressFill.style.width=`${n}%`;els.progressPercent.textContent=`${n}%`;els.progressStep.textContent=step||'Working';}
  function showProcessing(show){els.processing.classList.toggle('hidden',!show);}
  function setBusy(b){state.busy=b;els.run.disabled=b||!state.items.length;[els.choose,els.add,els.clear,els.rotateLeft,els.rotateRight].forEach(x=>{if(x)x.disabled=b;});}
  function currentItem(){return state.items[state.selected]||null;}
  function flash(btn,text){const old=btn.textContent;btn.textContent=text;setTimeout(()=>btn.textContent=old,1200);}
  function delay(ms){return new Promise(r=>setTimeout(r,ms));}
  function clamp(v){return Math.max(0,Math.min(255,Math.round(v)));}
  function formatBytes(n){if(n<1024)return `${n} B`;if(n<1048576)return `${(n/1024).toFixed(n<10240?1:0)} KB`;return `${(n/1048576).toFixed(2)} MB`;}
  function baseName(n){return String(n||'image').replace(/\.[^.]+$/,'').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'')||'image';}
  function downloadBlob(name,blob){const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);}
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}

  window.addEventListener('beforeunload',()=>{state.items.forEach(x=>URL.revokeObjectURL(x.url));try{state.worker?.terminate();}catch(_){}});
})();
