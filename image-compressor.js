// RIVANI AI V36.2 — Smart Image Compressor result actions visibility fix
// Browser-side compression only. Existing AI inference/model pipelines are untouched.
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    modeButtons: [...document.querySelectorAll('[data-compressor-mode]')],
    modePanels: [...document.querySelectorAll('[data-mode-panel]')],
    easyPresets: $('compressorEasyPresets'),
    targetValue: $('targetSizeValue'), targetUnit: $('targetSizeUnit'), quickTargets: $('compressorQuickTargets'), targetStrategy: $('targetStrategy'),
    format: $('compressorFormat'), quality: $('compressorQuality'), qualityValue: $('compressorQualityValue'), width: $('compressorWidth'), height: $('compressorHeight'),
    qualityGuard: $('qualityGuardToggle'), qualityFloor: $('qualityFloor'), qualityFloorValue: $('qualityFloorValue'), textGuard: $('textLogoGuardToggle'), transparencyGuard: $('transparencyGuardToggle'), formatRace: $('formatRaceToggle'), consistency: $('batchConsistencyToggle'),
    run: $('compressImagesBtn'), runLabel: $('compressorRunLabel'), batchLabel: $('compressorBatchLabel'), fileInput: $('compressorFileInput'), choose: $('chooseCompressorFiles'), drop: $('compressorDropZone'), editor: $('compressorEditor'), addMore: $('compressorAddMore'), clear: $('compressorClearAll'), queue: $('compressorQueue'),
    currentName: $('compressorCurrentName'), currentMeta: $('compressorCurrentMeta'), before: $('compressorBefore'), after: $('compressorAfter'), afterWrap: $('compressorAfterWrap'), compare: $('compressorCompare'), compareRange: $('compressorCompareRange'), artifactMap: $('compressorArtifactMap'),
    processing: $('compressorProcessing'), processingTitle: $('compressorProcessingTitle'), processingText: $('compressorProcessingText'), progressFill: $('compressorProgressFill'), progressPercent: $('compressorProgressPercent'), progressStep: $('compressorProgressStep'),
    scanSummary: $('compressorScanSummary'), scanGrid: $('compressorScanGrid'), result: $('compressorResult'), resultTitle: $('compressorResultTitle'), targetStatus: $('compressorTargetStatus'),
    originalSize: $('reportOriginalSize'), originalFormat: $('reportOriginalFormat'), outputSize: $('reportOutputSize'), outputFormat: $('reportOutputFormat'), saved: $('reportSavedPercent'), dimensions: $('reportDimensions'), similarity: $('reportSimilarity'), race: $('compressorRace'), resultNote: $('compressorResultNote'),
    primaryActions: $('compressorPrimaryActions'), primaryDownload: $('compressorPrimaryDownload'), primaryEdit: $('compressorPrimaryEdit'), primaryNew: $('compressorPrimaryNew'),
    downloadOne: $('compressorDownloadOne'), editOne: $('compressorEditOne'), newImage: $('compressorNewImage'), toggleArtifact: $('compressorToggleArtifact'), downloadAll: $('compressorDownloadAll'), websitePack: $('compressorWebsitePack')
  };

  const MAX_FILES = 20;
  const MAX_FILE_BYTES = 60 * 1024 * 1024;
  const DEVICE_MAX_MP = matchMedia('(max-width: 760px)').matches ? 12 : 24;
  const state = { files: [], selectedIndex: 0, mode: 'easy', preset: 'balanced', processing: false, batchFormat: null, artifactVisible: false, scope: 'all' };
  const formatSupport = new Map();

  const mimeExt = {'image/jpeg':'jpg','image/webp':'webp','image/png':'png','image/avif':'avif'};
  const mimeLabel = {'image/jpeg':'JPEG','image/webp':'WebP','image/png':'PNG','image/avif':'AVIF'};

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 1024 * 100 ? 1 : 0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function baseName(name='image') { return name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g,'') || 'image'; }
  function outputName(name, mime, suffix='rivani') { return `${baseName(name)}-${suffix}.${mimeExt[mime] || 'img'}`; }
  function isToggleOn(el) { return !!el?.classList.contains('enabled'); }
  function setToggle(el, on) { if(!el)return; el.classList.toggle('enabled', on); el.setAttribute('aria-pressed', String(on)); }
  function updateProgress(percent, step, title='Compressing…', text='Your image stays in this browser.') {
    const p = clamp(Math.round(percent),0,100);
    if(els.progressFill) els.progressFill.style.width = `${p}%`;
    if(els.progressPercent) els.progressPercent.textContent = `${p}%`;
    if(els.progressStep) els.progressStep.textContent = step || '';
    if(els.processingTitle) els.processingTitle.textContent = title;
    if(els.processingText) els.processingText.textContent = text;
  }

  async function canvasToBlob(canvas, mime, quality) {
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error(`Could not encode ${mime}`)), mime, quality));
  }
  async function canEncode(mime) {
    if (formatSupport.has(mime)) return formatSupport.get(mime);
    if (mime === 'image/png' || mime === 'image/jpeg') { formatSupport.set(mime,true); return true; }
    try {
      const c=document.createElement('canvas'); c.width=2;c.height=2;
      const b=await canvasToBlob(c,mime,.8);
      const ok=b.type===mime;
      formatSupport.set(mime,ok); return ok;
    } catch { formatSupport.set(mime,false); return false; }
  }

  async function decodeFile(file) {
    if ('createImageBitmap' in window) {
      try { return await createImageBitmap(file, {imageOrientation:'from-image'}); } catch(_) {}
    }
    const url=URL.createObjectURL(file);
    try {
      const img=new Image(); img.decoding='async';
      await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('This image could not be decoded by the browser.'));img.src=url;});
      return img;
    } finally { URL.revokeObjectURL(url); }
  }
  function closeDecoded(decoded) { try { decoded?.close?.(); } catch(_) {} }

  function safeDimensions(w,h, requestedW=0, requestedH=0, strictScale=1) {
    let scale = Math.min(1, strictScale || 1);
    if (requestedW > 0) scale = Math.min(scale, requestedW / w);
    if (requestedH > 0) scale = Math.min(scale, requestedH / h);
    const maxPixels=DEVICE_MAX_MP*1e6;
    if (w*h*scale*scale > maxPixels) scale=Math.min(scale, Math.sqrt(maxPixels/(w*h)));
    return {width:Math.max(1,Math.round(w*scale)),height:Math.max(1,Math.round(h*scale)),scale};
  }
  function drawToCanvas(decoded, dims) {
    const canvas=document.createElement('canvas'); canvas.width=dims.width;canvas.height=dims.height;
    const ctx=canvas.getContext('2d',{alpha:true,willReadFrequently:true});
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(decoded,0,0,dims.width,dims.height);
    return canvas;
  }
  function sampleCanvas(source, size=96) {
    const c=document.createElement('canvas');c.width=size;c.height=size;
    const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0,size,size);
    return {canvas:c, data:ctx.getImageData(0,0,size,size).data};
  }
  function analyzeCanvas(canvas) {
    const {data}=sampleCanvas(canvas,96);
    let alpha=0, edge=0, brightness=0, colors=0;
    const px=96*96;
    const gray=new Float32Array(px);
    for(let i=0,p=0;i<data.length;i+=4,p++){
      const r=data[i],g=data[i+1],b=data[i+2],a=data[i+3];
      if(a<250)alpha++;
      const y=.299*r+.587*g+.114*b;gray[p]=y;brightness+=y;
      colors += Math.max(r,g,b)-Math.min(r,g,b);
    }
    for(let y=1;y<95;y++)for(let x=1;x<95;x++){
      const i=y*96+x;
      const gx=Math.abs(gray[i+1]-gray[i-1]), gy=Math.abs(gray[i+96]-gray[i-96]);
      if(gx+gy>42) edge++;
    }
    return {
      hasAlpha: alpha/px > .002,
      alphaRatio: alpha/px,
      edgeDensity: edge/(94*94),
      brightness: brightness/px,
      colorSpread: colors/px,
      edgeHeavy: edge/(94*94) > .19
    };
  }

  async function blobToCanvas(blob, width, height) {
    const decoded=await decodeFile(blob);
    try { return drawToCanvas(decoded,{width,height}); } finally { closeDecoded(decoded); }
  }
  async function visualMetrics(sourceCanvas, blob) {
    try {
      const testSize=96;
      const a=sampleCanvas(sourceCanvas,testSize).data;
      const decoded=await decodeFile(blob);
      const c=document.createElement('canvas');c.width=testSize;c.height=testSize;
      const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(decoded,0,0,testSize,testSize); closeDecoded(decoded);
      const b=ctx.getImageData(0,0,testSize,testSize).data;
      let mse=0, edgeA=0, edgeB=0;
      const ga=new Float32Array(testSize*testSize), gb=new Float32Array(testSize*testSize);
      for(let i=0,p=0;i<a.length;i+=4,p++){
        const dr=a[i]-b[i],dg=a[i+1]-b[i+1],db=a[i+2]-b[i+2];
        mse += (dr*dr+dg*dg+db*db)/3;
        ga[p]=.299*a[i]+.587*a[i+1]+.114*a[i+2];gb[p]=.299*b[i]+.587*b[i+1]+.114*b[i+2];
      }
      mse/=testSize*testSize;
      for(let y=1;y<testSize-1;y++)for(let x=1;x<testSize-1;x++){
        const p=y*testSize+x;
        edgeA+=Math.abs(ga[p+1]-ga[p-1])+Math.abs(ga[p+testSize]-ga[p-testSize]);
        edgeB+=Math.abs(gb[p+1]-gb[p-1])+Math.abs(gb[p+testSize]-gb[p-testSize]);
      }
      const psnr=mse<.01?60:10*Math.log10((255*255)/mse);
      const edgeRatio=edgeA?Math.min(edgeA,edgeB)/Math.max(edgeA,edgeB):1;
      const score=clamp(Math.round(55 + (psnr-25)*1.6 + edgeRatio*12),0,100);
      return {score,psnr,edgeRatio,mse};
    } catch { return {score:null,psnr:null,edgeRatio:null,mse:null}; }
  }

  function targetBytes() {
    const n=Math.max(1,Number(els.targetValue?.value||100));
    return Math.round(n*(els.targetUnit?.value==='MB'?1024*1024:1024));
  }
  function currentSettings(analysis) {
    const guards={quality:isToggleOn(els.qualityGuard),text:isToggleOn(els.textGuard),transparency:isToggleOn(els.transparencyGuard),race:isToggleOn(els.formatRace),consistency:isToggleOn(els.consistency)};
    let quality=.82, requestedMime='smart';
    if(state.mode==='easy') quality=state.preset==='small'?.64:state.preset==='max'?.94:.82;
    if(state.mode==='precision'){quality=Number(els.quality?.value||82)/100;requestedMime=els.format?.value||'smart';}
    const floor=Number(els.qualityFloor?.value||84)+(guards.text&&analysis?.edgeHeavy?3:0);
    return {guards,quality,requestedMime,floor:clamp(floor,70,97), target:state.mode==='exact'?targetBytes():null, strategy:els.targetStrategy?.value||'quality', reqW:state.mode==='precision'?Number(els.width?.value||0):0, reqH:state.mode==='precision'?Number(els.height?.value||0):0};
  }

  async function candidateMimes(settings, analysis) {
    if(settings.requestedMime!=='smart'){
      if(settings.requestedMime==='image/jpeg' && settings.guards.transparency && analysis.hasAlpha){
        if(await canEncode('image/webp')) return ['image/webp'];
        return ['image/png'];
      }
      if(await canEncode(settings.requestedMime)) return [settings.requestedMime];
      throw new Error(`${mimeLabel[settings.requestedMime]||settings.requestedMime} encoding is not supported in this browser.`);
    }
    const alphaProtected=settings.guards.transparency&&analysis.hasAlpha;
    let list=alphaProtected?['image/webp','image/avif','image/png']:['image/webp','image/avif','image/jpeg'];
    if(!settings.guards.race) list=alphaProtected?['image/webp']:['image/webp'];
    const supported=[];
    for(const m of list) if(await canEncode(m)) supported.push(m);
    if(!supported.length) supported.push(alphaProtected?'image/png':'image/jpeg');
    if(state.batchFormat && settings.guards.consistency && supported.includes(state.batchFormat)) return [state.batchFormat];
    return supported;
  }

  async function encodeAt(canvas,mime,q){return canvasToBlob(canvas,mime,mime==='image/png'?undefined:clamp(q,.2,.99));}

  async function exactEncode(canvas,mime,target,baseQ,minQ) {
    if(mime==='image/png'){
      const blob=await encodeAt(canvas,mime,1); return {blob,quality:1,under:blob.size<=target,tries:1};
    }
    let lo=clamp(minQ,.2,.92), hi=.985, bestUnder=null, bestAny=null, tries=0;
    for(let i=0;i<10;i++){
      const q=i===0?clamp(baseQ,lo,hi):(lo+hi)/2;
      const blob=await encodeAt(canvas,mime,q);tries++;
      const item={blob,quality:q,under:blob.size<=target,tries};bestAny=item;
      if(blob.size<=target){if(!bestUnder||q>bestUnder.quality)bestUnder=item;lo=q;}else hi=q;
      if(Math.abs(blob.size-target)/target<.018 && blob.size<=target)break;
    }
    return bestUnder||bestAny;
  }

  async function buildCandidate(sourceCanvas,mime,settings,analysis,strictScale=1) {
    const dims=safeDimensions(sourceCanvas.width,sourceCanvas.height, settings.reqW,settings.reqH,strictScale);
    let canvas=sourceCanvas;
    if(dims.width!==sourceCanvas.width||dims.height!==sourceCanvas.height){
      canvas=document.createElement('canvas');canvas.width=dims.width;canvas.height=dims.height;
      const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(sourceCanvas,0,0,dims.width,dims.height);
    }
    const minQ=(settings.guards.text&&analysis.edgeHeavy)?.55:.38;
    let enc=settings.target?await exactEncode(canvas,mime,settings.target,settings.quality,minQ):{blob:await encodeAt(canvas,mime,settings.quality),quality:settings.quality,under:true,tries:1};
    let metrics=settings.guards.quality?await visualMetrics(canvas,enc.blob):{score:null};

    // In non-exact modes, lift quality when the heuristic falls below the requested floor.
    if(settings.guards.quality && metrics.score!==null && metrics.score<settings.floor && !settings.target && mime!=='image/png'){
      let q=enc.quality;
      for(let i=0;i<3 && metrics.score<settings.floor && q<.98;i++){
        q=Math.min(.98,q+.06);enc={blob:await encodeAt(canvas,mime,q),quality:q,under:true,tries:enc.tries+1};metrics=await visualMetrics(canvas,enc.blob);
      }
    }
    return {mime,blob:enc.blob,quality:enc.quality,under:enc.blob.size<=(settings.target||Infinity),width:canvas.width,height:canvas.height,metrics,canvas,tries:enc.tries};
  }

  async function compressEntry(entry, index, total) {
    const decoded=await decodeFile(entry.file);
    let sourceCanvas;
    try {
      const dims=safeDimensions(decoded.width||decoded.naturalWidth,decoded.height||decoded.naturalHeight);
      sourceCanvas=drawToCanvas(decoded,dims);
      entry.originalWidth=decoded.width||decoded.naturalWidth;entry.originalHeight=decoded.height||decoded.naturalHeight;
      entry.workingWidth=dims.width;entry.workingHeight=dims.height;
    } finally { closeDecoded(decoded); }
    const analysis=analyzeCanvas(sourceCanvas);entry.analysis=analysis;
    const settings=currentSettings(analysis);
    let mimes=await candidateMimes(settings,analysis);
    const race=[];
    let candidates=[];
    for(let m=0;m<mimes.length;m++){
      updateProgress(((index+(m/Math.max(1,mimes.length)))/total)*88,`${index+1}/${total} · ${mimeLabel[mimes[m]]||mimes[m]}`,'Compressing image…');
      const c=await buildCandidate(sourceCanvas,mimes[m],settings,analysis,1);candidates.push(c);
      race.push({mime:c.mime,size:c.blob.size,score:c.metrics.score,quality:c.quality,under:c.under});
    }

    function choose(list){
      const safe=list.filter(c=>!settings.guards.quality||c.metrics.score===null||c.metrics.score>=settings.floor);
      const pool=safe.length?safe:list;
      if(settings.target){
        const under=pool.filter(c=>c.blob.size<=settings.target);
        if(under.length) return under.sort((a,b)=>(b.metrics.score??0)-(a.metrics.score??0)||b.quality-a.quality||a.blob.size-b.blob.size)[0];
      }
      return pool.sort((a,b)=>a.blob.size-b.blob.size)[0];
    }
    let best=choose(candidates);

    // Strict exact mode: progressively shrink only when no candidate can reach the target.
    if(settings.target && best.blob.size>settings.target && settings.strategy==='strict'){
      for(let pass=0;pass<8 && best.blob.size>settings.target;pass++){
        const ratio=Math.sqrt(settings.target/Math.max(best.blob.size,1));
        const scale=clamp((best.width/sourceCanvas.width)*ratio*.96,.25,.96);
        candidates=[];
        for(const mime of mimes){
          const c=await buildCandidate(sourceCanvas,mime,settings,analysis,scale);candidates.push(c);
          race.push({mime:c.mime,size:c.blob.size,score:c.metrics.score,quality:c.quality,under:c.under,strict:true});
        }
        best=choose(candidates);
        if(best.width<=320||best.height<=320)break;
      }
    }

    if(!state.batchFormat && settings.guards.consistency && settings.requestedMime==='smart') state.batchFormat=best.mime;
    entry.sourceCanvas=sourceCanvas;
    entry.result={...best,race,target:settings.target,floor:settings.floor,strategy:settings.strategy,originalSize:entry.file.size,savedPct:Math.round((1-best.blob.size/entry.file.size)*1000)/10};
    if(entry.resultUrl)URL.revokeObjectURL(entry.resultUrl);
    entry.resultUrl=URL.createObjectURL(best.blob);
    return entry;
  }

  function renderScan(entry){
    if(!els.scanGrid)return;const a=entry?.analysis;
    if(!a){els.scanGrid.innerHTML='';return;}
    const items=[
      ['Transparency',a.hasAlpha?`${Math.max(1,Math.round(a.alphaRatio*100))}% alpha sample`:'Opaque sample'],
      ['Fine edges',a.edgeHeavy?'High density · guard raised':'Normal density'],
      ['Working size',`${entry.workingWidth} × ${entry.workingHeight}`],
      ['Color profile',a.colorSpread>55?'Color-rich':'Moderate / neutral']
    ];
    els.scanGrid.innerHTML=items.map(([k,v])=>`<article><span>${k}</span><b>${v}</b></article>`).join('');
    els.scanSummary.textContent=a.edgeHeavy?'Fine-edge sensitive':a.hasAlpha?'Transparency detected':'Ready to compress';
  }

  function renderRace(entry){
    const race=entry?.result?.race||[];if(!els.race)return;
    const unique=[];const seen=new Set();
    for(let i=race.length-1;i>=0;i--){const r=race[i];if(!seen.has(r.mime)){seen.add(r.mime);unique.unshift(r);}}
    if(unique.length<2){els.race.innerHTML='';return;}
    const winner=entry.result.mime;
    els.race.innerHTML=`<strong>Smart Format Race</strong><div>${unique.map(r=>`<span class="${r.mime===winner?'winner':''}"><b>${mimeLabel[r.mime]||r.mime}</b> ${formatBytes(r.size)}${r.score!=null?` · ${r.score}/100`:''}</span>`).join('')}</div>`;
  }

  async function makeArtifactMap(entry){
    if(!entry?.sourceCanvas||!entry?.result?.blob||!els.artifactMap)return;
    const w=Math.min(720,entry.result.width), h=Math.max(1,Math.round(w*entry.result.height/entry.result.width));
    const src=document.createElement('canvas');src.width=w;src.height=h;src.getContext('2d').drawImage(entry.sourceCanvas,0,0,w,h);
    const out=await blobToCanvas(entry.result.blob,w,h);
    const sctx=src.getContext('2d',{willReadFrequently:true}),octx=out.getContext('2d',{willReadFrequently:true});
    const a=sctx.getImageData(0,0,w,h),b=octx.getImageData(0,0,w,h);const d=new ImageData(w,h);
    for(let i=0;i<a.data.length;i+=4){
      const diff=(Math.abs(a.data[i]-b.data[i])+Math.abs(a.data[i+1]-b.data[i+1])+Math.abs(a.data[i+2]-b.data[i+2]))/3;
      const v=clamp(Math.round(diff*5.5),0,255);d.data[i]=v;d.data[i+1]=Math.round(v*.32);d.data[i+2]=Math.round(v*.12);d.data[i+3]=v<12?80:210;
    }
    els.artifactMap.width=w;els.artifactMap.height=h;els.artifactMap.getContext('2d').putImageData(d,0,0);
  }

  function renderSelected(){
    const entry=state.files[state.selectedIndex];if(!entry)return;
    els.currentName.textContent=entry.file.name;
    const dim=entry.originalWidth?`${entry.originalWidth} × ${entry.originalHeight} · `:'';
    els.currentMeta.textContent=`${dim}${formatBytes(entry.file.size)} · ${(entry.file.type||'image').replace('image/','').toUpperCase()}`;
    els.before.src=entry.originalUrl;
    els.after.src=entry.resultUrl||entry.originalUrl;
    els.afterWrap?.classList.toggle('placeholder',!entry.resultUrl);
    renderScan(entry);
    if(entry.result){
      els.result.classList.remove('hidden');
      els.primaryActions?.classList.remove('hidden');
      els.resultTitle.textContent=entry.result.target&&entry.result.blob.size<=entry.result.target?'Target met':'Compression complete';
      els.originalSize.textContent=formatBytes(entry.file.size);els.originalFormat.textContent=(entry.file.type||'image').replace('image/','').toUpperCase();
      els.outputSize.textContent=formatBytes(entry.result.blob.size);els.outputFormat.textContent=mimeLabel[entry.result.mime]||entry.result.mime;
      els.saved.textContent=`${entry.result.savedPct>=0?'−':'+'}${Math.abs(entry.result.savedPct).toFixed(1)}%`;els.dimensions.textContent=`${entry.result.width} × ${entry.result.height}`;
      els.similarity.textContent=entry.result.metrics.score==null?'Not measured':`${entry.result.metrics.score}/100`;
      let status='READY',note='';
      if(entry.result.target){
        if(entry.result.blob.size<=entry.result.target){status='TARGET MET';note=`Output is under the requested ${formatBytes(entry.result.target)} target.`;}
        else if(entry.result.strategy==='quality'){status='QUALITY FIRST';note=`RIVANI kept more visual quality, so this result stayed ${formatBytes(entry.result.blob.size-entry.result.target)} above the requested target. Choose Strict Target if the byte limit is mandatory.`;}
        else {status='TARGET MISSED';note='The requested target could not be reached safely within the technical resize floor. Try a larger target.';}
      } else note=entry.result.savedPct>0?`Saved ${formatBytes(entry.file.size-entry.result.blob.size)} from the original file.`:'This image was already compact; the chosen settings did not reduce its size.';
      if(entry.result.metrics.score!=null&&entry.result.metrics.score<entry.result.floor)note+=` Visual similarity estimate is below the selected ${entry.result.floor}/100 floor; review Before/After and the Artifact Map.`;
      els.targetStatus.textContent=status;els.targetStatus.className='compressor-target-status '+(status==='TARGET MET'?'safe':status==='TARGET MISSED'?'miss':status==='QUALITY FIRST'?'warn':'');els.resultNote.textContent=note;
      renderRace(entry);
      makeArtifactMap(entry).catch(()=>{});
    }else{els.result.classList.add('hidden');els.primaryActions?.classList.add('hidden');}
    els.artifactMap.classList.toggle('hidden',!state.artifactVisible||!entry.result);
    els.before.classList.toggle('hidden',state.artifactVisible);
    els.afterWrap?.classList.toggle('hidden',state.artifactVisible);
    document.querySelector('.compressor-compare-line')?.classList.toggle('hidden',state.artifactVisible);
    els.compareRange?.classList.toggle('hidden',state.artifactVisible);
    document.querySelectorAll('.compressor-preview-label').forEach(x=>x.classList.toggle('hidden',state.artifactVisible));
  }

  function renderQueue(){
    if(!els.queue)return;
    els.queue.innerHTML=state.files.map((entry,i)=>`<button type="button" class="compressor-queue-item ${i===state.selectedIndex?'active':''}" data-index="${i}"><span>${entry.result?'✓':'•'}</span><b>${entry.file.name.replace(/[<>]/g,'')}</b><small>${entry.result?formatBytes(entry.result.blob.size):formatBytes(entry.file.size)}</small></button>`).join('');
    if(els.runLabel)els.runLabel.textContent=state.scope==='selected'?'Re-compress This Image':'Compress Image';
    els.batchLabel.textContent=state.scope==='selected'?'':(state.files.length>1?'s':'');
    els.run.disabled=!state.files.length||state.processing;
  }

  function setMode(mode){state.mode=mode;els.modeButtons.forEach(b=>b.classList.toggle('active',b.dataset.compressorMode===mode));els.modePanels.forEach(p=>p.classList.toggle('active',p.dataset.modePanel===mode));}
  function addFiles(fileList){
    state.scope='all';
    const incoming=[...fileList].filter(f=>f.type.startsWith('image/'));
    const room=Math.max(0,MAX_FILES-state.files.length);const accepted=incoming.slice(0,room);
    const oversized=accepted.filter(f=>f.size>MAX_FILE_BYTES);const usable=accepted.filter(f=>f.size<=MAX_FILE_BYTES);
    usable.forEach(file=>state.files.push({file,originalUrl:URL.createObjectURL(file),result:null,resultUrl:null,analysis:null}));
    if(oversized.length)alert(`${oversized.length} image(s) exceeded the 60 MB technical file limit and were skipped.`);
    if(incoming.length>room)alert(`RIVANI accepts up to ${MAX_FILES} images per batch. Extra files were skipped.`);
    if(!state.files.length)return;
    state.selectedIndex=Math.max(0,state.files.length-usable.length);state.batchFormat=null;
    els.drop.classList.add('hidden');els.editor.classList.remove('hidden');renderQueue();renderSelected();
  }
  function clearAll(){
    state.files.forEach(e=>{if(e.originalUrl)URL.revokeObjectURL(e.originalUrl);if(e.resultUrl)URL.revokeObjectURL(e.resultUrl)});state.files=[];state.selectedIndex=0;state.batchFormat=null;state.artifactVisible=false;state.scope='all';
    els.fileInput.value='';els.editor.classList.add('hidden');els.drop.classList.remove('hidden');els.result.classList.add('hidden');els.primaryActions?.classList.add('hidden');els.run.disabled=true;renderQueue();
  }

  async function requireAuth(label='Image Compressor'){
    if(typeof window.RIVANI_REQUIRE_AUTH==='function') return await window.RIVANI_REQUIRE_AUTH({tool:label});
    if(window.RIVANI_LUKI_CONTEXT?.signedIn) return true;
    // Auth module may still be loading on first interaction.
    try{await Promise.race([window.RIVANI_AUTH_READY||Promise.resolve(),new Promise(r=>setTimeout(r,1600))]);}catch(_){}
    if(typeof window.RIVANI_REQUIRE_AUTH==='function') return await window.RIVANI_REQUIRE_AUTH({tool:label});
    location.href=`auth.html?mode=login&next=${encodeURIComponent(location.pathname.split('/').pop()||'image-compressor.html')}`;return false;
  }

  async function runCompression(){
    if(state.processing||!state.files.length)return;
    if(!(await requireAuth('Image Compressor')))return;
    state.processing=true;state.batchFormat=null;els.run.disabled=true;els.processing.classList.remove('hidden');state.artifactVisible=false;
    try{
      const targets=state.scope==='selected'?[state.files[state.selectedIndex]]:state.files.slice();
      for(let i=0;i<targets.length;i++){
        const entry=targets[i];
        const actualIndex=state.files.indexOf(entry);
        if(actualIndex>=0)state.selectedIndex=actualIndex;
        renderQueue();renderSelected();
        await compressEntry(entry,i,targets.length);
        renderQueue();renderSelected();
      }
      updateProgress(100,'Complete','Compression complete','Review Before/After, visual similarity and the Artifact Map before downloading.');
      setTimeout(()=>els.processing.classList.add('hidden'),650);
    }catch(error){console.error('RIVANI compressor:',error);els.processing.classList.add('hidden');alert(error?.message||'Compression could not be completed.');}
    finally{state.processing=false;state.scope='all';renderQueue();els.run.disabled=!state.files.length;}
  }

  function downloadBlob(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);}
  async function downloadBatch(){
    const done=state.files.filter(e=>e.result);if(!done.length)return;
    if(done.length===1){downloadBlob(done[0].result.blob,outputName(done[0].file.name,done[0].result.mime));return;}
    if(!window.JSZip){done.forEach((e,i)=>setTimeout(()=>downloadBlob(e.result.blob,outputName(e.file.name,e.result.mime)),i*180));return;}
    const zip=new window.JSZip();done.forEach(e=>zip.file(outputName(e.file.name,e.result.mime),e.result.blob));
    const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'});downloadBlob(blob,'rivani-compressed-images.zip');
  }

  async function websitePack(){
    const entry=state.files[state.selectedIndex];if(!entry)return;if(!(await requireAuth('Website Pack')))return;
    const decoded=await decodeFile(entry.file);const ow=decoded.width||decoded.naturalWidth,oh=decoded.height||decoded.naturalHeight;
    try{
      const safeOriginal=safeDimensions(ow,oh).width;
      const widths=[480,768,1280,safeOriginal].filter((v,i,a)=>v<=safeOriginal&&a.indexOf(v)===i).sort((a,b)=>a-b);
      const formats=[];for(const m of ['image/avif','image/webp','image/jpeg'])if(await canEncode(m))formats.push(m);
      const zip=window.JSZip?new window.JSZip():null;const files=[];
      els.processing.classList.remove('hidden');
      let n=0,total=Math.max(1,widths.length*formats.length);
      for(const w of widths){
        const h=Math.round(oh*w/ow);const c=drawToCanvas(decoded,{width:w,height:h});
        for(const mime of formats){
          n++;updateProgress(n/total*95,`${w}px · ${mimeLabel[mime]}`,'Building Website Pack…','Creating responsive browser-ready image variants.');
          const q=mime==='image/jpeg'?.86:.82;const blob=await encodeAt(c,mime,q);const name=`${baseName(entry.file.name)}-${w}.${mimeExt[mime]}`;files.push({w,mime,name,blob});zip?.file(name,blob);
        }
      }
      const byMime=(m)=>files.filter(x=>x.mime===m).map(x=>`${x.name} ${x.w}w`).join(', ');
      const avif=byMime('image/avif'),webp=byMime('image/webp'),jpg=byMime('image/jpeg');
      const snippet=`<picture>\n${avif?`  <source type="image/avif" srcset="${avif}">\n`:''}${webp?`  <source type="image/webp" srcset="${webp}">\n`:''}  <img src="${files.filter(x=>x.mime==='image/jpeg').at(-1)?.name||files.at(-1)?.name||''}"${jpg?` srcset="${jpg}"`:''} sizes="100vw" alt="" loading="lazy" decoding="async">\n</picture>`;
      if(zip){zip.file('picture-snippet.html',snippet);zip.file('README.txt','RIVANI Website Pack\nResponsive image variants generated locally in your browser. Review dimensions and alt text before publishing.');const out=await zip.generateAsync({type:'blob',compression:'DEFLATE'});downloadBlob(out,`${baseName(entry.file.name)}-rivani-website-pack.zip`);}else{files.forEach((f,i)=>setTimeout(()=>downloadBlob(f.blob,f.name),i*160));downloadBlob(new Blob([snippet],{type:'text/plain'}),'picture-snippet.html');}
      updateProgress(100,'Complete','Website Pack ready','Responsive files and a <picture> snippet were generated in this browser.');setTimeout(()=>els.processing.classList.add('hidden'),700);
    }catch(error){console.error(error);els.processing.classList.add('hidden');alert(error?.message||'Website Pack could not be created.');}
    finally{closeDecoded(decoded);}
  }

  function editSelected(){
    const entry=state.files[state.selectedIndex];
    if(!entry)return;
    state.scope='selected';
    renderQueue();
    const controls=document.querySelector('.compressor-control-panel');
    try{controls?.scrollIntoView({behavior:'smooth',block:'start'});}catch(_){controls?.scrollIntoView();}
    setTimeout(()=>els.modeButtons.find(b=>b.classList.contains('active'))?.focus?.({preventScroll:true}),350);
  }

  function startAnotherImage(){
    clearAll();
    setTimeout(()=>els.fileInput?.click(),80);
  }

  // UI events
  els.modeButtons.forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.compressorMode)));
  els.easyPresets?.addEventListener('click',e=>{const b=e.target.closest('[data-preset]');if(!b)return;state.preset=b.dataset.preset;els.easyPresets.querySelectorAll('[data-preset]').forEach(x=>x.classList.toggle('active',x===b));});
  els.quickTargets?.addEventListener('click',e=>{const b=e.target.closest('[data-kb]');if(!b)return;els.targetValue.value=b.dataset.kb;els.targetUnit.value='KB';els.quickTargets.querySelectorAll('[data-kb]').forEach(x=>x.classList.toggle('active',x===b));});
  [els.qualityGuard,els.textGuard,els.transparencyGuard,els.formatRace,els.consistency].forEach(el=>el?.addEventListener('click',()=>setToggle(el,!isToggleOn(el))));
  els.quality?.addEventListener('input',()=>els.qualityValue.textContent=`${els.quality.value}%`);els.qualityFloor?.addEventListener('input',()=>els.qualityFloorValue.textContent=els.qualityFloor.value);
  els.choose?.addEventListener('click',()=>els.fileInput.click());els.addMore?.addEventListener('click',()=>{state.scope='all';els.fileInput.click();});els.fileInput?.addEventListener('change',()=>{addFiles(els.fileInput.files);els.fileInput.value='';});
  els.drop?.addEventListener('dragover',e=>{e.preventDefault();els.drop.classList.add('dragging')});els.drop?.addEventListener('dragleave',()=>els.drop.classList.remove('dragging'));els.drop?.addEventListener('drop',e=>{e.preventDefault();els.drop.classList.remove('dragging');addFiles(e.dataTransfer.files)});
  document.addEventListener('paste',e=>{const files=[...e.clipboardData?.files||[]].filter(f=>f.type.startsWith('image/'));if(files.length)addFiles(files)});
  els.clear?.addEventListener('click',clearAll);els.queue?.addEventListener('click',e=>{const b=e.target.closest('[data-index]');if(!b)return;state.selectedIndex=Number(b.dataset.index);state.artifactVisible=false;renderQueue();renderSelected();});
  els.compareRange?.addEventListener('input',()=>els.compare.style.setProperty('--compressor-compare',`${els.compareRange.value}%`));
  els.run?.addEventListener('click',runCompression);
  const downloadSelected=()=>{const e=state.files[state.selectedIndex];if(e?.result)downloadBlob(e.result.blob,outputName(e.file.name,e.result.mime));};
  els.primaryDownload?.addEventListener('click',downloadSelected);
  els.primaryEdit?.addEventListener('click',editSelected);
  els.primaryNew?.addEventListener('click',startAnotherImage);
  els.downloadOne?.addEventListener('click',downloadSelected);
  els.editOne?.addEventListener('click',editSelected);
  els.newImage?.addEventListener('click',startAnotherImage);
  els.downloadAll?.addEventListener('click',downloadBatch);
  els.websitePack?.addEventListener('click',websitePack);
  els.toggleArtifact?.addEventListener('click',()=>{const e=state.files[state.selectedIndex];if(!e?.result)return;state.artifactVisible=!state.artifactVisible;els.toggleArtifact.textContent=state.artifactVisible?'Before / After':'Artifact Map';renderSelected();});
  window.addEventListener('beforeunload',()=>state.files.forEach(e=>{if(e.originalUrl)URL.revokeObjectURL(e.originalUrl);if(e.resultUrl)URL.revokeObjectURL(e.resultUrl)}));

  setMode('easy');
})();
