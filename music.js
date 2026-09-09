(()=>{
'use strict';

/* RIVANI Music V43.3 FULL CLOUD SCHEMA FIX
   Default: remote ACE-Step official Hugging Face Space via Gradio JS client.
   Fallback: V42 browser-only ACE-Step XL Turbo WebGPU runtime.
*/
const CLOUD_SPACE='ACE-Step/Ace-Step-v1.5';
const CLOUD_MODEL='acestep-v15-xl-turbo';
const GRADIO_MODULE='https://cdn.jsdelivr.net/npm/@gradio/client@2.5.1/+esm';

const BROWSER_CDN='https://cdn.jsdelivr.net/npm/ai-music-js@0.5.0/dist/';
const MODULE_URL=BROWSER_CDN+'index.js';
const WORKER_URL=BROWSER_CDN+'ace-step.worker.js';
const LANGUAGE_WORKER_URL=BROWSER_CDN+'language.worker.js';
const WASM_URL=BROWSER_CDN+'wasm/ort-wasm-simd-threaded.asyncify.wasm';
const WASM_MODULE_URL=BROWSER_CDN+'wasm/ort-wasm-simd-threaded.asyncify.mjs';

const DOWNLOADS={standard:5626494229,high:8004092572,planner:4633150982,lyrics:489166749};
const QWEN_LYRICS_SYSTEM_PROMPT=`Write concise, singable lyrics from the user's song brief. Preserve the requested story, point of view, language and emotional tone. Prefer clear natural wording over forced rhyme. Use bracketed song sections such as [Verse], [Chorus] and [Bridge]. Keep lines short enough to sing and return only the lyrics.`;

const $=id=>document.getElementById(id);
const els={
  prompt:$('musicPrompt'),promptCount:$('promptCount'),vocalFields:$('vocalFields'),voice:$('voicePersona'),language:$('vocalLanguage'),aiLyrics:$('aiLyrics'),aiLyricsNote:$('aiLyricsNote'),lyricsWrap:$('lyricsWrap'),lyrics:$('musicLyrics'),duration:$('durationSeconds'),audioQuality:$('audioQuality'),plannerQuality:$('plannerQuality'),sampler:$('sampler'),seed:$('seed'),variants:$('variants'),consent:$('downloadConsent'),downloadEstimate:$('downloadEstimate'),downloadDetail:$('downloadDetail'),generate:$('generateMusic'),cancel:$('cancelMusic'),progressWrap:$('progressWrap'),progressStage:$('progressStage'),progressPercent:$('progressPercent'),progressBar:$('progressBar'),progressDetail:$('progressDetail'),error:$('musicError'),results:$('musicResults'),cloudState:$('cloudState'),cloudAsideState:$('cloudAsideState'),cloudModelState:$('cloudModelState'),webgpuState:$('webgpuState'),storageState:$('storageState'),deviceHeadline:$('deviceHeadline'),deviceDot:$('deviceDot'),deviceNote:$('deviceNote'),originUsage:$('originUsage'),originQuota:$('originQuota'),originAvailable:$('originAvailable'),refreshStorage:$('refreshStorage'),clearCache:$('clearMusicCache'),browserTuning:$('browserTuning'),browserAdvanced:$('browserAdvanced'),browserStoragePanel:$('browserStoragePanel'),cloudQualityCard:$('cloudQualityCard'),cloudDisclosure:$('cloudDisclosure'),cloudRouteDetail:$('cloudRouteDetail'),engineTag:$('engineTag')
};

let runtime=null;
let runtimeModule=null;
let workerBlobUrl='';
let languageWorkerBlobUrl='';
let abortController=null;
let cloudClient=null;
let cloudApiInfo=null;
let cloudEndpoint=null;
let cloudSubmission=null;
let resultCounter=0;

const formatBytes=bytes=>{if(!Number.isFinite(bytes)||bytes<0)return '—';const units=['B','KB','MB','GB','TB'];let v=bytes,i=0;while(v>=1000&&i<units.length-1){v/=1000;i++;}return `${v>=100||i===0?v.toFixed(0):v.toFixed(2)} ${units[i]}`;};
const selectedMode=()=>document.querySelector('input[name="songMode"]:checked')?.value||'instrumental';
const selectedRoute=()=>document.querySelector('input[name="generationRoute"]:checked')?.value||'cloud';
const norm=value=>String(value??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

function setError(message=''){if(!els.error)return;els.error.hidden=!message;els.error.textContent=message;}
function setProgress(value,stage='Working…',detail=''){const pct=Math.round(Math.max(0,Math.min(1,Number(value)||0))*100);els.progressWrap.hidden=false;els.progressPercent.textContent=`${pct}%`;els.progressBar.style.width=`${pct}%`;els.progressStage.textContent=stage;els.progressDetail.textContent=detail||'Processing.';}

function getColdDownloadBytes(){let total=DOWNLOADS[els.audioQuality.value]||DOWNLOADS.standard;if(els.plannerQuality.value==='high-quality')total+=DOWNLOADS.planner;if(selectedMode()==='vocal'&&els.aiLyrics.checked)total+=DOWNLOADS.lyrics;return total;}
function updateDownloadEstimate(){const bytes=getColdDownloadBytes();els.downloadEstimate.textContent=`~${formatBytes(bytes)}`;const parts=[els.audioQuality.value==='high'?'INT8 high-precision audio':'INT4 standard audio'];if(els.plannerQuality.value==='high-quality')parts.push('high-quality planner');if(selectedMode()==='vocal'&&els.aiLyrics.checked)parts.push('compact AI lyric writer');els.downloadDetail.textContent=`${parts.join(' + ')}. This is a worst-case cold download; already cached assets are reused.`;}

function updateModeUI(){
  const vocal=selectedMode()==='vocal';
  els.vocalFields.hidden=!vocal;
  document.querySelectorAll('.mode-card').forEach(card=>card.classList.toggle('active',card.querySelector('input')?.checked));
  if(selectedRoute()==='cloud'&&els.aiLyrics.checked)els.aiLyrics.checked=false;
  els.lyricsWrap.hidden=vocal&&els.aiLyrics.checked;
  if(vocal&&els.sampler?.value==='euler-sde')els.sampler.value='heun';
  updateDownloadEstimate();
}

function applyPreset(name){
  document.querySelectorAll('[data-preset]').forEach(btn=>btn.classList.toggle('active',btn.dataset.preset===name));
  if(name==='eco'){els.audioQuality.value='standard';els.plannerQuality.value='turbo';els.duration.value='10';els.variants.value='1';}
  else if(name==='performance'){els.audioQuality.value='high';els.plannerQuality.value='turbo';els.duration.value='20';els.variants.value='1';}
  else if(name==='studio'){els.audioQuality.value='standard';els.plannerQuality.value='high-quality';els.duration.value='30';els.variants.value='1';}
  else{els.audioQuality.value='standard';els.plannerQuality.value='turbo';els.duration.value='10';els.variants.value='1';}
  updateDownloadEstimate();
}

async function updateDeviceInfo(){
  const ua=navigator.userAgent||'';const chrome=/Chrome\//.test(ua)&&!/EdgA|OPR|SamsungBrowser/.test(ua);const edge=/Edg\//.test(ua);const desktop=!/Android|iPhone|iPad|iPod/i.test(ua);const supportedBrowser=desktop&&(chrome||edge);
  els.webgpuState.textContent=navigator.gpu?'Available':'Not available';
  try{const est=await navigator.storage?.estimate?.();if(est){els.storageState.textContent=`${formatBytes(est.quota||0)} quota`;if(els.originUsage)els.originUsage.textContent=formatBytes(est.usage||0);if(els.originQuota)els.originQuota.textContent=formatBytes(est.quota||0);if(els.originAvailable)els.originAvailable.textContent=formatBytes(Math.max(0,(est.quota||0)-(est.usage||0)));}else els.storageState.textContent='Estimate unavailable';}catch{els.storageState.textContent='Estimate unavailable';}
  if(selectedRoute()==='cloud'){
    const good=Boolean(window.isSecureContext&&navigator.onLine!==false);els.deviceDot.classList.toggle('good',good);els.deviceDot.classList.toggle('bad',!good);els.deviceHeadline.textContent=good?'Instant Cloud ready on demand':'Cloud network path unavailable';els.deviceNote.textContent=good?'No AI model weights download to this browser in Cloud mode. Connection starts only after Generate.':'Check the internet connection and use the secure RIVANI domain.';els.generate.disabled=!good;
  }else{
    const good=Boolean(supportedBrowser&&navigator.gpu&&window.isSecureContext);els.deviceDot.classList.toggle('good',good);els.deviceDot.classList.toggle('bad',!good);els.deviceHeadline.textContent=good?'Private WebGPU path available':'Private WebGPU path not ready';if(!window.isSecureContext)els.deviceNote.textContent='HTTPS is required for production WebGPU.';else if(!supportedBrowser)els.deviceNote.textContent='Private Browser V1 is qualified for current desktop Chrome/Edge.';else if(!navigator.gpu)els.deviceNote.textContent='WebGPU is unavailable. Use Cloud mode or enable hardware acceleration on a supported browser.';else els.deviceNote.textContent='Private WebGPU detected. First use requires the selected model download.';els.generate.disabled=!good;
  }
}

function updateRouteUI(){
  const cloud=selectedRoute()==='cloud';
  document.querySelectorAll('[data-route-card]').forEach(card=>card.classList.toggle('active',card.dataset.routeCard===selectedRoute()));
  els.browserTuning.hidden=cloud;els.browserAdvanced.hidden=cloud;els.browserStoragePanel.hidden=cloud;els.cloudQualityCard.hidden=!cloud;els.cloudDisclosure.hidden=!cloud;els.cloudRouteDetail.hidden=!cloud;
  els.engineTag.textContent=cloud?'Instant Cloud · XL Turbo':'Private Browser · XL Turbo';
  els.generate.textContent=cloud?'Generate · No Model Download →':'Generate Privately →';
  els.aiLyrics.disabled=cloud;
  els.aiLyricsNote.textContent=cloud?'Cloud auto-lyrics is not enabled in V43.3 yet; paste lyrics below. Private Browser can use its local lyric writer.':'Private Browser AI lyrics adds roughly 0.49 GB for the compact local lyric writer.';
  if(cloud&&els.aiLyrics.checked)els.aiLyrics.checked=false;
  updateModeUI();updateDeviceInfo();
}

async function requireAuth(){if(typeof window.RIVANI_REQUIRE_AUTH==='function')return Boolean(await window.RIVANI_REQUIRE_AUTH({tool:'RIVANI Music'}));return true;}
function validateInputs(){
  const prompt=els.prompt.value.trim();if(!prompt)throw new Error('Describe the song first.');
  const vocal=selectedMode()==='vocal';
  if(selectedRoute()==='cloud'){
    if(vocal&&!els.lyrics.value.trim())throw new Error('Cloud V43.3 needs supplied lyrics for vocal mode. Paste lyrics or use Instrumental.');
  }else{
    if(!els.consent.checked)throw new Error('Please accept the Private Browser model-download/device-use notice.');
    if(vocal&&!els.aiLyrics.checked&&!els.lyrics.value.trim())throw new Error('Add lyrics or enable Private Browser AI lyric writing.');
    if(vocal&&els.sampler.value==='euler-sde')throw new Error('Euler SDE is not supported for vocal generation. Choose Euler or Heun.');
  }
  return prompt;
}
function buildPrompt(base){if(selectedMode()==='instrumental')return `${base}. Instrumental only, no vocals, polished stereo master.`;return `${base}. ${els.voice.value}. Clear lead vocal singing every supplied lyric, polished stereo master.`;}

/* ---------- Instant Cloud adapter ---------- */
function scoreCloudEndpoint(name,spec){
  const n=norm(name);const params=(spec?.parameters||[]).map(p=>norm(`${p.parameter_name||p.name||''} ${p.label||''}`));const returns=(spec?.returns||[]).map(r=>norm(`${r.component||''} ${r.label||''} ${r.python_type?.type||r.python_type||''}`));let score=0;
  if(n.includes('generation wrapper'))score+=120;if(n.includes('generate music'))score+=70;if(n.includes('generate'))score+=25;if(n.includes('train')||n.includes('score')||n.includes('random'))score-=40;
  if((spec?.parameters||[]).length>=40)score+=45;
  const firstFour=params.slice(0,4).join(' | ');if(firstFour.includes('selected model')&&firstFour.includes('generation mode')&&firstFour.includes('simple query')&&firstFour.includes('simple vocal'))score+=120;
  if(params.some(x=>x.includes('caption')||x.includes('prompt')||x.includes('tag')))score+=20;if(params.some(x=>x.includes('lyrics')))score+=16;if(params.some(x=>x.includes('duration')))score+=8;if(params.some(x=>x.includes('seed')))score+=6;if(returns.some(x=>x.includes('audio')))score+=35;
  return score;
}
function resolveCloudEndpoint(apiInfo){
  const named=apiInfo?.named_endpoints||{};const ranked=Object.entries(named).map(([name,spec])=>({name,spec,score:scoreCloudEndpoint(name,spec)})).sort((a,b)=>b.score-a.score);
  if(!ranked.length||ranked[0].score<35)throw new Error('ACE-Step Cloud generation endpoint could not be discovered. Switch to Private Browser and retry later.');
  return ranked[0];
}
function cloudKey(param){return param?.parameter_name||param?.name||param?.label||'';}

/*
  ACE-Step official ZeroGPU Space compatibility contract (deployed Gradio UI).
  IMPORTANT: generation_wrapper(selected_model, generation_mode,
  simple_query_input, simple_vocal_language, *args) exposes exactly 54 inputs.
  Do not mix this order with the newer GitHub refactor's generation schema.
*/
const CLOUD_SCHEMA_INPUTS=54;
const CLOUD_DEFAULT_INSTRUCTION='Fill the audio semantic mask based on the given conditions:';

function cloudParamIdentity(param){
  return norm(`${param?.parameter_name||''} ${param?.name||''} ${param?.label||''}`);
}

function cloudChoices(param){
  const candidates=[
    param?.choices,
    param?.component?.choices,
    param?.component?.props?.choices,
    param?.component_props?.choices,
    param?.metadata?.choices
  ];
  for(const list of candidates){
    if(Array.isArray(list))return list.map(x=>Array.isArray(x)?x[1]:x).filter(x=>x!==undefined&&x!==null);
  }
  return [];
}

function assertChoice(params,index,value,label){
  const choices=cloudChoices(params[index]);
  if(choices.length&&!choices.map(String).includes(String(value))){
    throw new Error(`Instant Cloud compatibility check failed: ${label} is no longer accepted by the provider. No generation request was sent.`);
  }
}

function validateCloudSchema(spec){
  const params=spec?.parameters||[];
  if(params.length!==CLOUD_SCHEMA_INPUTS){
    throw new Error(`Instant Cloud provider API changed (${params.length} inputs found; ${CLOUD_SCHEMA_INPUTS} expected). RIVANI stopped the request before submitting invalid settings. Private Browser is still available.`);
  }

  // The first four inputs are named by the deployed generation_wrapper.
  // Labels can vary by Gradio version, so only reject when a clearly named
  // field contradicts the expected role.
  const expected=[
    ['selected model','model selector','dit model'],
    ['generation mode'],
    ['simple query'],
    ['simple vocal language']
  ];
  for(let i=0;i<4;i++){
    const id=cloudParamIdentity(params[i]);
    if(!id)continue;
    const generic=/^param\s*\d+$/.test(id);
    if(generic)continue;
    if(!expected[i].some(token=>id.includes(token))){
      throw new Error(`Instant Cloud provider API changed near input ${i+1}. RIVANI stopped the request before submission. Private Browser is still available.`);
    }
  }

  // Guard the deployed dropdown slots when Gradio exposes their choices.
  assertChoice(params,1,'custom','generation mode');
  assertChoice(params,28,'ode','inference method');
  assertChoice(params,30,'flac','audio format');
  return params;
}

function buildCloudPayload(spec,prompt,seed){
  const params=validateCloudSchema(spec);
  const vocal=selectedMode()==='vocal';
  const caption=buildPrompt(prompt);
  const lyrics=vocal?els.lyrics.value.trim():'[Instrumental]';
  const language=vocal?els.language.value:'unknown';
  const duration=Math.max(10,Math.min(600,Number(els.duration.value)||10));
  const safeSeed=String(Math.max(0,Math.trunc(Number(seed)||42)));

  // EXACT deployed HF Space order, indices 0..53.
  const payload=[
    CLOUD_MODEL,                  // 00 dit_model_selector
    'custom',                     // 01 generation_mode
    caption,                      // 02 simple_query_input
    language,                     // 03 simple_vocal_language
    caption,                      // 04 captions
    lyrics,                       // 05 lyrics
    0,                            // 06 bpm (0 = auto/N/A)
    '',                           // 07 key_scale
    '',                           // 08 time_signature
    language,                     // 09 vocal_language
    8,                            // 10 inference_steps (XL Turbo)
    7.0,                          // 11 guidance_scale
    false,                        // 12 random_seed_checkbox
    safeSeed,                     // 13 seed (Gradio Textbox)
    null,                         // 14 reference_audio
    duration,                     // 15 audio_duration
    1,                            // 16 batch_size_input
    null,                         // 17 src_audio
    '',                           // 18 text2music_audio_code_string
    0.0,                          // 19 repainting_start
    -1,                           // 20 repainting_end
    CLOUD_DEFAULT_INSTRUCTION,    // 21 instruction_display_gen
    1.0,                          // 22 audio_cover_strength
    'text2music',                 // 23 task_type
    false,                        // 24 use_adg
    0.0,                          // 25 cfg_interval_start
    1.0,                          // 26 cfg_interval_end
    3.0,                          // 27 shift
    'ode',                        // 28 infer_method
    '',                           // 29 custom_timesteps
    'flac',                       // 30 audio_format (valid UI choice, lossless)
    0.85,                         // 31 lm_temperature
    true,                         // 32 think_checkbox
    2.0,                          // 33 lm_cfg_scale
    0,                            // 34 lm_top_k
    0.9,                          // 35 lm_top_p
    'NO USER INPUT',              // 36 lm_negative_prompt
    true,                         // 37 use_cot_metas
    true,                         // 38 use_cot_caption
    true,                         // 39 use_cot_language
    false,                        // 40 is_format_caption_state
    false,                        // 41 constrained_decoding_debug
    true,                         // 42 allow_lm_batch (deployed UI default)
    false,                        // 43 auto_score
    false,                        // 44 auto_lrc
    0.5,                          // 45 score_scale (deployed UI default)
    8,                            // 46 lm_batch_chunk_size
    null,                         // 47 track_name dropdown blank = None/null
    [],                           // 48 complete_track_classes
    false,                        // 49 autogen_checkbox
    0,                            // 50 current_batch_index
    1,                            // 51 total_batches
    {},                           // 52 batch_queue gr.State(value={})
    {}                            // 53 generation_params_state gr.State(value={})
  ];

  // Local contract tests: never send shifted/invalid payloads to the provider.
  if(payload.length!==CLOUD_SCHEMA_INPUTS)throw new Error('RIVANI Cloud payload contract failed locally. No request was sent.');
  if(payload.some(v=>v===undefined))throw new Error('RIVANI Cloud payload contains an undefined value. No request was sent.');
  if(!['mp3','flac'].includes(payload[30]))throw new Error('RIVANI Cloud audio format contract failed locally. No request was sent.');
  if(!['ode','sde'].includes(payload[28]))throw new Error('RIVANI Cloud inference method contract failed locally. No request was sent.');
  if(payload[47]!==null)throw new Error('RIVANI Cloud track selector contract failed locally. No request was sent.');
  if(Array.isArray(payload[52])||Array.isArray(payload[53])||typeof payload[52]!=='object'||typeof payload[53]!=='object')throw new Error('RIVANI Cloud state contract failed locally. No request was sent.');

  // Keep XL quality explicit. Do not silently fall back to the smaller model.
  const modelChoices=cloudChoices(params[0]);
  if(modelChoices.length&&!modelChoices.map(String).includes(CLOUD_MODEL)){
    throw new Error('ACE-Step XL Turbo is not currently offered by the Cloud provider. RIVANI will not silently downgrade quality; use Private Browser or retry later.');
  }
  return payload;
}

function friendlyCloudProviderError(message){
  const m=String(message||'Cloud generation failed.');
  if(/No value provided for required parameter/i.test(m)||/not in the list of choices/i.test(m)||/value: .* choices/i.test(m)){
    console.error('ACE-Step Cloud schema rejection:',m);
    return 'Instant Cloud provider API rejected a compatibility setting. RIVANI stopped the request; no model download occurred. Use Private Browser for now or retry after the Cloud adapter is refreshed.';
  }
  return m;
}

async function ensureCloudClient(){
  if(cloudClient&&cloudEndpoint)return {client:cloudClient,endpoint:cloudEndpoint};
  setProgress(.02,'Connecting to Instant Cloud','Connecting to the ACE-Step shared GPU service. No AI model weights are downloading to your device.');
  els.cloudState.textContent='Connecting…';els.cloudAsideState.textContent='Connecting…';
  const mod=await import(GRADIO_MODULE);const Client=mod.Client;if(!Client)throw new Error('Cloud client library could not load.');
  cloudClient=await Client.connect(CLOUD_SPACE,{events:['data','status'],record_history:false,status_callback:s=>{if(s?.status)els.cloudAsideState.textContent=String(s.status);}});
  cloudApiInfo=await cloudClient.view_api();cloudEndpoint=resolveCloudEndpoint(cloudApiInfo);
  els.cloudState.textContent='Connected';els.cloudAsideState.textContent='Connected';
  return {client:cloudClient,endpoint:cloudEndpoint};
}

function collectAudioFiles(value,out=[]){
  if(value==null)return out;
  if(Array.isArray(value)){value.forEach(v=>collectAudioFiles(v,out));return out;}
  if(typeof value==='string'){
    if(/^https?:\/\//i.test(value)&&/\.(wav|mp3|flac|ogg|opus|m4a|aac)(\?|$)/i.test(value))out.push({url:value,name:'RIVANI Music'});
    return out;
  }
  if(typeof value==='object'){
    const url=typeof value.url==='string'?value.url:(typeof value.path==='string'&&/^https?:\/\//i.test(value.path)?value.path:'');
    const mime=String(value.mime_type||value.mimeType||'');const name=String(value.orig_name||value.name||'RIVANI Music');
    if(url&&(mime.startsWith('audio/')||/\.(wav|mp3|flac|ogg|opus|m4a|aac)(\?|$)/i.test(url)||/\.(wav|mp3|flac|ogg|opus|m4a|aac)$/i.test(name)))out.push({url,name,mime});
    Object.values(value).forEach(v=>{if(v!==value.url&&v!==value.path&&v!==value.orig_name)collectAudioFiles(v,out);});
  }
  return out;
}
function uniqueAudioFiles(files){const seen=new Set();return files.filter(f=>{if(!f?.url||seen.has(f.url))return false;seen.add(f.url);return true;});}
function cloudProgressFromStatus(msg){
  if(msg?.progress_data?.length){const vals=msg.progress_data.map(x=>Number(x.progress)).filter(Number.isFinite);if(vals.length)return .15+.75*Math.max(...vals);}
  if(msg?.stage==='pending')return .08;if(msg?.stage==='generating')return .35;if(msg?.stage==='complete')return .95;return .12;
}

function createCloudResultCard(file,index,seed){
  if(els.results.querySelector('.empty-result'))els.results.innerHTML='';const card=document.createElement('article');card.className='result-card';const head=document.createElement('div');head.className='result-card-head';const title=document.createElement('strong');title.textContent=`Generation ${index}`;const source=document.createElement('span');source.className='result-source';source.textContent='Instant Cloud';head.append(title,source);
  const audio=document.createElement('audio');audio.controls=true;audio.preload='metadata';audio.src=file.url;const meta=document.createElement('div');meta.className='result-meta';[`${Number(els.duration.value)} sec target`,'ACE-Step XL Turbo',`Seed ${seed}`].forEach(v=>{const s=document.createElement('span');s.textContent=v;meta.appendChild(s);});const actions=document.createElement('div');actions.className='result-actions';const download=document.createElement('a');download.className='music-btn music-btn-primary';download.textContent='Download Audio';download.href=file.url;download.target='_blank';download.rel='noopener';download.download=file.name||`rivani-music-${seed}.wav`;actions.append(download);card.append(head,audio,meta,actions);els.results.prepend(card);
}

async function generateCloudOne(seed,variantIndex,total,prompt){
  const {client,endpoint}=await ensureCloudClient();const payload=buildCloudPayload(endpoint.spec,prompt,seed);setProgress(.06,total>1?`Cloud variant ${variantIndex}/${total}`:'Queued for Cloud GPU','Submitting to the shared ACE-Step ZeroGPU queue.');
  let lastData=null;let bestFiles=[];cloudSubmission=client.submit(endpoint.name,payload);
  for await(const msg of cloudSubmission){
    if(msg?.type==='status'){
      const detail=msg.stage==='pending'?(Number.isFinite(msg.position)?`Queue position ${msg.position}${Number.isFinite(msg.eta)?` · ETA ${Math.round(msg.eta)}s`:''}`:'Waiting in provider queue…'):(msg.message||msg.stage||'Cloud processing');
      setProgress(cloudProgressFromStatus(msg),msg.stage==='generating'?'Generating on Cloud GPU':'Instant Cloud',detail);
      if(msg.stage==='error'||msg.success===false){throw new Error(friendlyCloudProviderError(msg.message||'Cloud generation failed.'));}
    }else if(msg?.type==='data'){
      lastData=msg.data;const found=uniqueAudioFiles(collectAudioFiles(msg.data,[]));if(found.length)bestFiles=found;setProgress(.78,'Receiving Cloud result',found.length?'Audio result is ready.':'ACE-Step is processing the track…');
    }
  }
  cloudSubmission=null;
  if(!bestFiles.length)bestFiles=uniqueAudioFiles(collectAudioFiles(lastData,[]));
  if(!bestFiles.length)throw new Error('Cloud job completed but no playable audio URL was returned. The provider API may have changed; use Private Browser while RIVANI updates the adapter.');
  return bestFiles;
}

async function startCloudGeneration(prompt){
  if(!navigator.onLine)throw new Error('Internet connection is required for Instant Cloud.');
  const total=Number(els.variants.value)||1;const baseSeed=Math.max(0,Number(els.seed.value)||42);let made=0;
  for(let i=0;i<total;i++){
    const files=await generateCloudOne(baseSeed+i,i+1,total,prompt);
    for(const file of files.slice(0,1)){resultCounter++;createCloudResultCard(file,resultCounter,baseSeed+i);made++;}
  }
  if(!made)throw new Error('No Cloud audio result was returned.');
  setProgress(1,'Complete',`${made} Cloud generation${made>1?'s':''} returned. No AI model weights were downloaded to this browser.`);
}

/* ---------- Private Browser V42 fallback ---------- */
async function fetchWorkerBlob(url){const response=await fetch(url,{cache:'force-cache',mode:'cors'});if(!response.ok)throw new Error(`Browser engine asset failed to load (${response.status}).`);const source=await response.text();return URL.createObjectURL(new Blob([source],{type:'text/javascript'}));}
function handleRuntimeUpdate(update){if(!update||typeof update!=='object')return;if(update.type==='progress')setProgress(update.progress,update.stage||'Working…',update.detail||'');else if(update.type==='download'){const detail=`${update.label||'Model asset'} · ${formatBytes(update.loaded||0)} / ${formatBytes(update.total||0)}`;els.progressDetail.textContent=detail;}else if(update.type==='stage'){els.progressStage.textContent=String(update.stage||'Processing');if(update.detail)els.progressDetail.textContent=String(update.detail);}}
async function ensureRuntime(){if(runtime)return runtime;if(!navigator.gpu)throw new Error('WebGPU is not available in this browser.');setProgress(.01,'Loading Private Browser engine','Loading the browser runtime. Model weights download only after Private generation starts.');runtimeModule=await import(MODULE_URL);const [workerUrl,languageUrl]=await Promise.all([workerBlobUrl?Promise.resolve(workerBlobUrl):fetchWorkerBlob(WORKER_URL),languageWorkerBlobUrl?Promise.resolve(languageWorkerBlobUrl):fetchWorkerBlob(LANGUAGE_WORKER_URL)]);workerBlobUrl=workerUrl;languageWorkerBlobUrl=languageUrl;runtime=new runtimeModule.AceStepWebGpu({workerUrl:workerBlobUrl,languageWorkerUrl:languageWorkerBlobUrl,wasmUrl:WASM_URL,wasmModuleUrl:WASM_MODULE_URL,allowWasmFallback:true,lyricsSystemPrompt:QWEN_LYRICS_SYSTEM_PROMPT,onUpdate:handleRuntimeUpdate});return runtime;}
function createBrowserResultCard(result,index){if(els.results.querySelector('.empty-result'))els.results.innerHTML='';const card=document.createElement('article');card.className='result-card';const head=document.createElement('div');head.className='result-card-head';const title=document.createElement('strong');title.textContent=`Generation ${index}`;const source=document.createElement('span');source.className='result-source';source.textContent='Private Browser';head.append(title,source);const audio=document.createElement('audio');audio.controls=true;audio.preload='metadata';const audioUrl=URL.createObjectURL(result.wav);audio.src=audioUrl;const meta=document.createElement('div');meta.className='result-meta';[`${Math.round(result.durationSeconds||0)} sec`,`${result.sampleRate||48000} Hz`,result.audioQuality||els.audioQuality.value,`Seed ${result.seed}`].forEach(v=>{const s=document.createElement('span');s.textContent=v;meta.appendChild(s);});const actions=document.createElement('div');actions.className='result-actions';const download=document.createElement('a');download.className='music-btn music-btn-primary';download.textContent='Download WAV';download.href=audioUrl;download.download=`rivani-music-${result.seed||Date.now()}.wav`;actions.append(download);card.append(head,audio,meta,actions);if(result.lyrics){const lyr=document.createElement('div');lyr.className='result-lyrics';lyr.textContent=result.lyrics;card.appendChild(lyr);}els.results.prepend(card);}
async function generateBrowserOne(seed,prompt){const rt=await ensureRuntime();const vocal=selectedMode()==='vocal';const options={prompt:buildPrompt(prompt),audioQuality:els.audioQuality.value,plannerQuality:els.plannerQuality.value,seed,durationSeconds:Number(els.duration.value),sampler:els.sampler.value,vocalLanguage:vocal?els.language.value:undefined,signal:abortController.signal};if(vocal){if(els.aiLyrics.checked){options.writeLyrics=true;options.lyricsPrompt=prompt;options.lyricsSystemPrompt=QWEN_LYRICS_SYSTEM_PROMPT;}else options.lyrics=els.lyrics.value.trim();}return rt.generate(options);}
async function startBrowserGeneration(prompt){if(!window.isSecureContext)throw new Error('Private Browser requires HTTPS.');if(!navigator.gpu)throw new Error('WebGPU is unavailable. Use Instant Cloud or current desktop Chrome/Edge with hardware acceleration.');abortController=new AbortController();const total=Number(els.variants.value)||1;const baseSeed=Math.max(0,Number(els.seed.value)||42);for(let i=0;i<total;i++){const result=await generateBrowserOne(baseSeed+i,prompt);resultCounter++;createBrowserResultCard(result,resultCounter);}setProgress(1,'Complete',`${total} Private Browser generation${total>1?'s':''} finished on this device.`);await refreshStorage(true);}

async function startGeneration(){
  setError('');
  try{
    const prompt=validateInputs();const ok=await requireAuth();if(!ok)return;
    els.generate.disabled=true;els.cancel.disabled=false;els.progressWrap.hidden=false;setProgress(0,'Starting',selectedRoute()==='cloud'?'Preparing Instant Cloud. No AI model download will start.':'Preparing Private Browser generation.');
    if(selectedRoute()==='cloud')await startCloudGeneration(prompt);else await startBrowserGeneration(prompt);
  }catch(error){
    if(error?.name==='AbortError')setError('Generation cancelled.');else setError(error instanceof Error?error.message:String(error));
    if(selectedRoute()==='cloud'){els.cloudState.textContent='Unavailable / retry';els.cloudAsideState.textContent='Retry available';}
  }finally{
    abortController=null;cloudSubmission=null;els.cancel.disabled=true;updateDeviceInfo();
  }
}

async function refreshStorage(silent=false){try{const est=await navigator.storage?.estimate?.();if(est&&els.originUsage){els.originUsage.textContent=formatBytes(est.usage||0);els.originQuota.textContent=formatBytes(est.quota||0);els.originAvailable.textContent=formatBytes(Math.max(0,(est.quota||0)-(est.usage||0)));}if(runtime){const inventory=await runtime.listCachedModels();if(inventory){if(Number.isFinite(inventory.usageBytes))els.originUsage.textContent=formatBytes(inventory.usageBytes);if(Number.isFinite(inventory.quotaBytes))els.originQuota.textContent=formatBytes(inventory.quotaBytes);if(Number.isFinite(inventory.availableBytes))els.originAvailable.textContent=formatBytes(inventory.availableBytes);}}}catch(error){if(!silent)setError(`Storage check failed: ${error instanceof Error?error.message:String(error)}`);}}
async function clearCache(){setError('');if(!confirm('Remove RIVANI Music Private Browser AI model files cached by this browser? Future Private generation will need to download them again.'))return;try{const rt=await ensureRuntime();els.clearCache.disabled=true;els.clearCache.textContent='Clearing…';await rt.clearCache();await refreshStorage(true);}catch(error){setError(`Could not clear model cache: ${error instanceof Error?error.message:String(error)}`);}finally{els.clearCache.disabled=false;els.clearCache.textContent='Clear Music model cache';}}
function cancelGeneration(){try{cloudSubmission?.cancel?.();}catch{}try{abortController?.abort();}catch{}setError('Generation cancel requested.');}

els.prompt?.addEventListener('input',()=>{els.promptCount.textContent=`${els.prompt.value.length} / 1000`;});
document.querySelectorAll('input[name="songMode"]').forEach(input=>input.addEventListener('change',updateModeUI));
document.querySelectorAll('input[name="generationRoute"]').forEach(input=>input.addEventListener('change',updateRouteUI));
els.aiLyrics?.addEventListener('change',updateModeUI);els.audioQuality?.addEventListener('change',updateDownloadEstimate);els.plannerQuality?.addEventListener('change',updateDownloadEstimate);els.sampler?.addEventListener('change',updateModeUI);document.querySelectorAll('[data-preset]').forEach(btn=>btn.addEventListener('click',()=>applyPreset(btn.dataset.preset)));els.generate?.addEventListener('click',startGeneration);els.cancel?.addEventListener('click',cancelGeneration);els.refreshStorage?.addEventListener('click',()=>refreshStorage(false));els.clearCache?.addEventListener('click',clearCache);
window.addEventListener('online',updateDeviceInfo);window.addEventListener('offline',updateDeviceInfo);
window.addEventListener('beforeunload',()=>{try{cloudSubmission?.cancel?.();}catch{}abortController?.abort();try{runtime?.dispose?.();}catch{}if(workerBlobUrl)URL.revokeObjectURL(workerBlobUrl);if(languageWorkerBlobUrl)URL.revokeObjectURL(languageWorkerBlobUrl);});

updateModeUI();updateDownloadEstimate();updateRouteUI();refreshStorage(true);
})();
