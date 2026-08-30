// RIVANI AI Audio Repair frontend
// One-click AI-powered speech enhancement.

const $ = id => document.getElementById(id);

const input = $("audioFileInput");
const dropZone = $("audioDropZone");
const editor = $("audioEditor");
const chooseBtn = $("chooseAudioBtn");
const replaceBtn = $("replaceAudioBtn");
const scanBtn = $("scanAudioBtn");
const repairPanel = $("repairPanel");
const repairBtn = $("repairAudioBtn");
const processing = $("audioProcessing");
const result = $("audioResult");
const strength = $("repairStrength");
const strengthValue = $("repairStrengthValue");

const FREE_MAX_FILE_BYTES = 500 * 1024 * 1024;
const FREE_MAX_DURATION_SECONDS = 30 * 60;

const PRO_MAX_FILE_BYTES = 1024 * 1024 * 1024;
const PRO_DAILY_SECONDS = 5 * 60 * 60;
const PRO_USAGE_KEY = "rivani_pro_audio_usage_v1";

const FREE_DAILY_JOBS = 5;
const FREE_JOB_USAGE_KEY = "rivani_free_audio_jobs_v1";

const SUPPORTED_AUDIO_EXTENSIONS = /\.(wav|mp3|m4a|aac|ogg|flac|webm)$/i;
const FREE_MP3_BITRATE = 192;

let sourceFile=null;
let sourceBuffer=null;
let sourceUrl=null;
let repairedBlob=null;
let repairedUrl=null;
let analysis=null;
let worker=null;
let warmupStarted=false;
let modelReady=false;
let activeProvider="";
let studioFinish=true;
// Advanced noise assists are implemented but reserved for Pro in the UI.
let fanAssist=false;
let trafficAssist=false;
let clickRepair=false;

let finalEnhancedBuffer=null;
let selectedExportFormat="mp3";
let mp3BlobCache=null;

let currentAudioPlan="free";

// Temporary engineering mode while specialist features are being tested.
// Pro gating returns after A/B validation.
const audioTestingMode=true;
const dereverbLabMode=audioTestingMode;

let dereverbEnabled=true;
let dereverbStrength=.58;
let dereverbWorker=null;

let backgroundVoicesEnabled=false;
let musicControlEnabled=false;
let speakerMode="auto";
let musicRemoval=1.0;
let speakerWorker=null;
let musicWorker=null;
let sourceOrigin="upload";

let mediaRecorder=null;
let micStream=null;
let micChunks=[];
let micBytes=0;
let micStartedAt=0;
let micTimerHandle=null;
let micAudioContext=null;
let micAnalyser=null;
let micLevelRaf=0;

function normalizePlan(value){
  return String(value||"free").trim().toLowerCase();
}

function getAudioPlan(){
  return normalizePlan(window.RIVANI_LUKI_CONTEXT?.plan)==="pro" ? "pro" : "free";
}

function isProPlan(){
  return currentAudioPlan==="pro";
}

function todayKey(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function readFreeJobUsage(){
  try{
    const parsed=JSON.parse(localStorage.getItem(FREE_JOB_USAGE_KEY)||"{}");
    if(parsed.date!==todayKey())return {date:todayKey(),count:0};
    return {date:parsed.date,count:Math.max(0,Math.floor(Number(parsed.count)||0))};
  }catch{return {date:todayKey(),count:0};}
}

function writeFreeJobUsage(count){
  try{localStorage.setItem(FREE_JOB_USAGE_KEY,JSON.stringify({date:todayKey(),count:Math.max(0,Math.floor(Number(count)||0))}));}catch{}
  renderDailyJobUsage();
}
function recordCompletedAudioJob(){
  if(isProPlan())return;
  const u=readFreeJobUsage();
  writeFreeJobUsage(u.count+1);
}
function freeJobsRemaining(){return Math.max(0,FREE_DAILY_JOBS-readFreeJobUsage().count);}
function renderDailyJobUsage(){
  const el=$("dailyAudioUsage"); if(!el)return;
  if(isProPlan()){el.innerHTML="<b>PRO:</b> unlimited enhancement jobs · 5 h processing/day";return;}
  const u=readFreeJobUsage();
  el.innerHTML=audioTestingMode
    ? `<b>TEST MODE:</b> ${u.count} completed today · future Free limit ${FREE_DAILY_JOBS}/day is not enforced yet`
    : `<b>FREE TODAY:</b> ${Math.min(u.count,FREE_DAILY_JOBS)}/${FREE_DAILY_JOBS} enhancements used`;
}
function canStartAnotherFreeJob(){return isProPlan()||audioTestingMode||freeJobsRemaining()>0;}

function readProUsage(){
  try{
    const parsed=JSON.parse(localStorage.getItem(PRO_USAGE_KEY)||"{}");
    if(parsed.date!==todayKey())return {date:todayKey(),seconds:0};
    return {date:parsed.date,seconds:Math.max(0,Number(parsed.seconds)||0)};
  }catch{
    return {date:todayKey(),seconds:0};
  }
}

function writeProUsage(seconds){
  try{
    localStorage.setItem(PRO_USAGE_KEY,JSON.stringify({
      date:todayKey(),
      seconds:Math.max(0,Number(seconds)||0)
    }));
  }catch{}
  renderPlanAccess();
}

function recordProUsage(seconds){
  if(!isProPlan())return;
  const usage=readProUsage();
  writeProUsage(usage.seconds+Math.max(0,Number(seconds)||0));
}

function remainingProSeconds(){
  return Math.max(0,PRO_DAILY_SECONDS-readProUsage().seconds);
}

function formatPlanMinutes(seconds){
  const mins=Math.max(0,Math.round(seconds/60));
  if(mins<60)return `${mins} min`;
  const hours=Math.floor(mins/60);
  const rest=mins%60;
  return rest?`${hours} h ${rest} min`:`${hours} h`;
}


chooseBtn?.addEventListener("click",()=>input?.click());
replaceBtn?.addEventListener("click",()=>input?.click());

input?.addEventListener("change",e=>{
  const file=e.target.files?.[0];
  if(file){sourceOrigin="upload";loadAudioFile(file);}
});

["dragenter","dragover"].forEach(type=>dropZone?.addEventListener(type,e=>{
  e.preventDefault();
  dropZone.classList.add("dragging");
}));
["dragleave","drop"].forEach(type=>dropZone?.addEventListener(type,e=>{
  e.preventDefault();
  dropZone.classList.remove("dragging");
}));
dropZone?.addEventListener("drop",e=>{
  const file=[...(e.dataTransfer?.files||[])].find(f=>
    f.type.startsWith("audio/")||/\.(wav|mp3|m4a|aac|ogg|flac)$/i.test(f.name)
  );
  if(file){sourceOrigin="upload";loadAudioFile(file);}
});

const uploadSourceTab=$("uploadSourceTab");
const micSourceTab=$("micSourceTab");
uploadSourceTab?.addEventListener("click",()=>setAudioSourcePane("upload"));
micSourceTab?.addEventListener("click",()=>setAudioSourcePane("mic"));
$("startMicBtn")?.addEventListener("click",startMicrophoneRecording);
$("stopMicBtn")?.addEventListener("click",()=>stopMicrophoneRecording(true));
$("cancelMicBtn")?.addEventListener("click",()=>stopMicrophoneRecording(false));
function setAudioSourcePane(mode){
  const mic=mode==="mic";
  uploadSourceTab?.classList.toggle("active",!mic); micSourceTab?.classList.toggle("active",mic);
  uploadSourceTab?.setAttribute("aria-selected",String(!mic)); micSourceTab?.setAttribute("aria-selected",String(mic));
  $("uploadSourcePane")?.classList.toggle("hidden",mic); $("micSourcePane")?.classList.toggle("hidden",!mic);
}
function chooseRecorderMime(){
  for(const m of ["audio/webm;codecs=opus","audio/ogg;codecs=opus","audio/mp4","audio/webm"]){if(window.MediaRecorder?.isTypeSupported?.(m))return m;} return "";
}
function recordingExtension(m){return m.includes("ogg")?"ogg":m.includes("mp4")?"m4a":"webm";}
function getMicDurationLimit(){return isProPlan()?Math.max(1,Math.min(PRO_DAILY_SECONDS,remainingProSeconds())):FREE_MAX_DURATION_SECONDS;}
function getActiveFileByteLimit(){return isProPlan()?PRO_MAX_FILE_BYTES:FREE_MAX_FILE_BYTES;}
async function startMicrophoneRecording(){
  if(mediaRecorder?.state==="recording")return;
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){alert("Microphone recording is not supported by this browser.");return;}
  if(!canStartAnotherFreeJob()){alert(`Free plan supports ${FREE_DAILY_JOBS} audio enhancements per day.`);return;}
  try{
    micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:1}});
    micChunks=[]; micBytes=0;
    const mime=chooseRecorderMime();
    mediaRecorder=mime?new MediaRecorder(micStream,{mimeType:mime,audioBitsPerSecond:128000}):new MediaRecorder(micStream);
    mediaRecorder.addEventListener("dataavailable",e=>{
      if(!e.data?.size)return; micChunks.push(e.data); micBytes+=e.data.size;
      if(micBytes>getActiveFileByteLimit()&&mediaRecorder?.state==="recording"){mediaRecorder._rivaniUseRecording=true;$("micStatus").textContent="Recording reached the plan file-size limit. Finishing…";mediaRecorder.stop();}
    });
    mediaRecorder.addEventListener("stop",async()=>{
      const use=mediaRecorder?._rivaniUseRecording===true; const recordedMime=mediaRecorder?.mimeType||mime||"audio/webm";
      cleanupMicrophoneHardware();
      $("startMicBtn")?.classList.remove("hidden"); $("stopMicBtn")?.classList.add("hidden"); $("cancelMicBtn")?.classList.add("hidden"); $("micRecordOrb")?.classList.remove("recording");
      if(!use){micChunks=[];micBytes=0;$("micTimer").textContent="00:00";$("micStatus").textContent="Recording cancelled.";return;}
      const blob=new Blob(micChunks,{type:recordedMime});
      if(blob.size>getActiveFileByteLimit()){alert(isProPlan()?"The recording exceeded the 1 GB Pro file limit.":"The recording exceeded the 500 MB Free file limit.");return;}
      const stamp=new Date().toISOString().replace(/[:.]/g,"-");
      const file=new File([blob],`rivani-mic-${stamp}.${recordingExtension(recordedMime)}`,{type:recordedMime,lastModified:Date.now()});
      sourceOrigin="microphone"; $("micStatus").textContent="Recording captured. Preparing it for RIVANI…"; await loadAudioFile(file);
    },{once:true});
    micStartedAt=performance.now(); mediaRecorder.start(1000);
    $("startMicBtn")?.classList.add("hidden"); $("stopMicBtn")?.classList.remove("hidden"); $("cancelMicBtn")?.classList.remove("hidden"); $("micRecordOrb")?.classList.add("recording"); $("micStatus").textContent="Recording… speak naturally.";
    startMicTimer(); startMicMeter(micStream);
  }catch(err){cleanupMicrophoneHardware(); console.error(err); alert(err?.name==="NotAllowedError"?"Microphone permission was not granted.":"RIVANI could not start the microphone on this browser.");}
}
function stopMicrophoneRecording(use){
  if(!mediaRecorder||mediaRecorder.state!=="recording"){cleanupMicrophoneHardware();return;} mediaRecorder._rivaniUseRecording=Boolean(use); $("micStatus").textContent=use?"Finishing recording…":"Cancelling recording…"; mediaRecorder.stop();
}
function startMicTimer(){
  clearInterval(micTimerHandle); const limit=getMicDurationLimit();
  const update=()=>{const elapsed=Math.max(0,(performance.now()-micStartedAt)/1000);$("micTimer").textContent=formatTime(elapsed); if(elapsed>=limit&&mediaRecorder?.state==="recording"){mediaRecorder._rivaniUseRecording=true;$("micStatus").textContent="Plan recording-time limit reached. Finishing…";mediaRecorder.stop();}};
  update(); micTimerHandle=setInterval(update,250);
}
function startMicMeter(stream){
  try{micAudioContext=new (window.AudioContext||window.webkitAudioContext)();const src=micAudioContext.createMediaStreamSource(stream);micAnalyser=micAudioContext.createAnalyser();micAnalyser.fftSize=512;micAnalyser.smoothingTimeConstant=.78;src.connect(micAnalyser);const data=new Uint8Array(micAnalyser.frequencyBinCount);const draw=()=>{if(!micAnalyser)return;micAnalyser.getByteFrequencyData(data);let sum=0,stop=Math.min(data.length,110);for(let i=2;i<stop;i++)sum+=data[i];const pct=Math.max(4,Math.min(100,((sum/Math.max(1,stop-2))/105)*100));const fill=$("micLevelFill");if(fill)fill.style.width=`${pct}%`;micLevelRaf=requestAnimationFrame(draw);};draw();}catch{}
}
function cleanupMicrophoneHardware(){
  clearInterval(micTimerHandle);micTimerHandle=null;if(micLevelRaf)cancelAnimationFrame(micLevelRaf);micLevelRaf=0;try{micAnalyser?.disconnect?.();}catch{}micAnalyser=null;try{micAudioContext?.close?.();}catch{}micAudioContext=null;if(micStream){for(const t of micStream.getTracks())t.stop();}micStream=null;const fill=$("micLevelFill");if(fill)fill.style.width="4%";
}

strength?.addEventListener("input",()=>{
  strengthValue.textContent=`${strength.value}%`;
});

const studioFinishBtn = $("studioFinishToggle");
studioFinishBtn?.addEventListener("click",()=>{
  studioFinish=!studioFinish;
  studioFinishBtn.classList.toggle("active",studioFinish);
  studioFinishBtn.setAttribute("aria-pressed",String(studioFinish));
  const state=$("studioFinishState");
  if(state)state.textContent=studioFinish?"ON":"OFF";
});


document.querySelectorAll("[data-pro-preview]").forEach(btn=>{
  btn.addEventListener("click",()=>$("proPreviewModal")?.classList.remove("hidden"));
});

document.querySelectorAll("[data-pro-lock]").forEach(btn=>{
  btn.addEventListener("click",()=>{
    if(audioTestingMode && btn.dataset.proControl){
      toggleBuiltProControl(btn);
      return;
    }

    if(isProPlan() && btn.dataset.proControl){
      toggleBuiltProControl(btn);
      return;
    }

    openProMessage(
      `${btn.dataset.proLock || "This feature"} · Pro`,
      `${btn.dataset.proLock || "This feature"} is reserved for RIVANI Pro.`
    );
  });
});

document.querySelectorAll("[data-specialist-engine]").forEach(btn=>{
  btn.addEventListener("click",()=>{
    const feature=btn.dataset.specialistEngine||"Specialist AI";
    if(audioTestingMode){
      if(feature==="Background Voices"){backgroundVoicesEnabled=!backgroundVoicesEnabled;renderSpecialistControls();if(backgroundVoicesEnabled)warmupBackgroundVoices();return;}
      if(feature==="Music Control"){musicControlEnabled=!musicControlEnabled;renderSpecialistControls();if(musicControlEnabled)warmupMusicControl();return;}
      if(feature==="De-Reverb"){dereverbEnabled=!dereverbEnabled;renderSpecialistControls();return;}
    }
    openProMessage(`${feature} · Pro AI`,`${feature} is a specialist RIVANI audio feature.`);
  });
});

function openProMessage(titleText,copyText){
  const title=$("proPreviewTitle");
  const copy=$("proPreviewCopy");
  if(title)title.textContent=titleText;
  if(copy)copy.textContent=copyText;
  $("proPreviewModal")?.classList.remove("hidden");
}

function toggleBuiltProControl(btn){
  const key=btn.dataset.proControl;
  let active=false;

  if(key==="fan"){
    fanAssist=!fanAssist;
    active=fanAssist;
  }else if(key==="traffic"){
    trafficAssist=!trafficAssist;
    active=trafficAssist;
  }else if(key==="click"){
    clickRepair=!clickRepair;
    active=clickRepair;
  }

  btn.classList.toggle("enabled",active);
  btn.setAttribute("aria-pressed",String(active));
  const em=btn.querySelector("em");
  if(em)em.textContent=active?"ON":"OFF";
}

document.querySelectorAll("[data-close-pro]").forEach(btn=>{
  btn.addEventListener("click",()=>$("proPreviewModal")?.classList.add("hidden"));
});

$("speakerModeBtn")?.addEventListener("click",()=>{speakerMode=speakerMode==="auto"?"a":speakerMode==="a"?"b":"auto";renderSpecialistControls();});
$("musicRemoval")?.addEventListener("input",e=>{musicRemoval=Math.max(.60,Math.min(1,Number(e.target.value||100)/100));$("musicRemovalValue").textContent=`${Math.round(musicRemoval*100)}%`;});
function renderSpecialistControls(){
  const bg=$("backgroundVoicesBtn"), music=$("musicControlBtn"), de=$("dereverbSpecialistBtn");
  bg?.classList.toggle("lab-active",backgroundVoicesEnabled);music?.classList.toggle("lab-active",musicControlEnabled);de?.classList.toggle("lab-active",dereverbEnabled);
  bg?.setAttribute("aria-pressed",String(backgroundVoicesEnabled));music?.setAttribute("aria-pressed",String(musicControlEnabled));de?.setAttribute("aria-pressed",String(dereverbEnabled));
  const bs=$("backgroundVoicesState"), ms=$("musicControlState"), ds=$("dereverbSpecialistState");
  if(bs&&!bs.textContent.includes("PREPARING"))bs.textContent=backgroundVoicesEnabled?"BETA ON":"BETA OFF";
  if(ms&&!ms.textContent.includes("PREPARING"))ms.textContent=musicControlEnabled?"BETA ON":"BETA OFF";
  if(ds)ds.textContent=dereverbEnabled?"BETA ON":"BETA OFF";
  $("backgroundVoiceSettings")?.classList.toggle("hidden",!backgroundVoicesEnabled);$("musicControlSettings")?.classList.toggle("hidden",!musicControlEnabled);
  const sb=$("speakerModeBtn");if(sb)sb.textContent=speakerMode==="a"?"VOICE A":speakerMode==="b"?"VOICE B":"AUTO";
}


$("exportMp3Btn")?.addEventListener("click",()=>{
  selectedExportFormat="mp3";
  updateExportFormatUI();
});

$("exportWavBtn")?.addEventListener("click",()=>{
  if(isProPlan()){
    selectedExportFormat="wav";
    updateExportFormatUI();
    return;
  }

  openProMessage(
    "Lossless WAV Export · Pro",
    "Lossless WAV export is reserved for RIVANI Pro. Free includes high-quality 192 kbps MP3 export."
  );
});

function updateExportFormatUI(){
  const mp3=$("exportMp3Btn");
  const wav=$("exportWavBtn");

  mp3?.classList.toggle("active",selectedExportFormat==="mp3");
  wav?.classList.toggle("active",selectedExportFormat==="wav" && isProPlan());

  if(wav){
    wav.classList.toggle("locked",!isProPlan());
    const em=wav.querySelector("em");
    if(em)em.textContent=isProPlan()
      ? (selectedExportFormat==="wav"?"SELECTED":"PRO")
      : "PRO 🔒";
  }

  const label=$("downloadAudioBtn");
  if(label){
    label.textContent=
      selectedExportFormat==="wav" && isProPlan()
        ? "Download WAV ↓"
        : "Download MP3 ↓";
  }
}

function renderPlanAccess(){
  currentAudioPlan=getAudioPlan(); const pro=isProPlan();
  renderDailyJobUsage(); renderSpecialistControls();
  const labBanner=$("dereverbLabBanner");if(labBanner)labBanner.classList.toggle("hidden",!audioTestingMode);
  const de=$("dereverbSpecialistBtn");if(de)de.classList.add("lab-ready");
  const badge=$("proAudioBadge");
  if(audioTestingMode){
    if(badge)badge.textContent="● TESTING";
    document.querySelectorAll("[data-pro-control]").forEach(btn=>{btn.classList.add("pro-entitled","test-ready");const k=btn.dataset.proControl;const active=k==="fan"?fanAssist:k==="traffic"?trafficAssist:k==="click"?clickRepair:false;btn.classList.toggle("enabled",active);btn.setAttribute("aria-pressed",String(active));const em=btn.querySelector("em");if(em)em.textContent=active?"ON":"OFF";});
    $("proDailyUsage")?.classList.add("hidden");if(!pro&&selectedExportFormat==="wav")selectedExportFormat="mp3";updateExportFormatUI();return;
  }
  if(badge)badge.textContent=pro?"✓ PRO ACTIVE":"🔒 PRO";
  document.querySelectorAll("[data-pro-control]").forEach(btn=>{btn.classList.toggle("pro-entitled",pro);const em=btn.querySelector("em");if(!pro){btn.classList.remove("enabled");btn.setAttribute("aria-pressed","false");if(em)em.textContent="PRO 🔒";}else if(em&&!btn.classList.contains("enabled"))em.textContent="OFF";});
  const usage=$("proDailyUsage");if(usage)usage.classList.toggle("hidden",!pro);
  if(pro){const st=readProUsage();const used=Math.min(PRO_DAILY_SECONDS,st.seconds);const pct=Math.min(100,used/PRO_DAILY_SECONDS*100);if($("proUsageText"))$("proUsageText").textContent=`${formatPlanMinutes(used)} / 5 h`;if($("proUsageBar"))$("proUsageBar").style.width=`${pct}%`;}
  if(!pro&&selectedExportFormat==="wav")selectedExportFormat="mp3";updateExportFormatUI();
}

window.addEventListener("rivani:auth-context",renderPlanAccess);
setTimeout(renderPlanAccess,0);
setTimeout(renderPlanAccess,900);

scanBtn?.addEventListener("click",runScan);
repairBtn?.addEventListener("click",repairLocally);

$("tryAgainBtn")?.addEventListener("click",()=>{
  result.classList.add("hidden");
  repairPanel.classList.remove("hidden");
  repairPanel.scrollIntoView({behavior:"smooth",block:"center"});
});

$("anotherAudioBtn")?.addEventListener("click",startAnotherAudio);

function startAnotherAudio(){
  if(sourceUrl){
    try{URL.revokeObjectURL(sourceUrl);}catch{}
  }
  if(repairedUrl){
    try{URL.revokeObjectURL(repairedUrl);}catch{}
  }

  sourceFile=null;
  sourceBuffer=null;
  sourceUrl=null;
  sourceOrigin="upload";
  cleanupMicrophoneHardware();
  setAudioSourcePane("upload");
  repairedBlob=null;
  repairedUrl=null;
  finalEnhancedBuffer=null;
  mp3BlobCache=null;
  analysis=null;

  if(input)input.value="";

  editor.classList.add("hidden");
  repairPanel.classList.add("hidden");
  processing.classList.add("hidden");
  result.classList.add("hidden");
  dropZone.classList.remove("hidden");

  scanBtn.disabled=false;
  scanBtn.classList.remove("scan-complete-state");
  scanBtn.textContent="✦ Scan Audio";

  $("healthScore").textContent="--";
  $("healthLabel").textContent="Ready to scan";
  $("issueCount").textContent="0 found";

  renderPlanAccess();
  dropZone.scrollIntoView({behavior:"smooth",block:"center"});
}

$("downloadAudioBtn")?.addEventListener("click",async()=>{
  if(!finalEnhancedBuffer)return;

  const btn=$("downloadAudioBtn");
  const originalText=btn?.textContent||"Download MP3 ↓";

  try{
    const base=(sourceFile?.name||"rivani-audio").replace(/\.[^.]+$/,"");
    let downloadBlob;
    let downloadName;

    if(selectedExportFormat==="wav"){
      if(!isProPlan()){
        throw new Error("Lossless WAV export is available with Pro.");
      }
      if(!repairedBlob){
        throw new Error("The lossless result is not ready yet.");
      }

      if(btn){
        btn.disabled=true;
        btn.textContent="Preparing WAV…";
      }

      downloadBlob=repairedBlob;
      downloadName=`${base}-rivani-enhanced.wav`;
    }else{
      if(btn){
        btn.disabled=true;
        btn.textContent="Encoding MP3…";
      }

      if(!mp3BlobCache){
        mp3BlobCache=await encodeMp3(finalEnhancedBuffer,FREE_MP3_BITRATE);
      }

      downloadBlob=mp3BlobCache;
      downloadName=`${base}-rivani-enhanced.mp3`;
    }

    const url=URL.createObjectURL(downloadBlob);
    const a=document.createElement("a");

    a.href=url;
    a.download=downloadName;

    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }catch(error){
    alert(String(error?.message||error||"MP3 export could not finish."));
  }finally{
    if(btn){
      btn.disabled=false;
      btn.textContent=originalText;
      updateExportFormatUI();
    }
  }
});

function encodeMp3(buffer,bitrate=192){
  return new Promise((resolve,reject)=>{
    const channelCount=Math.min(2,Math.max(1,buffer.numberOfChannels));
    const channels=[];

    if(channelCount===1){
      const mono=new Float32Array(buffer.length);

      if(buffer.numberOfChannels===1){
        mono.set(buffer.getChannelData(0));
      }else{
        for(let c=0;c<buffer.numberOfChannels;c++){
          const d=buffer.getChannelData(c);
          for(let i=0;i<d.length;i++)mono[i]+=d[i]/buffer.numberOfChannels;
        }
      }

      channels.push(mono);
    }else{
      channels.push(new Float32Array(buffer.getChannelData(0)));
      channels.push(new Float32Array(buffer.getChannelData(1)));
    }

    const worker=new Worker("mp3-export-worker.js?v=22");
    const transfer=channels.map(ch=>ch.buffer);

    const timeout=setTimeout(()=>{
      worker.terminate();
      reject(new Error("MP3 export timed out."));
    },180000);

    worker.onmessage=event=>{
      const data=event.data||{};

      if(data.type==="error"){
        clearTimeout(timeout);
        worker.terminate();
        reject(new Error(data.message||"MP3 export failed."));
      }

      if(data.type==="done"){
        clearTimeout(timeout);
        worker.terminate();
        resolve(new Blob([data.buffer],{type:"audio/mpeg"}));
      }
    };

    worker.onerror=()=>{
      clearTimeout(timeout);
      worker.terminate();
      reject(new Error("MP3 encoder could not start."));
    };

    worker.postMessage({
      type:"encode",
      sampleRate:buffer.sampleRate,
      bitrate,
      channels:channelCount,
      channelBuffers:transfer
    },transfer);
  });
}

function isSupportedAudioFile(file){
  const name=String(file?.name||"");
  return SUPPORTED_AUDIO_EXTENSIONS.test(name);
}

async function loadAudioFile(file){
  try{
    chooseBtn.disabled=true;

    if(!isSupportedAudioFile(file)){
      throw new Error("Unsupported file type. Use WAV, MP3, M4A, AAC, OGG or FLAC, or record directly with the microphone.");
    }

    const maxBytes=isProPlan()?PRO_MAX_FILE_BYTES:FREE_MAX_FILE_BYTES;

    if(file.size>maxBytes){
      throw new Error(
        isProPlan()
          ? "RIVANI Pro supports files up to 1 GB."
          : "RIVANI Free supports files up to 500 MB. Pro supports up to 1 GB per file."
      );
    }

    sourceFile=file;
    const arr=await file.arrayBuffer();
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    sourceBuffer=await ctx.decodeAudioData(arr.slice(0));
    await ctx.close();

    if(!isProPlan() && sourceBuffer.duration>FREE_MAX_DURATION_SECONDS){
      throw new Error(
        "RIVANI Free supports audio up to 30 minutes per file. Pro uses a 5-hour daily processing allowance."
      );
    }

    if(isProPlan()){
      const remaining=remainingProSeconds();
      if(sourceBuffer.duration>remaining){
        throw new Error(
          `Your remaining Pro audio allowance today is ${formatPlanMinutes(remaining)}.`
        );
      }
    }

    if(sourceUrl)URL.revokeObjectURL(sourceUrl);
    sourceUrl=URL.createObjectURL(file);

    $("audioFileName").textContent=file.name;
    $("audioFileDetails").textContent=
      `${formatBytes(file.size)} · ${sourceBuffer.numberOfChannels===1?"Mono":`${sourceBuffer.numberOfChannels} channels`} · ${(sourceBuffer.sampleRate/1000).toFixed(1)} kHz`;
    $("audioDuration").textContent=formatTime(sourceBuffer.duration);
    $("beforePlayer").src=sourceUrl;

    drawWaveform(sourceBuffer,$("waveCanvas"));
    resetAnalysis();

    dropZone.classList.add("hidden");
    editor.classList.remove("hidden");
    editor.scrollIntoView({behavior:"smooth",block:"start"});

    // Automatic: no manual model download or installation for the user.
    warmupEngine();
  }catch(error){
    console.error(error);
    alert(String(error?.message||"This browser could not decode that audio file."));
  }finally{
    chooseBtn.disabled=false;
  }
}

function resetAnalysis(){
  analysis=null;
  $("healthScore").textContent="--";
  $("healthLabel").textContent="Ready to scan";
  $("healthSummary").textContent=
    "RIVANI will inspect clipping, recording level and background-noise indicators before AI enhancement.";
  $("issueCount").textContent="0 found";
  $("issueList").innerHTML='<div class="issue-empty">Run the audio scan to see findings.</div>';

  scanBtn.disabled=false;
  scanBtn.classList.remove("scan-complete-state");
  scanBtn.textContent="✦ Scan Audio";

  repairPanel.classList.add("hidden");
  result.classList.add("hidden");
}

async function runScan(){
  if(!sourceBuffer)return;

  scanBtn.disabled=true;
  scanBtn.textContent="Scanning…";
  await tick(70);

  analysis=analyzeBuffer(sourceBuffer);
  $("healthScore").textContent=analysis.score;
  $("healthLabel").textContent=
    analysis.score>=82?"Healthy recording":
    analysis.score>=65?"Light enhancement recommended":
    analysis.score>=45?"AI enhancement recommended":
    "Strong enhancement recommended";

  $("healthSummary").textContent=analysis.summary;
  $("issueCount").textContent=`${analysis.issues.length} found`;

  const list=$("issueList");
  list.innerHTML="";

  if(!analysis.issues.length){
    list.innerHTML='<div class="issue-empty good">No major technical fault detected. Clear Voice X can still improve speech focus.</div>';
  }else{
    for(const issue of analysis.issues){
      const el=document.createElement("div");
      el.className=`issue-row severity-${issue.severity}`;
      el.innerHTML=`<span class="issue-dot"></span><div><strong>${issue.name}</strong><small>${issue.detail}</small></div><b>${issue.label}</b>`;
      list.appendChild(el);
    }
  }

  repairPanel.classList.remove("hidden");
  scanBtn.innerHTML='<span class="scan-complete-check">✓</span> Scan Complete';
  scanBtn.disabled=true;
  scanBtn.classList.add("scan-complete-state");
  repairPanel.scrollIntoView({behavior:"smooth",block:"center"});
}

function getWorker(){
  if(worker)return worker;
  worker=new Worker("rivani-ai-worker.js?v=22",{type:"module"});

  worker.addEventListener("message",event=>{
    const d=event.data||{};
    const status=$("clearEngineStatus");

    if(d.type==="sourceFailed"){
      console.warn(d.text);
      if(status){
        status.textContent="AI engine connection interrupted · retrying…";
        status.classList.add("engine-error");
      }
    }

    if(d.type==="modelProgress"){
      if(status){
        status.textContent=d.cached
          ?"RIVANI AI Engine · Ready"
          :`RIVANI AI Engine · Preparing ${Math.round(d.progress||0)}%`;
        status.classList.remove("engine-error");
      }
    }

    if(d.type==="ready"){
      modelReady=true;
      activeProvider=d.provider||"";
      if(status){
        status.textContent="RIVANI AI Engine · Ready";
        status.classList.remove("engine-error");
      }
    }
  });

  return worker;
}

async function warmupEngine(){
  if(warmupStarted||modelReady)return;
  warmupStarted=true;

  const status=$("clearEngineStatus");
  if(status){
    status.textContent="RIVANI AI Engine · Loading…";
    status.classList.remove("engine-error");
  }

  const w=getWorker();

  const listener=event=>{
    const d=event.data||{};
    if(d.type==="ready"){
      modelReady=true;
      activeProvider=d.provider||"";
      warmupStarted=false;
      w.removeEventListener("message",listener);
    }
    if(d.type==="error"){
      warmupStarted=false;
      w.removeEventListener("message",listener);
      if(status){
        status.textContent="RIVANI AI Engine · Tap Enhance to retry";
        status.classList.add("engine-error");
      }
    }
  };

  w.addEventListener("message",listener);
  w.postMessage({type:"warmup"});
}

async function repairLocally(){
  if(!sourceBuffer)return;
  if(!canStartAnotherFreeJob()){alert(`Free plan supports ${FREE_DAILY_JOBS} audio enhancements per day.`);return;}

  if(isProPlan()){
    const remaining=remainingProSeconds();
    if(sourceBuffer.duration>remaining){
      openProMessage(
        "Daily Pro audio limit reached",
        `You have ${formatPlanMinutes(remaining)} of your 5-hour Pro processing allowance remaining today.`
      );
      return;
    }
  }

  repairBtn.disabled=true;
  repairPanel.classList.add("hidden");
  result.classList.add("hidden");
  processing.classList.remove("hidden");
  processing.scrollIntoView({behavior:"smooth",block:"center"});

  try{
    setStage("upload");
    updateProgress(3,"Preparing the recording locally. Your audio is not uploaded to a RIVANI GPU server…");

    const buffer48=await resampleAudioBuffer(sourceBuffer,48000);
    let mono=mixToMono(buffer48);
    const activeSpecialists=[musicControlEnabled?"music":null,backgroundVoicesEnabled?"voices":null,dereverbEnabled?"dereverb":null].filter(Boolean);
    const preStart=5,preEnd=48,slice=activeSpecialists.length?(preEnd-preStart)/activeSpecialists.length:0;let specialistIndex=0;
    if(musicControlEnabled){
      const a=preStart+slice*specialistIndex++,b=a+slice;setStage("model");updateProgress(Math.round(a),"Music Control Beta is separating voice from background music…");
      const b441=await resampleAudioBuffer(sourceBuffer,44100);const st=getStereoChannels(b441);
      const vocals=await runMusicControlBeta(st.left,st.right,musicRemoval,(p,t)=>updateProgress(Math.round(a+(b-a)*(Number(p||0)/100)),t));
      mono=resampleMonoLinear(vocals,44100,48000);updateProgress(Math.round(b),"Music separation ready.");
    }
    if(backgroundVoicesEnabled){
      const a=preStart+slice*specialistIndex++,b=a+slice;setStage("model");updateProgress(Math.round(a),"Background Voices Beta is separating overlapping speakers…");
      const mono16=resampleMonoLinear(mono,48000,16000);const sep=await runBackgroundVoicesBeta(mono16,speakerMode,(p,t)=>updateProgress(Math.round(a+(b-a)*(Number(p||0)/100)),t));
      mono=resampleMonoLinear(sep.audio,16000,48000);const state=$("backgroundVoicesState");if(state&&speakerMode==="auto")state.textContent=`BETA ON · ${sep.selected}`;updateProgress(Math.round(b),`${sep.selected} isolated.`);
    }
    if(dereverbEnabled){
      const a=preStart+slice*specialistIndex++,b=a+slice;setStage("model");updateProgress(Math.round(a),"De-Reverb Beta is analyzing room reflections…");
      mono=await runDereverbBeta(mono,dereverbStrength,(p,t)=>updateProgress(Math.round(a+(b-a)*(Number(p||0)/100)),t));updateProgress(Math.round(b),"Room-reflection cleanup ready.");
    }
    const clearStart=activeSpecialists.length?50:8;setStage("model");updateProgress(clearStart,"Starting RIVANI AI Clear Voice…");
    const enhanced=await runMossFormer(mono,Number(strength.value)/100,(p,text,providerName)=>{activeProvider=providerName||activeProvider;const mapped=clearStart+Math.round(Number(p||0)*((80-clearStart)/100));updateProgress(Math.min(80,mapped),text);});

    setStage("restore");
    updateProgress(82,"Applying transparent voice finishing—no dry/wet neural blend…");

    let repaired48=rebuildFromMono(buffer48,enhanced);

    if(clickRepair){
      updateProgress(82,"Repairing isolated clicks and impulse spikes…");
      repairClicksInPlace(repaired48);
    }

    if(fanAssist || trafficAssist){
      updateProgress(83,"Applying selected advanced cleanup…");
      repaired48=await applyAdvancedCleanup(repaired48,{
        fanAssist,
        trafficAssist
      });
    }

    if(studioFinish){
      updateProgress(84,"Applying Studio Finish for smoother, more balanced voice…");
      repaired48=await applyStudioFinish(repaired48);
    }else{
      updateProgress(84,"Keeping the AI-enhanced voice natural…");
      repaired48=await applyNaturalFinish(repaired48);
    }

    setStage("level");
    updateProgress(91,"Balancing voice loudness and protecting peaks…");
    levelVoiceRms(repaired48,studioFinish?-18.0:-18.5,-1.2);

    let finalBuffer=repaired48;
    if(sourceBuffer.sampleRate!==48000){
      finalBuffer=await resampleAudioBuffer(repaired48,sourceBuffer.sampleRate);
    }

    finalEnhancedBuffer=finalBuffer;
    mp3BlobCache=null;

    setStage("export");
    updateProgress(97,"Checking enhanced output and encoding WAV…");

    validateEnhancedOutput(sourceBuffer, finalBuffer);

    const wav=encodeWav(finalBuffer);
    repairedBlob=new Blob([wav],{type:"audio/wav"});

    if(repairedUrl)URL.revokeObjectURL(repairedUrl);
    repairedUrl=URL.createObjectURL(repairedBlob);

    $("afterPlayer").src=repairedUrl;
    const specialistLabels=[];if(musicControlEnabled)specialistLabels.push("Music Control");if(backgroundVoicesEnabled)specialistLabels.push("Background Voices");if(dereverbEnabled)specialistLabels.push("De-Reverb");
    $("afterPresetLabel").textContent=`AI Clear Voice · ${strength.value}% · ${studioFinish?"Studio":"Natural"} Finish`+(specialistLabels.length?` · ${specialistLabels.join(" + ")}`:"");

    const status=$("clearEngineStatus");
    if(status){
      status.textContent="RIVANI AI Engine · Ready";
      status.classList.remove("engine-error");
    }

    updateProgress(100,"AI Clear Voice complete.");
    await tick(240);

    processing.classList.add("hidden");
    result.classList.remove("hidden");

    recordProUsage(sourceBuffer.duration);
    recordCompletedAudioJob();
    renderPlanAccess();

    result.scrollIntoView({behavior:"smooth",block:"start"});
  }catch(error){
    console.error(error);
    processing.classList.add("hidden");
    repairPanel.classList.remove("hidden");

    const status=$("clearEngineStatus");
    if(status){
      status.textContent="RIVANI AI Engine · Could not start";
      status.classList.add("engine-error");
    }

    const detail=String(error?.message||error||"").slice(0,220);
    const activeNames=[];if(musicControlEnabled)activeNames.push("Music Control");if(backgroundVoicesEnabled)activeNames.push("Background Voices");if(dereverbEnabled)activeNames.push("De-Reverb");activeNames.push("Clear Voice");
    alert(`${activeNames.join(" / ")} could not finish. ${detail}\n\n`+`No fake fallback was generated. If a specialist model route says unavailable, deploy the included V22 rivani-models Worker update and retry.`);
  }finally{
    repairBtn.disabled=false;
  }
}

function getDereverbWorker(){
  if(dereverbWorker)return dereverbWorker;

  dereverbWorker=new Worker("dereverb-worker.js?v=22");
  return dereverbWorker;
}

async function runDereverbBeta(mono,strength,onProgress){
  const w=getDereverbWorker();
  const copy=new Float32Array(mono);

  return await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{
      w.removeEventListener("message",listener);
      reject(new Error("De-Reverb Beta timed out."));
    },180000);

    const listener=event=>{
      const d=event.data||{};

      if(d.type==="phase" || d.type==="progress"){
        onProgress?.(
          Number(d.progress||0),
          d.text||"Reducing room reflections…"
        );
        return;
      }

      if(d.type==="error"){
        clearTimeout(timeout);
        w.removeEventListener("message",listener);
        reject(new Error(d.message||"De-Reverb Beta failed."));
        return;
      }

      if(d.type==="done"){
        clearTimeout(timeout);
        w.removeEventListener("message",listener);
        resolve(new Float32Array(d.buffer));
      }
    };

    w.addEventListener("message",listener);

    w.postMessage({
      type:"process",
      strength,
      buffer:copy.buffer
    },[copy.buffer]);
  });
}

function getStereoChannels(buffer){
  if(buffer.numberOfChannels===1){const m=new Float32Array(buffer.getChannelData(0));return {left:m,right:new Float32Array(m)};}
  return {left:new Float32Array(buffer.getChannelData(0)),right:new Float32Array(buffer.getChannelData(1))};
}
function resampleMonoLinear(input,fromRate,toRate){
  if(fromRate===toRate)return new Float32Array(input);if(!input.length)return new Float32Array();const len=Math.max(1,Math.round(input.length*toRate/fromRate)),out=new Float32Array(len),ratio=fromRate/toRate;for(let i=0;i<len;i++){const pos=i*ratio,a=Math.floor(pos),b=Math.min(input.length-1,a+1),t=pos-a;out[i]=(input[a]||0)*(1-t)+(input[b]||0)*t;}return out;
}
function getSpeakerWorker(){if(!speakerWorker)speakerWorker=new Worker("speaker-separation-worker.js?v=22",{type:"module"});return speakerWorker;}
function getMusicWorker(){if(!musicWorker)musicWorker=new Worker("music-separation-worker.js?v=22",{type:"module"});return musicWorker;}
function warmupBackgroundVoices(){const state=$("backgroundVoicesState"),w=getSpeakerWorker();if(state)state.textContent="PREPARING…";const listener=e=>{const d=e.data||{};if(d.type==="ready"||d.type==="error"){w.removeEventListener("message",listener);if(state)state.textContent=d.type==="ready"?(backgroundVoicesEnabled?"BETA ON":"BETA OFF"):"RETRY";}};w.addEventListener("message",listener);w.postMessage({type:"warmup"});}
function warmupMusicControl(){const state=$("musicControlState"),w=getMusicWorker();if(state)state.textContent="PREPARING…";const listener=e=>{const d=e.data||{};if(d.type==="ready"||d.type==="error"){w.removeEventListener("message",listener);if(state)state.textContent=d.type==="ready"?(musicControlEnabled?"BETA ON":"BETA OFF"):"RETRY";}};w.addEventListener("message",listener);w.postMessage({type:"warmup"});}
async function runBackgroundVoicesBeta(mono16,mode,onProgress){const w=getSpeakerWorker(),copy=new Float32Array(mono16);return await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{w.removeEventListener("message",listener);reject(new Error("Background Voices Beta timed out."));},360000);const listener=e=>{const d=e.data||{};if(d.type==="modelProgress"||d.type==="progress"){onProgress?.(Number(d.progress||0),d.text||"Separating speakers…");return;}if(d.type==="error"){clearTimeout(timeout);w.removeEventListener("message",listener);reject(new Error(d.message||"Background Voices Beta failed."));return;}if(d.type==="done"){clearTimeout(timeout);w.removeEventListener("message",listener);resolve({audio:new Float32Array(d.buffer),selected:d.selected||"VOICE A",energyA:Number(d.energyA||0),energyB:Number(d.energyB||0)});}};w.addEventListener("message",listener);w.postMessage({type:"process",mode,buffer:copy.buffer},[copy.buffer]);});}
async function runMusicControlBeta(left,right,amount,onProgress){const w=getMusicWorker(),l=new Float32Array(left),r=new Float32Array(right);return await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{w.removeEventListener("message",listener);reject(new Error("Music Control Beta timed out."));},360000);const listener=e=>{const d=e.data||{};if(d.type==="modelProgress"||d.type==="progress"){onProgress?.(Number(d.progress||0),d.text||"Separating music…");return;}if(d.type==="error"){clearTimeout(timeout);w.removeEventListener("message",listener);reject(new Error(d.message||"Music Control Beta failed."));return;}if(d.type==="done"){clearTimeout(timeout);w.removeEventListener("message",listener);resolve(new Float32Array(d.buffer));}};w.addEventListener("message",listener);w.postMessage({type:"process",amount:Math.max(.60,Math.min(1,Number(amount)||1)),left:l.buffer,right:r.buffer},[l.buffer,r.buffer]);});}

async function runMossFormer(mono,strength,onProgress){
  const w=getWorker();
  const copy=new Float32Array(mono);

  return await new Promise((resolve,reject)=>{
    const listener=event=>{
      const d=event.data||{};

      if(d.type==="modelProgress"){
        onProgress?.(
          Math.min(15,Number(d.progress||0)*.15),
          d.text||"Preparing RIVANI AI Engine…",
          d.provider
        );
        return;
      }

      if(d.type==="phase"){
        onProgress?.(18,d.text||"Running RIVANI AI enhancement…",d.provider);
        return;
      }

      if(d.type==="segmentProgress"){
        const p=20+(Number(d.progress||0)*.80);
        onProgress?.(p,d.text||"Enhancing speech…",d.provider);
        return;
      }

      if(d.type==="error"){
        w.removeEventListener("message",listener);
        reject(new Error(d.message||"RIVANI AI enhancement failed."));
        return;
      }

      if(d.type==="done"){
        w.removeEventListener("message",listener);
        activeProvider=d.provider||activeProvider;
        resolve(new Float32Array(d.buffer));
      }
    };

    w.addEventListener("message",listener);
    w.postMessage({
      type:"process",
      strength,
      fanAssist,
      trafficAssist,
      buffer:copy.buffer
    },[copy.buffer]);
  });
}

async function applyAdvancedCleanup(buffer,opts){
  const offline=new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  const src=offline.createBufferSource();
  src.buffer=buffer;
  let node=src;

  if(opts.fanAssist){
    const mains=detectMainsHum(buffer);

    // Auto-selected 50/60 Hz family + restrained harmonics.
    for(const hz of [mains,mains*2,mains*3,mains*4]){
      if(hz>=buffer.sampleRate/2-100)continue;

      const notch=offline.createBiquadFilter();
      notch.type="notch";
      notch.frequency.value=hz;
      notch.Q.value=18;

      node.connect(notch);
      node=notch;
    }

    // Steady fan/AC beds often occupy broad low/mid energy too.
    const fanLow=offline.createBiquadFilter();
    fanLow.type="peaking";
    fanLow.frequency.value=180;
    fanLow.Q.value=.65;
    fanLow.gain.value=-.75;
    node.connect(fanLow);
    node=fanLow;

    const fanMid=offline.createBiquadFilter();
    fanMid.type="peaking";
    fanMid.frequency.value=620;
    fanMid.Q.value=.75;
    fanMid.gain.value=-.35;
    node.connect(fanMid);
    node=fanMid;
  }

  if(opts.trafficAssist){
    // Deliberately mild because traffic overlaps male voice fundamentals/body.
    const hp=offline.createBiquadFilter();
    hp.type="highpass";
    hp.frequency.value=78;
    hp.Q.value=.58;
    node.connect(hp);
    node=hp;

    const road=offline.createBiquadFilter();
    road.type="peaking";
    road.frequency.value=310;
    road.Q.value=.62;
    road.gain.value=-.65;
    node.connect(road);
    node=road;
  }

  node.connect(offline.destination);
  src.start();
  return await offline.startRendering();
}

function detectMainsHum(buffer){
  const mono=mixToMono(buffer);
  const sr=buffer.sampleRate;
  const max=Math.min(mono.length,Math.floor(sr*20));

  const e50=
    goertzelPower(mono,max,sr,50) +
    .55*goertzelPower(mono,max,sr,100) +
    .35*goertzelPower(mono,max,sr,150);

  const e60=
    goertzelPower(mono,max,sr,60) +
    .55*goertzelPower(mono,max,sr,120) +
    .35*goertzelPower(mono,max,sr,180);

  return e60>e50?60:50;
}

function goertzelPower(data,length,sr,freq){
  const omega=2*Math.PI*freq/sr;
  const coeff=2*Math.cos(omega);
  let s0=0,s1=0,s2=0;

  const stride=Math.max(1,Math.floor(length/240000));

  for(let i=0;i<length;i+=stride){
    s0=data[i]+coeff*s1-s2;
    s2=s1;
    s1=s0;
  }

  return Math.max(0,s1*s1+s2*s2-coeff*s1*s2);
}

function repairClicksInPlace(buffer){
  // Real impulse repair: only isolated waveform jumps far larger than the
  // immediate neighborhood are interpolated. Normal speech attacks remain.
  for(let c=0;c<buffer.numberOfChannels;c++){
    const d=buffer.getChannelData(c);
    if(d.length<16)continue;

    for(let i=4;i<d.length-4;i++){
      const prev=
        Math.abs(d[i-1]-d[i-2])+
        Math.abs(d[i-2]-d[i-3]);

      const next=
        Math.abs(d[i+2]-d[i+1])+
        Math.abs(d[i+3]-d[i+2]);

      const local=(prev+next)*.25+1e-6;

      const jumpIn=Math.abs(d[i]-d[i-1]);
      const jumpOut=Math.abs(d[i+1]-d[i]);

      if(
        jumpIn>.10 &&
        jumpOut>.10 &&
        jumpIn>local*8 &&
        jumpOut>local*8
      ){
        const left=d[i-2];
        const right=d[i+2];

        d[i-1]=left+(right-left)*.25;
        d[i]=left+(right-left)*.50;
        d[i+1]=left+(right-left)*.75;

        i+=2;
      }
    }
  }
}

async function applyNaturalFinish(buffer){
  const offline=new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  const src=offline.createBufferSource();
  src.buffer=buffer;

  const hp=offline.createBiquadFilter();
  hp.type="highpass";
  hp.frequency.value=62;
  hp.Q.value=.58;

  const comp=offline.createDynamicsCompressor();
  comp.threshold.value=-12;
  comp.knee.value=26;
  comp.ratio.value=1.15;
  comp.attack.value=.024;
  comp.release.value=.36;

  src.connect(hp).connect(comp).connect(offline.destination);
  src.start();
  return await offline.startRendering();
}

async function applyStudioFinish(buffer){
  const profile=measureToneProfile(buffer);

  // All adjustments are deliberately small. The AI engine remains responsible
  // for restoration; Studio Finish only presents the already-good voice.
  const mudGain = clamp(
    profile.lowMidRatio > .54 ? -1.05 :
    profile.lowMidRatio > .45 ? -.65 : -.25,
    -1.2,0
  );

  const presenceGain = clamp(
    profile.presenceRatio < .075 ? .70 :
    profile.presenceRatio < .105 ? .42 :
    profile.presenceRatio > .18 ? -.20 : .18,
    -.3,.8
  );

  const deEssGain = clamp(
    profile.sibilanceRatio > .115 ? -1.15 :
    profile.sibilanceRatio > .085 ? -.70 :
    profile.sibilanceRatio > .060 ? -.35 : -.10,
    -1.25,0
  );

  const offline=new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  const src=offline.createBufferSource();
  src.buffer=buffer;

  const hp=offline.createBiquadFilter();
  hp.type="highpass";
  hp.frequency.value=68;
  hp.Q.value=.62;

  const mud=offline.createBiquadFilter();
  mud.type="peaking";
  mud.frequency.value=245;
  mud.Q.value=.82;
  mud.gain.value=mudGain;

  const body=offline.createBiquadFilter();
  body.type="peaking";
  body.frequency.value=145;
  body.Q.value=.72;
  body.gain.value=profile.bodyRatio<.18?.45:.12;

  const presence=offline.createBiquadFilter();
  presence.type="peaking";
  presence.frequency.value=2900;
  presence.Q.value=.78;
  presence.gain.value=presenceGain;

  const deess=offline.createBiquadFilter();
  deess.type="highshelf";
  deess.frequency.value=6200;
  // V17.1: keep a small negative ceiling so Studio Finish never boosts the
  // high-frequency tail/noise bed after AI cleanup.
  deess.gain.value=Math.min(-0.12,deEssGain);

  const comp=offline.createDynamicsCompressor();
  comp.threshold.value=-15;
  comp.knee.value=26;
  comp.ratio.value=1.28;
  comp.attack.value=.022;
  comp.release.value=.34;

  src
    .connect(hp)
    .connect(mud)
    .connect(body)
    .connect(presence)
    .connect(deess)
    .connect(comp)
    .connect(offline.destination);

  src.start();
  return await offline.startRendering();
}

function measureToneProfile(buffer){
  const mono=mixToMono(buffer);
  const sr=buffer.sampleRate;
  const fftSize=2048;
  const hop=Math.max(fftSize,Math.floor(sr*.18));
  const maxSamples=Math.min(mono.length,Math.floor(sr*45));
  const win=new Float64Array(fftSize);

  for(let i=0;i<fftSize;i++){
    win[i]=.5-.5*Math.cos(2*Math.PI*i/(fftSize-1));
  }

  let low=0,body=0,lowMid=0,presence=0,sibilance=0,total=0,frames=0;

  for(let start=0;start+fftSize<=maxSamples;start+=hop){
    const re=new Float64Array(fftSize);
    const im=new Float64Array(fftSize);
    let rms=0;

    for(let i=0;i<fftSize;i++){
      const v=mono[start+i];
      rms+=v*v;
      re[i]=v*win[i];
    }

    rms=Math.sqrt(rms/fftSize);
    if(rms<.006)continue;

    fftRadix2Local(re,im);

    for(let k=1;k<fftSize/2;k++){
      const hz=k*sr/fftSize;
      const p=re[k]*re[k]+im[k]*im[k];
      total+=p;

      if(hz>=70&&hz<180)low+=p;
      if(hz>=180&&hz<500){body+=p;lowMid+=p;}
      if(hz>=500&&hz<1100)lowMid+=p;
      if(hz>=2200&&hz<4500)presence+=p;
      if(hz>=5500&&hz<10000)sibilance+=p;
    }
    frames++;
  }

  total=Math.max(1e-12,total);
  return {
    lowRatio:low/total,
    bodyRatio:body/total,
    lowMidRatio:lowMid/total,
    presenceRatio:presence/total,
    sibilanceRatio:sibilance/total,
    frames
  };
}

function fftRadix2Local(re,im){
  const n=re.length;

  for(let i=1,j=0;i<n;i++){
    let bit=n>>1;
    for(;j&bit;bit>>=1)j^=bit;
    j^=bit;
    if(i<j){
      let tr=re[i];re[i]=re[j];re[j]=tr;
      let ti=im[i];im[i]=im[j];im[j]=ti;
    }
  }

  for(let len=2;len<=n;len<<=1){
    const angle=-2*Math.PI/len;
    const wrStep=Math.cos(angle),wiStep=Math.sin(angle);

    for(let i=0;i<n;i+=len){
      let wr=1,wi=0;
      const half=len>>1;

      for(let j=0;j<half;j++){
        const ur=re[i+j],ui=im[i+j];
        const vr=re[i+j+half]*wr-im[i+j+half]*wi;
        const vi=re[i+j+half]*wi+im[i+j+half]*wr;

        re[i+j]=ur+vr;
        im[i+j]=ui+vi;
        re[i+j+half]=ur-vr;
        im[i+j+half]=ui-vi;

        const nwr=wr*wrStep-wi*wiStep;
        wi=wr*wiStep+wi*wrStep;
        wr=nwr;
      }
    }
  }
}

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}

function levelVoiceRms(buffer,targetDb=-17,peakCeilingDb=-1.2){
  let sum=0,n=0;

  for(let c=0;c<buffer.numberOfChannels;c++){
    const d=buffer.getChannelData(c);
    for(let i=0;i<d.length;i+=2){
      const a=Math.abs(d[i]);
      if(a>.006){
        sum+=d[i]*d[i];
        n++;
      }
    }
  }

  if(!n)return;

  const rms=Math.sqrt(sum/n);
  const measured=20*Math.log10(Math.max(1e-9,rms));
  let gainDb=Math.max(-4,Math.min(4,targetDb-measured));
  let gain=Math.pow(10,gainDb/20);

  let peak=0;
  for(let c=0;c<buffer.numberOfChannels;c++){
    const d=buffer.getChannelData(c);
    for(let i=0;i<d.length;i++)peak=Math.max(peak,Math.abs(d[i]));
  }

  const ceiling=Math.pow(10,peakCeilingDb/20);
  if(peak*gain>ceiling)gain=ceiling/Math.max(1e-9,peak);

  const fade=Math.min(Math.floor(buffer.sampleRate*.012),Math.floor(buffer.length/4));

  for(let c=0;c<buffer.numberOfChannels;c++){
    const d=buffer.getChannelData(c);

    for(let i=0;i<d.length;i++){
      let edge=1;
      if(fade&&i<fade)edge=.5-.5*Math.cos(Math.PI*i/fade);
      else if(fade&&i>=d.length-fade){
        const j=d.length-1-i;
        edge=.5-.5*Math.cos(Math.PI*Math.max(0,j)/fade);
      }

      d[i]=Math.max(-.999,Math.min(.999,d[i]*gain*edge));
    }
  }
}

function analyzeBuffer(buffer){
  const mono=mixToMono(buffer);
  const sr=buffer.sampleRate;
  const maxSamples=Math.min(mono.length,sr*120);
  const stride=Math.max(1,Math.floor(maxSamples/450000));

  let peak=0,sumSq=0,count=0,clipped=0;
  const frameSize=Math.max(128,Math.floor(sr*.02));
  const frames=[];

  for(let start=0;start<maxSamples;start+=frameSize){
    let fsq=0,fn=0;
    for(let i=start;i<Math.min(start+frameSize,maxSamples);i+=stride){
      const x=mono[i],ax=Math.abs(x);
      peak=Math.max(peak,ax);
      sumSq+=x*x;
      if(ax>=.985)clipped++;
      fsq+=x*x;fn++;count++;
    }
    if(fn)frames.push(Math.sqrt(fsq/fn));
  }

  const rms=Math.sqrt(sumSq/Math.max(1,count));
  const rmsDb=toDb(rms);
  const peakDb=toDb(peak);
  const clipPct=clipped/Math.max(1,count)*100;
  const sorted=[...frames].sort((a,b)=>a-b);
  const floor=sorted[Math.floor(sorted.length*.2)]||0;
  const floorDb=toDb(floor);
  const crest=peakDb-rmsDb;

  const issues=[];
  let penalty=0;

  if(clipPct>.08){
    const high=clipPct>1;
    issues.push({
      name:"Clipping / overload",
      detail:`About ${clipPct.toFixed(2)}% of sampled peaks are near maximum.`,
      severity:high?"high":"medium",
      label:high?"High":"Medium"
    });
    penalty+=high?22:12;
  }

  if(rmsDb<-28){
    const high=rmsDb<-36;
    issues.push({
      name:"Voice level is low",
      detail:`Average level is approximately ${rmsDb.toFixed(1)} dBFS.`,
      severity:high?"high":"medium",
      label:high?"High":"Medium"
    });
    penalty+=high?16:9;
  }

  if(floorDb>-38&&crest<19){
    const high=floorDb>-30;
    issues.push({
      name:"Background noise floor",
      detail:`Quiet sections remain around ${floorDb.toFixed(1)} dBFS.`,
      severity:high?"high":"medium",
      label:high?"High":"Medium"
    });
    penalty+=high?20:12;
  }

  const score=Math.max(20,Math.min(98,Math.round(94-penalty)));
  const summary=issues.length
    ? `${issues.length} issue${issues.length===1?"":"s"} detected. RIVANI AI will use one focused enhancement path instead of stacking aggressive filters.`
    : "No major technical fault detected. Clear Voice X will keep the processing path restrained.";

  return {score,issues,rmsDb,peakDb,floorDb,clipPct};
}

function drawWaveform(buffer,canvas){
  if(!canvas)return;
  const ctx=canvas.getContext("2d");
  const dpr=Math.min(2,window.devicePixelRatio||1);
  const cssW=canvas.clientWidth||700,cssH=canvas.clientHeight||220;
  canvas.width=Math.floor(cssW*dpr);
  canvas.height=Math.floor(cssH*dpr);
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,cssW,cssH);

  const grad=ctx.createLinearGradient(0,0,cssW,0);
  grad.addColorStop(0,"#12c9ff");
  grad.addColorStop(.5,"#4f7dff");
  grad.addColorStop(1,"#b52cff");
  ctx.strokeStyle=grad;
  ctx.lineWidth=1.6;
  ctx.globalAlpha=.9;

  const mono=mixToMono(buffer),mid=cssH/2;
  const step=Math.max(1,Math.floor(mono.length/cssW));
  ctx.beginPath();

  for(let x=0;x<cssW;x++){
    let min=1,max=-1;
    const start=x*step;

    for(let i=start;i<Math.min(start+step,mono.length);i++){
      const v=mono[i];
      if(v<min)min=v;
      if(v>max)max=v;
    }

    ctx.moveTo(x,mid+min*mid*.82);
    ctx.lineTo(x,mid+max*mid*.82);
  }
  ctx.stroke();
}

function mixToMono(buffer){
  const mono=new Float32Array(buffer.length);
  for(let c=0;c<buffer.numberOfChannels;c++){
    const d=buffer.getChannelData(c);
    for(let i=0;i<d.length;i++)mono[i]+=d[i]/buffer.numberOfChannels;
  }
  return mono;
}

function rebuildFromMono(reference,monoInput){
  const mono=ensureLength(monoInput,reference.length);
  const out=new AudioBuffer({
    length:reference.length,
    numberOfChannels:reference.numberOfChannels,
    sampleRate:reference.sampleRate
  });

  if(reference.numberOfChannels===1){
    out.copyToChannel(mono,0);
    return out;
  }

  const L=reference.getChannelData(0);
  const R=reference.getChannelData(1);
  const oL=out.getChannelData(0);
  const oR=out.getChannelData(1);

  for(let i=0;i<mono.length;i++){
    const side=(L[i]-R[i])*.025;
    oL[i]=Math.max(-1,Math.min(1,mono[i]+side));
    oR[i]=Math.max(-1,Math.min(1,mono[i]-side));
  }

  for(let c=2;c<reference.numberOfChannels;c++)out.copyToChannel(mono,c);
  return out;
}

async function resampleAudioBuffer(buffer,targetSampleRate){
  if(buffer.sampleRate===targetSampleRate)return buffer;
  const length=Math.max(1,Math.ceil(buffer.duration*targetSampleRate));
  const offline=new OfflineAudioContext(buffer.numberOfChannels,length,targetSampleRate);
  const src=offline.createBufferSource();
  src.buffer=buffer;
  src.connect(offline.destination);
  src.start();
  return await offline.startRendering();
}

function validateEnhancedOutput(original, enhanced) {
  // Catch an accidental original-file export / stale result before the user
  // downloads it. Compare a sparse mono sample at a common length.
  const a=mixToMono(original);
  const b=mixToMono(enhanced);
  const n=Math.min(a.length,b.length);

  if(n<1000)return;

  const step=Math.max(1,Math.floor(n/120000));
  let diff=0,energy=0,count=0;

  for(let i=0;i<n;i+=step){
    const d=a[i]-b[i];
    diff+=d*d;
    energy+=a[i]*a[i];
    count++;
  }

  const nrms=Math.sqrt(diff/Math.max(1,count)) /
    Math.max(1e-7,Math.sqrt(energy/Math.max(1,count)));

  // After AI enhancement + finishing + resampling, an exact or near-exact
  // result indicates a stale/original export path rather than a real repair.
  if(nrms < 0.00005){
    throw new Error(
      "Enhanced output is unexpectedly identical to the original. " +
      "RIVANI stopped the export instead of giving you a fake processed file. " +
      "Hard refresh the page and retry."
    );
  }
}

function encodeWav(buffer){
  const channels=buffer.numberOfChannels;
  const sampleRate=buffer.sampleRate;
  const length=buffer.length;
  const bytesPerSample=2;
  const blockAlign=channels*bytesPerSample;
  const out=new ArrayBuffer(44+length*blockAlign);
  const view=new DataView(out);
  let o=0;

  const write=s=>{for(let i=0;i<s.length;i++)view.setUint8(o++,s.charCodeAt(i));};
  write("RIFF");
  view.setUint32(o,36+length*blockAlign,true);o+=4;
  write("WAVE");write("fmt ");
  view.setUint32(o,16,true);o+=4;
  view.setUint16(o,1,true);o+=2;
  view.setUint16(o,channels,true);o+=2;
  view.setUint32(o,sampleRate,true);o+=4;
  view.setUint32(o,sampleRate*blockAlign,true);o+=4;
  view.setUint16(o,blockAlign,true);o+=2;
  view.setUint16(o,16,true);o+=2;
  write("data");
  view.setUint32(o,length*blockAlign,true);o+=4;

  const data=Array.from({length:channels},(_,c)=>buffer.getChannelData(c));
  for(let i=0;i<length;i++){
    for(let c=0;c<channels;c++){
      const s=Math.max(-1,Math.min(1,data[c][i]));
      view.setInt16(o,s<0?s*0x8000:s*0x7fff,true);
      o+=2;
    }
  }

  return out;
}

function ensureLength(value,length){
  const src=value instanceof Float32Array?value:new Float32Array(value||0);
  if(src.length===length)return src;
  const out=new Float32Array(length);
  out.set(src.subarray(0,Math.min(length,src.length)));
  return out;
}

function setStage(stage){
  const order=["upload","model","restore","level","export"];
  const current=Math.max(0,order.indexOf(stage));

  document.querySelectorAll("#processingStages [data-stage]").forEach(el=>{
    const idx=order.indexOf(el.dataset.stage);
    el.classList.toggle("active",idx===current);
    el.classList.toggle("done",idx<current);
  });
}

function updateProgress(p,text){
  $("processingBar").style.width=`${p}%`;
  $("processingPercent").textContent=`${Math.round(p)}%`;
  $("processingText").textContent=text;
}

function toDb(x){return 20*Math.log10(Math.max(1e-9,x));}
function formatTime(sec){const m=Math.floor(sec/60),s=Math.floor(sec%60);return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;}
function formatBytes(n){if(n<1024*1024)return `${(n/1024).toFixed(0)} KB`;return `${(n/1024/1024).toFixed(1)} MB`;}
function tick(ms=0){return new Promise(r=>setTimeout(r,ms));}

setTimeout(()=>{renderDailyJobUsage();renderSpecialistControls();},1200);
