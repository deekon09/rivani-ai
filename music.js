(()=>{
'use strict';

const CDN_BASE='https://cdn.jsdelivr.net/npm/ai-music-js@0.5.0/dist/';
const MODULE_URL=CDN_BASE+'index.js';
const WORKER_URL=CDN_BASE+'ace-step.worker.js';
const LANGUAGE_WORKER_URL=CDN_BASE+'language.worker.js';
const WASM_URL=CDN_BASE+'wasm/ort-wasm-simd-threaded.asyncify.wasm';
const WASM_MODULE_URL=CDN_BASE+'wasm/ort-wasm-simd-threaded.asyncify.mjs';

const DOWNLOADS={
  standard:5626494229,
  high:8004092572,
  planner:4633150982,
  lyrics:489166749
};

const QWEN_LYRICS_SYSTEM_PROMPT=`Write concise, singable lyrics from the user's song brief. Preserve the requested story, point of view, language and emotional tone. Prefer clear natural wording over forced rhyme. Use bracketed song sections such as [Verse], [Chorus] and [Bridge]. Keep lines short enough to sing and return only the lyrics.`;

const $=id=>document.getElementById(id);
const els={
  prompt:$('musicPrompt'),promptCount:$('promptCount'),vocalFields:$('vocalFields'),voice:$('voicePersona'),language:$('vocalLanguage'),aiLyrics:$('aiLyrics'),lyricsWrap:$('lyricsWrap'),lyrics:$('musicLyrics'),duration:$('durationSeconds'),audioQuality:$('audioQuality'),plannerQuality:$('plannerQuality'),sampler:$('sampler'),seed:$('seed'),variants:$('variants'),consent:$('downloadConsent'),downloadEstimate:$('downloadEstimate'),downloadDetail:$('downloadDetail'),generate:$('generateMusic'),cancel:$('cancelMusic'),progressWrap:$('progressWrap'),progressStage:$('progressStage'),progressPercent:$('progressPercent'),progressBar:$('progressBar'),progressDetail:$('progressDetail'),error:$('musicError'),results:$('musicResults'),browserState:$('browserState'),webgpuState:$('webgpuState'),storageState:$('storageState'),deviceHeadline:$('deviceHeadline'),deviceDot:$('deviceDot'),deviceNote:$('deviceNote'),recommendedMode:$('recommendedMode'),originUsage:$('originUsage'),originQuota:$('originQuota'),originAvailable:$('originAvailable'),refreshStorage:$('refreshStorage'),clearCache:$('clearMusicCache')
};

let runtime=null;
let runtimeModule=null;
let workerBlobUrl='';
let languageWorkerBlobUrl='';
let abortController=null;
let resultCounter=0;

const formatBytes=bytes=>{
  if(!Number.isFinite(bytes)||bytes<0)return '—';
  const units=['B','KB','MB','GB','TB'];let v=bytes,i=0;
  while(v>=1000&&i<units.length-1){v/=1000;i++;}
  return `${v>=100||i===0?v.toFixed(0):v.toFixed(2)} ${units[i]}`;
};

const selectedMode=()=>document.querySelector('input[name="songMode"]:checked')?.value||'instrumental';

function setError(message=''){
  if(!els.error)return;
  els.error.hidden=!message;
  els.error.textContent=message;
}

function setProgress(value,stage='Working…',detail=''){
  const pct=Math.round(Math.max(0,Math.min(1,Number(value)||0))*100);
  els.progressWrap.hidden=false;
  els.progressPercent.textContent=`${pct}%`;
  els.progressBar.style.width=`${pct}%`;
  els.progressStage.textContent=stage;
  els.progressDetail.textContent=detail||'Processing on this device.';
}

function getColdDownloadBytes(){
  let total=DOWNLOADS[els.audioQuality.value]||DOWNLOADS.standard;
  if(els.plannerQuality.value==='high-quality') total+=DOWNLOADS.planner;
  if(selectedMode()==='vocal'&&els.aiLyrics.checked) total+=DOWNLOADS.lyrics;
  return total;
}

function updateDownloadEstimate(){
  const bytes=getColdDownloadBytes();
  els.downloadEstimate.textContent=`~${formatBytes(bytes)}`;
  const parts=[els.audioQuality.value==='high'?'INT8 high-precision audio':'INT4 standard audio'];
  if(els.plannerQuality.value==='high-quality')parts.push('high-quality planner');
  if(selectedMode()==='vocal'&&els.aiLyrics.checked)parts.push('compact AI lyric writer');
  els.downloadDetail.textContent=`${parts.join(' + ')}. This is a worst-case cold download; already cached assets are reused.`;
}

function updateModeUI(){
  const vocal=selectedMode()==='vocal';
  els.vocalFields.hidden=!vocal;
  document.querySelectorAll('.mode-card').forEach(card=>card.classList.toggle('active',card.querySelector('input')?.checked));
  els.lyricsWrap.hidden=vocal&&els.aiLyrics.checked;
  if(vocal&&els.sampler.value==='euler-sde')els.sampler.value='heun';
  updateDownloadEstimate();
}

function applyPreset(name){
  document.querySelectorAll('[data-preset]').forEach(btn=>btn.classList.toggle('active',btn.dataset.preset===name));
  if(name==='eco'){
    els.audioQuality.value='standard';els.plannerQuality.value='turbo';els.duration.value='10';els.variants.value='1';els.recommendedMode.textContent='Eco';
  }else if(name==='performance'){
    els.audioQuality.value='high';els.plannerQuality.value='turbo';els.duration.value='20';els.variants.value='1';els.recommendedMode.textContent='Performance';
  }else if(name==='studio'){
    els.audioQuality.value='standard';els.plannerQuality.value='high-quality';els.duration.value='30';els.variants.value='1';els.recommendedMode.textContent='Studio';
  }else{
    els.audioQuality.value='standard';els.plannerQuality.value='turbo';els.duration.value='10';els.variants.value='1';els.recommendedMode.textContent='Balanced';
  }
  updateDownloadEstimate();
}

async function updateDeviceInfo(){
  const ua=navigator.userAgent||'';
  const chrome=/Chrome\//.test(ua)&&!/EdgA|OPR|SamsungBrowser/.test(ua);
  const edge=/Edg\//.test(ua);
  const desktop=!/Android|iPhone|iPad|iPod/i.test(ua);
  const supportedBrowser=desktop&&(chrome||edge);
  els.browserState.textContent=supportedBrowser?(edge?'Edge desktop':'Chrome desktop'):'Unsupported / unqualified';
  els.webgpuState.textContent=navigator.gpu?'Available':'Not available';
  try{
    const est=await navigator.storage?.estimate?.();
    if(est){
      els.storageState.textContent=`${formatBytes(est.quota||0)} quota`;
      els.originUsage.textContent=formatBytes(est.usage||0);
      els.originQuota.textContent=formatBytes(est.quota||0);
      els.originAvailable.textContent=formatBytes(Math.max(0,(est.quota||0)-(est.usage||0)));
    }else els.storageState.textContent='Estimate unavailable';
  }catch{els.storageState.textContent='Estimate unavailable';}
  const good=Boolean(supportedBrowser&&navigator.gpu&&window.isSecureContext);
  els.deviceDot.classList.toggle('good',good);els.deviceDot.classList.toggle('bad',!good);
  els.deviceHeadline.textContent=good?'Browser path available':'Browser path not ready';
  if(!window.isSecureContext)els.deviceNote.textContent='HTTPS is required for production WebGPU. Open RIVANI on its secure https:// domain.';
  else if(!supportedBrowser)els.deviceNote.textContent='Browser V1 is qualified only for current desktop Chrome/Edge. Mobile, Safari and Firefox are not supported by this runtime yet.';
  else if(!navigator.gpu)els.deviceNote.textContent='WebGPU is unavailable. Check browser hardware acceleration / graphics settings or use a supported GPU/browser.';
  else els.deviceNote.textContent='WebGPU detected. Start with a 10-second Standard / Turbo generation before trying larger modes.';
  els.generate.disabled=!good;
}

async function fetchWorkerBlob(url){
  const response=await fetch(url,{cache:'force-cache',mode:'cors'});
  if(!response.ok)throw new Error(`Browser engine asset failed to load (${response.status}).`);
  const source=await response.text();
  return URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
}

function handleRuntimeUpdate(update){
  if(!update||typeof update!=='object')return;
  if(update.type==='progress'){
    setProgress(update.progress,update.stage||'Working…',update.detail||'');
  }else if(update.type==='download'){
    const p=update.total>0?update.loaded/update.total:0;
    const detail=`${update.label||'Model asset'} · ${formatBytes(update.loaded||0)} / ${formatBytes(update.total||0)}`;
    els.progressDetail.textContent=detail;
    if(!els.progressWrap.hidden&&p>0&&Number(els.progressBar.style.width.replace('%',''))<5)els.progressBar.style.width=`${Math.max(1,Math.round(p*5))}%`;
  }else if(update.type==='stage'){
    els.progressStage.textContent=String(update.stage||'Processing');
    if(update.detail)els.progressDetail.textContent=String(update.detail);
  }else if(update.type==='compatibility'){
    const text=update.detail||update.message;
    if(text)els.progressDetail.textContent=String(text);
  }
}

async function ensureRuntime(){
  if(runtime)return runtime;
  if(!navigator.gpu)throw new Error('WebGPU is not available in this browser.');
  setProgress(0.01,'Loading browser engine','Loading pinned browser runtime. No AI model weights are downloaded at this step.');
  runtimeModule=await import(MODULE_URL);
  const [workerUrl,languageUrl]=await Promise.all([
    workerBlobUrl?Promise.resolve(workerBlobUrl):fetchWorkerBlob(WORKER_URL),
    languageWorkerBlobUrl?Promise.resolve(languageWorkerBlobUrl):fetchWorkerBlob(LANGUAGE_WORKER_URL)
  ]);
  workerBlobUrl=workerUrl;languageWorkerBlobUrl=languageUrl;
  runtime=new runtimeModule.AceStepWebGpu({
    workerUrl:workerBlobUrl,
    languageWorkerUrl:languageWorkerBlobUrl,
    wasmUrl:WASM_URL,
    wasmModuleUrl:WASM_MODULE_URL,
    allowWasmFallback:true,
    lyricsSystemPrompt:QWEN_LYRICS_SYSTEM_PROMPT,
    onUpdate:handleRuntimeUpdate
  });
  return runtime;
}

async function requireAuth(){
  if(typeof window.RIVANI_REQUIRE_AUTH==='function'){
    return Boolean(await window.RIVANI_REQUIRE_AUTH({tool:'RIVANI Music'}));
  }
  return true;
}

function validateInputs(){
  const prompt=els.prompt.value.trim();
  if(!prompt)throw new Error('Describe the song first.');
  if(!els.consent.checked)throw new Error('Please accept the model-download/device-use notice before generation.');
  const vocal=selectedMode()==='vocal';
  if(vocal&&!els.aiLyrics.checked&&!els.lyrics.value.trim())throw new Error('Add lyrics or enable browser AI lyric writing.');
  if(vocal&&els.sampler.value==='euler-sde')throw new Error('Euler SDE is not supported for vocal generation in this browser runtime. Choose Euler or Heun.');
  return prompt;
}

function buildPrompt(base){
  if(selectedMode()==='instrumental')return `${base}. Instrumental only, no vocals, polished stereo master.`;
  return `${base}. ${els.voice.value}. Clear lead vocal singing every supplied lyric, polished stereo master.`;
}

function createResultCard(result,index){
  if(els.results.querySelector('.empty-result'))els.results.innerHTML='';
  const card=document.createElement('article');card.className='result-card';
  const head=document.createElement('div');head.className='result-card-head';
  const title=document.createElement('strong');title.textContent=`Generation ${index}`;
  const time=document.createElement('small');time.textContent=new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  head.append(title,time);
  const audio=document.createElement('audio');audio.controls=true;audio.preload='metadata';
  const audioUrl=URL.createObjectURL(result.wav);audio.src=audioUrl;
  const meta=document.createElement('div');meta.className='result-meta';
  const items=[`${Math.round(result.durationSeconds||0)} sec`,`${result.sampleRate||48000} Hz`,result.audioQuality||els.audioQuality.value,`Seed ${result.seed}`];
  items.forEach(v=>{const s=document.createElement('span');s.textContent=v;meta.appendChild(s);});
  const actions=document.createElement('div');actions.className='result-actions';
  const download=document.createElement('a');download.className='music-btn music-btn-primary';download.textContent='Download WAV';download.href=audioUrl;download.download=`rivani-music-${result.seed||Date.now()}.wav`;
  actions.append(download);
  card.append(head,audio,meta,actions);
  if(result.lyrics){const lyr=document.createElement('div');lyr.className='result-lyrics';lyr.textContent=result.lyrics;card.appendChild(lyr);}
  els.results.prepend(card);
}

async function generateOne(seed,variantIndex,total,prompt){
  const rt=await ensureRuntime();
  const vocal=selectedMode()==='vocal';
  const options={
    prompt:buildPrompt(prompt),
    audioQuality:els.audioQuality.value,
    plannerQuality:els.plannerQuality.value,
    seed,
    durationSeconds:Number(els.duration.value),
    sampler:els.sampler.value,
    vocalLanguage:vocal?els.language.value:undefined,
    signal:abortController.signal
  };
  if(vocal){
    if(els.aiLyrics.checked){options.writeLyrics=true;options.lyricsPrompt=prompt;options.lyricsSystemPrompt=QWEN_LYRICS_SYSTEM_PROMPT;}
    else options.lyrics=els.lyrics.value.trim();
  }
  if(total>1)els.progressDetail.textContent=`Variant ${variantIndex} of ${total}`;
  return rt.generate(options);
}

async function startGeneration(){
  setError('');
  try{
    const prompt=validateInputs();
    const ok=await requireAuth();if(!ok)return;
    if(!window.isSecureContext)throw new Error('RIVANI Music Browser requires HTTPS.');
    if(!navigator.gpu)throw new Error('WebGPU is unavailable. Use current desktop Chrome/Edge with hardware acceleration.');
    abortController=new AbortController();
    els.generate.disabled=true;els.cancel.disabled=false;els.progressWrap.hidden=false;
    setProgress(0,'Starting','Preparing Browser V1. First run may download the selected model files.');
    const total=Number(els.variants.value)||1;const baseSeed=Math.max(0,Number(els.seed.value)||42);
    for(let i=0;i<total;i++){
      const result=await generateOne(baseSeed+i,i+1,total,prompt);
      resultCounter+=1;createResultCard(result,resultCounter);
    }
    setProgress(1,'Complete',`${total} generation${total>1?'s':''} finished on this device.`);
    await refreshStorage(true);
  }catch(error){
    if(error?.name==='AbortError')setError('Generation cancelled. Partial model downloads already cached by the browser may remain and can be cleared from Model Storage.');
    else setError(error instanceof Error?error.message:String(error));
  }finally{
    abortController=null;els.cancel.disabled=true;
    const good=Boolean(navigator.gpu&&window.isSecureContext);els.generate.disabled=!good;
  }
}

async function refreshStorage(silent=false){
  try{
    const est=await navigator.storage?.estimate?.();
    if(est){
      els.originUsage.textContent=formatBytes(est.usage||0);els.originQuota.textContent=formatBytes(est.quota||0);els.originAvailable.textContent=formatBytes(Math.max(0,(est.quota||0)-(est.usage||0)));
    }
    if(runtime){
      const inventory=await runtime.listCachedModels();
      if(inventory){
        if(Number.isFinite(inventory.usageBytes))els.originUsage.textContent=formatBytes(inventory.usageBytes);
        if(Number.isFinite(inventory.quotaBytes))els.originQuota.textContent=formatBytes(inventory.quotaBytes);
        if(Number.isFinite(inventory.availableBytes))els.originAvailable.textContent=formatBytes(inventory.availableBytes);
      }
    }
  }catch(error){if(!silent)setError(`Storage check failed: ${error instanceof Error?error.message:String(error)}`);}
}

async function clearCache(){
  setError('');
  if(!confirm('Remove RIVANI Music AI model files cached by this browser? Future generation will need to download them again.'))return;
  try{
    const rt=await ensureRuntime();
    els.clearCache.disabled=true;els.clearCache.textContent='Clearing…';
    await rt.clearCache();
    await refreshStorage(true);
  }catch(error){setError(`Could not clear model cache: ${error instanceof Error?error.message:String(error)}`);}
  finally{els.clearCache.disabled=false;els.clearCache.textContent='Clear RIVANI Music model cache';}
}

els.prompt?.addEventListener('input',()=>{els.promptCount.textContent=`${els.prompt.value.length} / 1000`;});
document.querySelectorAll('input[name="songMode"]').forEach(input=>input.addEventListener('change',updateModeUI));
els.aiLyrics?.addEventListener('change',updateModeUI);
els.audioQuality?.addEventListener('change',updateDownloadEstimate);
els.plannerQuality?.addEventListener('change',updateDownloadEstimate);
els.sampler?.addEventListener('change',updateModeUI);
document.querySelectorAll('[data-preset]').forEach(btn=>btn.addEventListener('click',()=>applyPreset(btn.dataset.preset)));
els.generate?.addEventListener('click',startGeneration);
els.cancel?.addEventListener('click',()=>abortController?.abort());
els.refreshStorage?.addEventListener('click',()=>refreshStorage(false));
els.clearCache?.addEventListener('click',clearCache);

window.addEventListener('beforeunload',()=>{
  abortController?.abort();
  try{runtime?.dispose?.();}catch{}
  if(workerBlobUrl)URL.revokeObjectURL(workerBlobUrl);
  if(languageWorkerBlobUrl)URL.revokeObjectURL(languageWorkerBlobUrl);
});

updateModeUI();updateDownloadEstimate();updateDeviceInfo();refreshStorage(true);
})();
