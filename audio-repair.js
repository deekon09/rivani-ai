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

let dereverbEnabled=false;
let dereverbStrength=.58;
let dereverbWorker=null;
let dereverbWorkerReady=false;
let dereverbWorkerBlobUrl=null;

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

const rivaniDeviceProfile=detectRivaniDeviceProfile();
document.body.classList.toggle(
  "rivani-low-power-device",
  rivaniDeviceProfile.lowPower
);

function normalizePlan(value){
  return String(value||"free").trim().toLowerCase();
}

function getAudioPlan(){
  return normalizePlan(window.RIVANI_LUKI_CONTEXT?.plan)==="pro" ? "pro" : "free";
}

function isProPlan(){
  return currentAudioPlan==="pro";
}

function detectRivaniDeviceProfile(){
  const cores=Math.max(1,Number(navigator.hardwareConcurrency)||4);
  const memory=Number(navigator.deviceMemory)||0;
  const ua=navigator.userAgent||"";
  const mobile=/Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const lowPower=mobile||cores<=4||(memory>0&&memory<=4);

  return {
    cores,
    memory,
    mobile,
    lowPower,
    preferWebGPU:Boolean(navigator.gpu)&&!mobile&&cores>=6&&(memory===0||memory>=6)
  };
}

function setProcessingPerformanceMode(active){
  document.body.classList.toggle("rivani-processing-performance",Boolean(active));
}

function releaseSpeakerWorker(){
  if(!speakerWorker)return;
  try{speakerWorker.terminate();}catch{}
  speakerWorker=null;
}

function releaseMusicWorker(){
  if(!musicWorker)return;
  try{musicWorker.terminate();}catch{}
  musicWorker=null;
}

function releaseDereverbWorker(){
  if(dereverbWorker){
    try{dereverbWorker.terminate();}catch{}
  }
  dereverbWorker=null;
  dereverbWorkerReady=false;

  if(dereverbWorkerBlobUrl){
    try{URL.revokeObjectURL(dereverbWorkerBlobUrl);}catch{}
    dereverbWorkerBlobUrl=null;
  }
}

function releaseInactiveSpecialistWorkers(){
  if(!backgroundVoicesEnabled)releaseSpeakerWorker();
  if(!musicControlEnabled)releaseMusicWorker();
  if(!dereverbEnabled)releaseDereverbWorker();
}

function releaseSpecialistsForLowPowerDevice(){
  if(!rivaniDeviceProfile.lowPower)return;
  // Large ONNX sessions are released after each job on weaker/mobile devices.
  // Cached model bytes remain in Cache Storage, so they are not re-downloaded.
  releaseSpeakerWorker();
  releaseMusicWorker();
  releaseDereverbWorker();
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
  // Final product: usage accounting remains internal; no test/debug counter
  // is shown in the customer UI.
}
function canStartAnotherFreeJob(){
  return isProPlan()||freeJobsRemaining()>0;
}

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
    if(isProPlan() && btn.dataset.proControl){
      toggleBuiltProControl(btn);
      return;
    }

    openProMessage(
      `${btn.dataset.proLock || "This feature"} · Pro`,
      `${btn.dataset.proLock || "This feature"} is included with RIVANI Pro.`
    );
  });
});

document.querySelectorAll("[data-specialist-engine]").forEach(btn=>{
  btn.addEventListener("click",()=>{
    const feature=btn.dataset.specialistEngine||"Specialist AI";

    if(!isProPlan()){
      openProMessage(
        `${feature} · Pro`,
        `${feature} is included with RIVANI Pro.`
      );
      return;
    }

    if(feature==="Background Voices"){
      backgroundVoicesEnabled=!backgroundVoicesEnabled;
      if(!backgroundVoicesEnabled)releaseSpeakerWorker();
      renderSpecialistControls();
      return;
    }

    if(feature==="Music Control"){
      musicControlEnabled=!musicControlEnabled;
      if(!musicControlEnabled)releaseMusicWorker();
      renderSpecialistControls();
      return;
    }

    if(feature==="De-Reverb"){
      dereverbEnabled=!dereverbEnabled;
      if(!dereverbEnabled)releaseDereverbWorker();
      renderSpecialistControls();
    }
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
  const pro=isProPlan();
  const bg=$("backgroundVoicesBtn");
  const music=$("musicControlBtn");
  const de=$("dereverbSpecialistBtn");

  for(const btn of [bg,music,de]){
    btn?.classList.toggle("pro-entitled",pro);
    btn?.classList.toggle("pro-locked",!pro);
  }

  bg?.classList.toggle("lab-active",pro&&backgroundVoicesEnabled);
  music?.classList.toggle("lab-active",pro&&musicControlEnabled);
  de?.classList.toggle("lab-active",pro&&dereverbEnabled);

  bg?.setAttribute("aria-pressed",String(pro&&backgroundVoicesEnabled));
  music?.setAttribute("aria-pressed",String(pro&&musicControlEnabled));
  de?.setAttribute("aria-pressed",String(pro&&dereverbEnabled));

  const bs=$("backgroundVoicesState");
  const ms=$("musicControlState");
  const ds=$("dereverbSpecialistState");

  if(!pro){
    if(bs)bs.textContent="PRO 🔒";
    if(ms)ms.textContent="PRO 🔒";
    if(ds)ds.textContent="PRO 🔒";
  }else{
    if(bs&&!bs.textContent.includes("PREPARING")){
      bs.textContent=backgroundVoicesEnabled?"ON":"OFF";
    }
    if(ms&&!ms.textContent.includes("PREPARING")){
      ms.textContent=musicControlEnabled?"ON":"OFF";
    }
    if(ds)ds.textContent=dereverbEnabled?"ON":"OFF";
  }

  $("backgroundVoiceSettings")?.classList.toggle(
    "hidden",
    !pro||!backgroundVoicesEnabled
  );
  $("musicControlSettings")?.classList.toggle(
    "hidden",
    !pro||!musicControlEnabled
  );

  const sb=$("speakerModeBtn");
  if(sb){
    sb.textContent=
      speakerMode==="a"
        ?"VOICE A"
        :speakerMode==="b"
          ?"VOICE B"
          :"AUTO";
  }
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
  currentAudioPlan=getAudioPlan();
  const pro=isProPlan();

  if(!pro){
    // Strict client-side final gating: a Free session must never retain
    // Pro-only audio state from an earlier auth/plan context.
    fanAssist=false;
    trafficAssist=false;
    clickRepair=false;
    backgroundVoicesEnabled=false;
    musicControlEnabled=false;
    dereverbEnabled=false;

    releaseSpeakerWorker();
    releaseMusicWorker();
    releaseDereverbWorker();
  }

  renderDailyJobUsage();

  const badge=$("proAudioBadge");
  if(badge){
    badge.textContent=pro?"✓ PRO ACTIVE":"🔒 PRO";
  }

  document.querySelectorAll("[data-pro-control]").forEach(btn=>{
    btn.classList.toggle("pro-entitled",pro);
    btn.classList.toggle("pro-locked",!pro);

    const key=btn.dataset.proControl;
    const active=
      pro&&(
        key==="fan"
          ?fanAssist
          :key==="traffic"
            ?trafficAssist
            :key==="click"
              ?clickRepair
              :false
      );

    btn.classList.toggle("enabled",active);
    btn.setAttribute("aria-pressed",String(active));

    const em=btn.querySelector("em");
    if(em){
      em.textContent=pro
        ?(active?"ON":"OFF")
        :"PRO 🔒";
    }
  });

  renderSpecialistControls();

  // Keep counters internal instead of showing debug/"today" lines.
  $("proDailyUsage")?.classList.add("hidden");

  if(!pro&&selectedExportFormat==="wav"){
    selectedExportFormat="mp3";
  }

  updateExportFormatUI();
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

    const worker=new Worker("mp3-export-worker.js?v=24.0-final");
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

    // V23.3: do not eagerly compile the 229 MB Clear Voice session while
    // the user is still scanning/toggling controls. This removes a race where
    // warmup and Enhance could wait on the same stuck session promise.
    const engineStatus=$("clearEngineStatus");
    if(engineStatus){
      engineStatus.textContent="RIVANI AI Engine · Ready to start";
      engineStatus.classList.remove("engine-error");
    }
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
  worker=new Worker("rivani-ai-worker.js?v=24.0-final",{type:"module"});

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

function releaseClearVoiceWorker(){
  if(worker){
    try{worker.terminate();}catch{}
  }
  worker=null;
  modelReady=false;
  warmupStarted=false;
  activeProvider="";
}

function markClearVoiceRetryState(text="RIVANI AI Engine · Ready to retry"){
  const status=$("clearEngineStatus");
  if(status){
    status.textContent=text;
    status.classList.add("engine-error");
  }
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

  // Performance Mode changes only decorative rendering, never audio quality.
  setProcessingPerformanceMode(true);

  repairPanel.classList.add("hidden");
  result.classList.add("hidden");
  processing.classList.remove("hidden");
  processing.scrollIntoView({behavior:"smooth",block:"center"});

  try{
    setStage("upload");
    updateProgress(3,"Preparing the recording locally. Your audio is not uploaded to a RIVANI GPU server…");

    const buffer48=await resampleAudioBuffer(sourceBuffer,48000);
    let mono=mixToMono(buffer48);

    const activeSpecialists=[
      musicControlEnabled?"music":null,
      backgroundVoicesEnabled?"voices":null,
      dereverbEnabled?"dereverb":null
    ].filter(Boolean);

    const preStart=5;
    const preEnd=48;
    const slice=activeSpecialists.length
      ?(preEnd-preStart)/activeSpecialists.length
      :0;
    let specialistIndex=0;
    let dereverbAppliedThisRun=false;
    let musicAppliedThisRun=false;
    let backgroundAppliedThisRun=false;

    if(musicControlEnabled){
      const a=preStart+slice*specialistIndex++;
      const b=a+slice;
      setStage("model");
      updateProgress(Math.round(a),"Music Control is separating voice from background music…");

      const b441=await resampleAudioBuffer(sourceBuffer,44100);
      const st=getStereoChannels(b441);
      const preMusic48=new Float32Array(mono);

      try{
        const musicResult=await runMusicControlBeta(
          st.left,
          st.right,
          musicRemoval,
          (p,t)=>updateProgress(Math.round(a+(b-a)*(Number(p||0)/100)),t)
        );

        if(musicResult.safetyFallback){
          // Product safety rule: never replace the user's voice with a weak,
          // phasey or metallic music-separation stem.
          mono=preMusic48;
          musicAppliedThisRun=false;
        }else{
          mono=resampleMonoLinear(
            musicResult.audio,
            44100,
            48000
          );
          musicAppliedThisRun=true;
        }

        const musicState=$("musicControlState");
        if(musicState){
          musicState.textContent=musicResult.safetyFallback
            ?"ON · SAFE PASS"
            :"ON";
        }
        updateProgress(
          Math.round(b),
          musicResult.safetyFallback
            ?"Music separation was not clean enough — original voice path protected."
            :"Music separation ready with voice protection."
        );
      }catch(error){
        mono=preMusic48;
        musicAppliedThisRun=false;
        releaseMusicWorker();
        const musicState=$("musicControlState");
        if(musicState)musicState.textContent="ON · RETRY";
        updateProgress(
          Math.round(b),
          "Music Control could not prepare — safely skipped. Continuing with Clear Voice."
        );
        console.warn("Music Control skipped:",error);
      }
    }

    if(backgroundVoicesEnabled){
      const a=preStart+slice*specialistIndex++;
      const b=a+slice;
      setStage("model");
      updateProgress(Math.round(a),"Background Voices is checking for overlapping speakers…");

      const preSpeaker48=new Float32Array(mono);
      const mono16=resampleMonoLinear(mono,48000,16000);
      try{
        const sep=await runBackgroundVoicesBeta(
          mono16,
          speakerMode,
          (p,t)=>updateProgress(Math.round(a+(b-a)*(Number(p||0)/100)),t)
        );

        if(sep.applied){
          const sep48=resampleMonoLinear(sep.audio,16000,48000);
          mono=restoreSeparatedSpeechAir(
            sep48,
            preSpeaker48
          );
          backgroundAppliedThisRun=true;
        }else{
          mono=preSpeaker48;
          backgroundAppliedThisRun=false;
        }

        const state=$("backgroundVoicesState");
        if(state){
          state.textContent=sep.applied
            ?`BETA ON · ${sep.selected}`
            :"ON · SAFE PASS";
        }

        updateProgress(
          Math.round(b),
          sep.applied
            ?`${sep.selected} isolated with voice-detail protection.`
            :"No reliable second speaker detected — original voice path preserved."
        );
      }catch(error){
        mono=preSpeaker48;
        backgroundAppliedThisRun=false;
        releaseSpeakerWorker();
        const state=$("backgroundVoicesState");
        if(state)state.textContent="ON · RETRY";
        updateProgress(
          Math.round(b),
          "Background Voices could not prepare — safely skipped. Continuing with Clear Voice."
        );
        console.warn("Background Voices skipped:",error);
      }
    }

    if(dereverbEnabled){
      const a=preStart+slice*specialistIndex++;
      const b=a+slice;
      setStage("model");
      updateProgress(Math.round(a),"De-Reverb Beta is analyzing room reflections…");

      const preDereverb48=new Float32Array(mono);

      try{
        mono=await runDereverbBeta(
          mono,
          dereverbStrength,
          (p,text)=>updateProgress(
            Math.round(a+(b-a)*(Number(p||0)/100)),
            text
          )
        );
        dereverbAppliedThisRun=true;

        const state=$("dereverbState");
        if(state)state.textContent="ON";

        updateProgress(Math.round(b),"Room-reflection cleanup ready.");
      }catch(error){
        // De-Reverb is optional. Never let a Worker/bootstrap failure kill
        // the stable Clear Voice enhancement path.
        mono=preDereverb48;
        dereverbAppliedThisRun=false;
        releaseDereverbWorker();

        const state=$("dereverbState");
        if(state)state.textContent="ON · RETRY";

        updateProgress(
          Math.round(b),
          "De-Reverb could not start cleanly — safely skipped. Continuing with Clear Voice."
        );
        console.warn("De-Reverb safely skipped:",error);
      }
    }

    const clearStart=activeSpecialists.length?50:8;
    setStage("model");
    updateProgress(clearStart,"Starting RIVANI AI Clear Voice…");

    // Fan/Traffic already receive one restrained post-model cleanup pass.
    // Only an actually-applied source-separation stage disables the duplicate
    // neural assist path.
    const separationSpecialistActive=
      musicAppliedThisRun||
      backgroundAppliedThisRun;

    const requestedStrength=
      Number(strength.value)/100;

    // Artifact Guard: when audio has already passed through a heavy cleanup
    // stage, an 85–100% second neural pass can sound "fata"/watery.
    // Keep the user's setting when no specialist actually changed the signal,
    // but cap stacked processing conservatively.
    let effectiveStrength=requestedStrength;
    let artifactGuardActive=false;

    if(musicAppliedThisRun||backgroundAppliedThisRun){
      const cap=dereverbAppliedThisRun?.70:.74;
      if(effectiveStrength>cap){
        effectiveStrength=cap;
        artifactGuardActive=true;
      }
    }else if(dereverbAppliedThisRun){
      const cap=(fanAssist||trafficAssist) ? .74 : .78;
      if(effectiveStrength>cap){
        effectiveStrength=cap;
        artifactGuardActive=true;
      }
    }else if(fanAssist||trafficAssist){
      const cap=.80;
      if(effectiveStrength>cap){
        effectiveStrength=cap;
        artifactGuardActive=true;
      }
    }

    if(artifactGuardActive){
      updateProgress(
        clearStart,
        "Natural Voice Guard is preventing over-processing…"
      );
    }

    const enhanced=await runMossFormer(
      mono,
      effectiveStrength,
      (p,text,providerName)=>{
        activeProvider=providerName||activeProvider;
        const mapped=clearStart+Math.round(Number(p||0)*((80-clearStart)/100));
        updateProgress(Math.min(80,mapped),text);
      },
      {
        // Fan / Traffic already have the restrained post-model cleanup below.
        // Do not also alter the neural mask: one cleanup pass only.
        fanAssist:false,
        trafficAssist:false
      }
    );

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
    updateProgress(91,"Finalizing a smooth listening level and protecting peaks…");

    // V23.9 final listening-level calibration.
    // The accepted RIVANI user sample measured about -16.7 LUFS while the
    // supplied Adobe reference was about -21.2 LUFS. Do not chase loudness:
    // keep the voice comfortable, natural and leave useful peak headroom.
    levelVoiceRms(
      repaired48,
      studioFinish ? -22.2 : -22.7,
      -2.0
    );

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
    const specialistLabels=[];
    if(musicAppliedThisRun)specialistLabels.push("Music Control");
    if(backgroundAppliedThisRun)specialistLabels.push("Background Voices");
    if(dereverbAppliedThisRun)specialistLabels.push("De-Reverb");
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
    alert(
      `RIVANI AI Clear Voice could not finish. ${detail}\n\n`+
      `Reload the page once and retry. The model proxy only needs attention when the AI model itself reports a model-fetch error.`
    );
  }finally{
    repairBtn.disabled=false;
    setProcessingPerformanceMode(false);
    releaseInactiveSpecialistWorkers();
    releaseSpecialistsForLowPowerDevice();
  }
}

const DEREVERB_WORKER_SOURCE="// RIVANI AI · De-Reverb worker\n// Separate from the stable Clear Voice engine.\n//\n// Single-channel, chunked WPE-style late-reverberation suppression:\n// - 48 kHz input\n// - 2048-point STFT\n// - 512-sample hop (~10.7 ms)\n// - delayed long-term complex prediction\n// - conservative blend / magnitude protection\n// - 6 s chunks + 1 s smooth overlap\n//\n// This worker intentionally does not denoise or alter the main AI model.\n\nconst SR=48000;\nconst FFT=2048;\nconst HOP=512;\nconst BINS=FFT/2+1;\nconst CHUNK=Math.round(SR*6);\nconst OVERLAP=Math.round(SR*1);\nconst STRIDE=CHUNK-OVERLAP;\n\nconst WINDOW=new Float64Array(FFT);\nfor(let i=0;i<FFT;i++){\n  // sqrt Hann; synthesis uses same window and explicit normalization.\n  WINDOW[i]=Math.sqrt(Math.max(0,.5-.5*Math.cos(2*Math.PI*i/(FFT-1))));\n}\n\nfunction cpuYield(ms=3){\n  return new Promise(resolve=>setTimeout(resolve,ms));\n}\n\nself.onmessage=async event=>{\n  const data=event.data||{};\n\n  // V23.2 transport health check. This does not touch De-Reverb DSP.\n  if(data.type===\"ping\"){\n    self.postMessage({type:\"ready\",version:\"23.2\"});\n    return;\n  }\n\n  if(data.type!==\"process\")return;\n\n  try{\n    const input=sanitize(new Float32Array(data.buffer));\n    const strength=clamp(Number(data.strength??.58),.25,.88);\n\n    self.postMessage({\n      type:\"phase\",\n      progress:1,\n      text:\"Analyzing room reflections…\"\n    });\n\n    const output=await processLong(input,strength);\n\n    self.postMessage(\n      {type:\"done\",buffer:output.buffer},\n      [output.buffer]\n    );\n  }catch(error){\n    self.postMessage({\n      type:\"error\",\n      message:String(error?.message||error||\"De-Reverb failed\")\n    });\n  }\n};\n\nasync function processLong(input,strength){\n  if(input.length<=CHUNK){\n    const padded=reflectPad(input,CHUNK);\n    const out=await processChunk(padded,strength);\n    return new Float32Array(out.subarray(0,input.length));\n  }\n\n  const sum=new Float64Array(input.length);\n  const weight=new Float64Array(input.length);\n\n  const positions=[];\n  for(let pos=0;pos<input.length;pos+=STRIDE){\n    positions.push(pos);\n    if(pos+CHUNK>=input.length)break;\n  }\n\n  for(let ci=0;ci<positions.length;ci++){\n    const pos=positions[ci];\n    const valid=Math.min(CHUNK,input.length-pos);\n    const seg=reflectPad(input.subarray(pos,pos+valid),CHUNK);\n\n    self.postMessage({\n      type:\"progress\",\n      progress:Math.round((ci/positions.length)*100),\n      text:`De-Reverb segment ${ci+1} of ${positions.length}…`\n    });\n\n    const processed=await processChunk(seg,strength);\n\n    for(let i=0;i<valid;i++){\n      const oi=pos+i;\n      let w=1;\n\n      if(ci>0 && i<OVERLAP){\n        const t=i/Math.max(1,OVERLAP-1);\n        w*=.5-.5*Math.cos(Math.PI*t);\n      }\n\n      if(ci<positions.length-1 && i>=STRIDE){\n        const t=(i-STRIDE)/Math.max(1,OVERLAP-1);\n        w*=.5+.5*Math.cos(Math.PI*t);\n      }\n\n      sum[oi]+=processed[i]*w;\n      weight[oi]+=w;\n    }\n\n    if(ci<positions.length-1){\n      await cpuYield(18);\n    }\n  }\n\n  const out=new Float32Array(input.length);\n  for(let i=0;i<out.length;i++){\n    out[i]=weight[i]>1e-10\n      ? clamp(sum[i]/weight[i],-1,1)\n      : input[i];\n  }\n\n  self.postMessage({\n    type:\"progress\",\n    progress:100,\n    text:\"Room-reflection cleanup complete.\"\n  });\n\n  return out;\n}\n\nasync function processChunk(input,strength){\n  const frameCount=Math.max(\n    1,\n    1+Math.ceil(Math.max(0,input.length-FFT)/HOP)\n  );\n\n  const reFrames=new Array(frameCount);\n  const imFrames=new Array(frameCount);\n\n  // Analysis STFT.\n  for(let t=0;t<frameCount;t++){\n    const start=t*HOP;\n    const re=new Float64Array(FFT);\n    const im=new Float64Array(FFT);\n\n    for(let n=0;n<FFT;n++){\n      const idx=start+n;\n      re[n]=(idx<input.length?input[idx]:0)*WINDOW[n];\n    }\n\n    fftInPlace(re,im,false);\n\n    const hr=new Float32Array(BINS);\n    const hi=new Float32Array(BINS);\n    for(let f=0;f<BINS;f++){\n      hr[f]=re[f];\n      hi[f]=im[f];\n    }\n\n    reFrames[t]=hr;\n    imFrames[t]=hi;\n\n    if((t+1)%16===0){\n      await cpuYield();\n    }\n  }\n\n  // Prediction settings.\n  const taps=strength>.72?9:8;\n  const delay=3; // ~32 ms guard interval\n  const iterations=strength>.74?2:1;\n\n  // Keep extreme low/high bands untouched.\n  const lowBin=Math.max(1,Math.floor(90*FFT/SR));\n  const highBin=Math.min(BINS-1,Math.ceil(9000*FFT/SR));\n\n  const T=frameCount;\n  const validStart=delay+taps-1;\n\n  if(T<=validStart+6){\n    return input.slice();\n  }\n\n  for(let f=lowBin;f<=highBin;f++){\n    const yr=new Float64Array(T);\n    const yi=new Float64Array(T);\n    const xr=new Float64Array(T);\n    const xi=new Float64Array(T);\n\n    for(let t=0;t<T;t++){\n      yr[t]=reFrames[t][f];\n      yi[t]=imFrames[t][f];\n      xr[t]=yr[t];\n      xi[t]=yi[t];\n    }\n\n    let solvedAny=false;\n\n    for(let iter=0;iter<iterations;iter++){\n      const invPower=estimateInversePower(xr,xi,validStart);\n\n      const ar=new Float64Array(taps*taps);\n      const ai=new Float64Array(taps*taps);\n      const br=new Float64Array(taps);\n      const bi=new Float64Array(taps);\n\n      // Weighted complex correlations.\n      for(let t=validStart;t<T;t++){\n        const w=invPower[t];\n        const ytr=yr[t], yti=yi[t];\n\n        for(let i=0;i<taps;i++){\n          const ti=t-delay-i;\n          const zir=yr[ti], zii=yi[ti];\n\n          // P = sum w * z * conj(y)\n          br[i]+=w*(zir*ytr+zii*yti);\n          bi[i]+=w*(zii*ytr-zir*yti);\n\n          for(let j=0;j<taps;j++){\n            const tj=t-delay-j;\n            const zjr=yr[tj], zji=yi[tj];\n\n            // R = sum w * z_i * conj(z_j)\n            const idx=i*taps+j;\n            ar[idx]+=w*(zir*zjr+zii*zji);\n            ai[idx]+=w*(zii*zjr-zir*zji);\n          }\n        }\n      }\n\n      // Diagonal loading for numerical stability.\n      let trace=0;\n      for(let i=0;i<taps;i++)trace+=Math.max(0,ar[i*taps+i]);\n      const reg=Math.max(1e-8,(trace/Math.max(1,taps))*(.0025+.003*(1-strength)));\n\n      for(let i=0;i<taps;i++){\n        ar[i*taps+i]+=reg;\n      }\n\n      const solved=solveComplex(ar,ai,br,bi,taps);\n      if(!solved)break;\n      solvedAny=true;\n\n      const gr=solved.re;\n      const gi=solved.im;\n\n      const mix=.46+.43*strength;\n      const minGain=.53-.11*strength;\n      const maxGain=1.10;\n\n      // Apply delayed prediction.\n      for(let t=0;t<T;t++){\n        if(t<validStart){\n          xr[t]=yr[t];\n          xi[t]=yi[t];\n          continue;\n        }\n\n        let pr=0,pi=0;\n\n        for(let k=0;k<taps;k++){\n          const tk=t-delay-k;\n          const zr=yr[tk],zi=yi[tk];\n\n          // conj(g) * z\n          pr+=gr[k]*zr+gi[k]*zi;\n          pi+=gr[k]*zi-gi[k]*zr;\n        }\n\n        let rr=yr[t]-mix*pr;\n        let ri=yi[t]-mix*pi;\n\n        // Protect direct speech from extreme cancellation/amplification.\n        const my=Math.hypot(yr[t],yi[t]);\n        const mx=Math.hypot(rr,ri);\n\n        if(my>1e-10 && mx>1e-12){\n          const ratio=mx/my;\n          if(ratio<minGain){\n            const scale=minGain/ratio;\n            rr*=scale;ri*=scale;\n          }else if(ratio>maxGain){\n            const scale=maxGain/ratio;\n            rr*=scale;ri*=scale;\n          }\n        }\n\n        xr[t]=rr;\n        xi[t]=ri;\n      }\n    }\n\n    if(!solvedAny)continue;\n\n    // Store estimated direct component.\n    for(let t=validStart;t<T;t++){\n      reFrames[t][f]=xr[t];\n      imFrames[t][f]=xi[t];\n    }\n\n    if((f-lowBin+1)%24===0){\n      await cpuYield();\n    }\n  }\n\n  // Synthesis STFT.\n  const outLen=(frameCount-1)*HOP+FFT;\n  const sum=new Float64Array(outLen);\n  const norm=new Float64Array(outLen);\n\n  for(let t=0;t<frameCount;t++){\n    const re=new Float64Array(FFT);\n    const im=new Float64Array(FFT);\n\n    for(let f=0;f<BINS;f++){\n      re[f]=reFrames[t][f];\n      im[f]=imFrames[t][f];\n\n      if(f>0 && f<FFT/2){\n        re[FFT-f]=re[f];\n        im[FFT-f]=-im[f];\n      }\n    }\n\n    fftInPlace(re,im,true);\n\n    const start=t*HOP;\n    for(let n=0;n<FFT;n++){\n      const idx=start+n;\n      const w=WINDOW[n];\n      sum[idx]+=re[n]*w;\n      norm[idx]+=w*w;\n    }\n\n    if((t+1)%16===0){\n      await cpuYield();\n    }\n  }\n\n  const out=new Float32Array(input.length);\n  for(let i=0;i<out.length;i++){\n    out[i]=norm[i]>1e-10\n      ? clamp(sum[i]/norm[i],-1,1)\n      : input[i];\n  }\n\n  // Preserve gross loudness; final RIVANI stage performs the real level finish.\n  matchRmsSoft(input,out);\n\n  return out;\n}\n\nfunction estimateInversePower(xr,xi,start){\n  const T=xr.length;\n  const p=new Float64Array(T);\n\n  let mean=0,count=0;\n  for(let t=start;t<T;t++){\n    const v=xr[t]*xr[t]+xi[t]*xi[t];\n    p[t]=v;\n    mean+=v;\n    count++;\n  }\n  mean/=Math.max(1,count);\n\n  const floor=Math.max(1e-10,mean*1e-6);\n  const inv=new Float64Array(T);\n\n  for(let t=0;t<T;t++){\n    let sm=0,n=0;\n    for(let q=Math.max(0,t-1);q<=Math.min(T-1,t+1);q++){\n      sm+=p[q];\n      n++;\n    }\n    sm/=Math.max(1,n);\n    inv[t]=1/Math.max(floor,sm);\n  }\n\n  return inv;\n}\n\nfunction solveComplex(ar0,ai0,br0,bi0,n){\n  // Gauss-Jordan elimination with partial pivoting.\n  const ar=new Float64Array(ar0);\n  const ai=new Float64Array(ai0);\n  const br=new Float64Array(br0);\n  const bi=new Float64Array(bi0);\n\n  for(let col=0;col<n;col++){\n    let pivot=col;\n    let best=0;\n\n    for(let row=col;row<n;row++){\n      const idx=row*n+col;\n      const mag=ar[idx]*ar[idx]+ai[idx]*ai[idx];\n      if(mag>best){best=mag;pivot=row;}\n    }\n\n    if(!(best>1e-24) || !Number.isFinite(best))return null;\n\n    if(pivot!==col){\n      for(let j=0;j<n;j++){\n        let idxA=col*n+j,idxB=pivot*n+j;\n\n        let tr=ar[idxA];ar[idxA]=ar[idxB];ar[idxB]=tr;\n        let ti=ai[idxA];ai[idxA]=ai[idxB];ai[idxB]=ti;\n      }\n\n      let tr=br[col];br[col]=br[pivot];br[pivot]=tr;\n      let ti=bi[col];bi[col]=bi[pivot];bi[pivot]=ti;\n    }\n\n    const pidx=col*n+col;\n    const pr=ar[pidx],pi=ai[pidx];\n    const pden=pr*pr+pi*pi;\n    if(!(pden>1e-24))return null;\n\n    // Normalize pivot row.\n    for(let j=col;j<n;j++){\n      const idx=col*n+j;\n      const qr=(ar[idx]*pr+ai[idx]*pi)/pden;\n      const qi=(ai[idx]*pr-ar[idx]*pi)/pden;\n      ar[idx]=qr;ai[idx]=qi;\n    }\n\n    {\n      const qr=(br[col]*pr+bi[col]*pi)/pden;\n      const qi=(bi[col]*pr-br[col]*pi)/pden;\n      br[col]=qr;bi[col]=qi;\n    }\n\n    // Eliminate the column from all other rows.\n    for(let row=0;row<n;row++){\n      if(row===col)continue;\n\n      const fidx=row*n+col;\n      const fr=ar[fidx],fi=ai[fidx];\n      if(Math.abs(fr)+Math.abs(fi)<1e-18)continue;\n\n      for(let j=col;j<n;j++){\n        const ridx=row*n+j;\n        const pRow=col*n+j;\n\n        // factor * pivotRow\n        const mr=fr*ar[pRow]-fi*ai[pRow];\n        const mi=fr*ai[pRow]+fi*ar[pRow];\n\n        ar[ridx]-=mr;\n        ai[ridx]-=mi;\n      }\n\n      const mr=fr*br[col]-fi*bi[col];\n      const mi=fr*bi[col]+fi*br[col];\n      br[row]-=mr;\n      bi[row]-=mi;\n    }\n  }\n\n  for(let i=0;i<n;i++){\n    if(!Number.isFinite(br[i])||!Number.isFinite(bi[i]))return null;\n  }\n\n  return {re:br,im:bi};\n}\n\nfunction fftInPlace(re,im,inverse){\n  const n=re.length;\n\n  for(let i=1,j=0;i<n;i++){\n    let bit=n>>1;\n\n    for(;j&bit;bit>>=1)j^=bit;\n    j^=bit;\n\n    if(i<j){\n      let tr=re[i];re[i]=re[j];re[j]=tr;\n      let ti=im[i];im[i]=im[j];im[j]=ti;\n    }\n  }\n\n  for(let len=2;len<=n;len<<=1){\n    const angle=(inverse?2:-2)*Math.PI/len;\n    const wrStep=Math.cos(angle);\n    const wiStep=Math.sin(angle);\n\n    for(let i=0;i<n;i+=len){\n      let wr=1,wi=0;\n      const half=len>>1;\n\n      for(let j=0;j<half;j++){\n        const u=i+j;\n        const v=u+half;\n\n        const vr=re[v]*wr-im[v]*wi;\n        const vi=re[v]*wi+im[v]*wr;\n\n        re[v]=re[u]-vr;\n        im[v]=im[u]-vi;\n        re[u]+=vr;\n        im[u]+=vi;\n\n        const nwr=wr*wrStep-wi*wiStep;\n        wi=wr*wiStep+wi*wrStep;\n        wr=nwr;\n      }\n    }\n  }\n\n  if(inverse){\n    for(let i=0;i<n;i++){\n      re[i]/=n;\n      im[i]/=n;\n    }\n  }\n}\n\nfunction reflectPad(input,target){\n  if(input.length>=target)return new Float32Array(input.subarray(0,target));\n\n  const out=new Float32Array(target);\n  out.set(input);\n\n  if(!input.length)return out;\n  if(input.length===1){\n    out.fill(input[0],1);\n    return out;\n  }\n\n  const context=Math.min(input.length,Math.round(SR*.65));\n  const base=input.length-context;\n\n  for(let i=input.length;i<target;i++){\n    const p=(i-input.length)%Math.max(2,context*2-2);\n    const r=p<context?p:context*2-2-p;\n    const idx=Math.max(base,Math.min(input.length-1,input.length-1-r));\n    out[i]=input[idx];\n  }\n\n  return out;\n}\n\nfunction matchRmsSoft(input,output){\n  let a=0,b=0,n=0;\n\n  for(let i=0;i<input.length;i+=8){\n    a+=input[i]*input[i];\n    b+=output[i]*output[i];\n    n++;\n  }\n\n  const ra=Math.sqrt(a/Math.max(1,n));\n  const rb=Math.sqrt(b/Math.max(1,n));\n  if(!(ra>1e-7)||!(rb>1e-7))return;\n\n  let gain=ra/rb;\n  gain=clamp(gain,.88,1.12);\n\n  for(let i=0;i<output.length;i++){\n    output[i]=clamp(output[i]*gain,-1,1);\n  }\n}\n\nfunction sanitize(input){\n  const out=new Float32Array(input.length);\n\n  for(let i=0;i<input.length;i++){\n    const v=input[i];\n    out[i]=Number.isFinite(v)?clamp(v,-1,1):0;\n  }\n\n  return out;\n}\n\nfunction clamp(v,a,b){\n  return Math.max(a,Math.min(b,v));\n}\n";

function createDereverbWorker(useEmbedded=false){
  releaseDereverbWorker();

  if(useEmbedded){
    const blob=new Blob(
      [DEREVERB_WORKER_SOURCE],
      {type:"text/javascript"}
    );
    dereverbWorkerBlobUrl=URL.createObjectURL(blob);
    dereverbWorker=new Worker(dereverbWorkerBlobUrl);
  }else{
    // Resolve against this module instead of the document URL.
    const url=new URL(
      "./dereverb-worker.js?v=24.0-final",
      import.meta.url
    );
    dereverbWorker=new Worker(url);
  }

  dereverbWorkerReady=false;
  return dereverbWorker;
}

async function waitForDereverbWorkerReady(workerInstance,timeoutMs=6000){
  if(dereverbWorkerReady && workerInstance===dereverbWorker){
    return workerInstance;
  }

  return await new Promise((resolve,reject)=>{
    let settled=false;
    let timer=null;

    const cleanup=()=>{
      clearTimeout(timer);
      workerInstance.removeEventListener("message",onMessage);
      workerInstance.removeEventListener("error",onError);
      workerInstance.removeEventListener("messageerror",onMessageError);
    };

    const finishError=message=>{
      if(settled)return;
      settled=true;
      cleanup();
      reject(new Error(message));
    };

    const onMessage=event=>{
      const d=event.data||{};
      if(d.type!=="ready")return;
      if(settled)return;
      settled=true;
      cleanup();
      dereverbWorkerReady=true;
      resolve(workerInstance);
    };

    const onError=event=>{
      event?.preventDefault?.();
      finishError("De-Reverb worker script could not load.");
    };

    const onMessageError=()=>{
      finishError("De-Reverb worker message channel failed.");
    };

    workerInstance.addEventListener("message",onMessage);
    workerInstance.addEventListener("error",onError);
    workerInstance.addEventListener("messageerror",onMessageError);

    timer=setTimeout(()=>{
      finishError("De-Reverb worker did not become ready.");
    },timeoutMs);

    try{
      workerInstance.postMessage({type:"ping"});
    }catch(error){
      finishError(
        String(error?.message||error||"De-Reverb worker could not start.")
      );
    }
  });
}

async function ensureDereverbWorkerReady(){
  if(dereverbWorker && dereverbWorkerReady){
    return dereverbWorker;
  }

  let lastError=null;

  // Normal same-origin Worker first.
  try{
    const external=createDereverbWorker(false);
    return await waitForDereverbWorkerReady(external,6000);
  }catch(error){
    lastError=error;
    console.warn(
      "External De-Reverb worker failed; trying embedded recovery worker.",
      error
    );
  }

  // Recovery path: identical worker source from this bundle, launched from
  // a Blob URL. This avoids static-route/cache glitches without changing DSP.
  try{
    const embeddedWorker=createDereverbWorker(true);
    return await waitForDereverbWorkerReady(embeddedWorker,6000);
  }catch(error){
    lastError=error;
    releaseDereverbWorker();
  }

  throw lastError||new Error("De-Reverb worker could not start.");
}

async function runDereverbOnWorker(
  workerInstance,
  mono,
  strength,
  onProgress
){
  const copy=new Float32Array(mono);
  const durationSeconds=copy.length/48000;

  // Inactivity watchdog rather than a fixed total deadline. Any legitimate
  // progress refreshes it. Short clips should never sit for three minutes.
  const inactivityMs=Math.max(
    45000,
    Math.min(150000,30000+durationSeconds*5000)
  );

  return await new Promise((resolve,reject)=>{
    let settled=false;
    let watchdog=null;

    const cleanup=()=>{
      clearTimeout(watchdog);
      workerInstance.removeEventListener("message",listener);
      workerInstance.removeEventListener("error",onError);
      workerInstance.removeEventListener("messageerror",onMessageError);
    };

    const finishError=message=>{
      if(settled)return;
      settled=true;
      cleanup();
      reject(new Error(message));
    };

    const armWatchdog=()=>{
      clearTimeout(watchdog);
      watchdog=setTimeout(()=>{
        finishError("De-Reverb worker stopped responding.");
      },inactivityMs);
    };

    const onError=event=>{
      event?.preventDefault?.();
      finishError("De-Reverb worker crashed while processing.");
    };

    const onMessageError=()=>{
      finishError("De-Reverb worker returned an unreadable result.");
    };

    const listener=event=>{
      const d=event.data||{};

      if(d.type==="phase" || d.type==="progress"){
        armWatchdog();
        onProgress?.(
          Number(d.progress||0),
          d.text||"Reducing room reflections…"
        );
        return;
      }

      if(d.type==="error"){
        finishError(d.message||"De-Reverb failed.");
        return;
      }

      if(d.type==="done"){
        if(settled)return;
        settled=true;
        cleanup();
        resolve(new Float32Array(d.buffer));
      }
    };

    workerInstance.addEventListener("message",listener);
    workerInstance.addEventListener("error",onError);
    workerInstance.addEventListener("messageerror",onMessageError);
    armWatchdog();

    try{
      workerInstance.postMessage({
        type:"process",
        strength,
        buffer:copy.buffer
      },[copy.buffer]);
    }catch(error){
      finishError(
        String(error?.message||error||"De-Reverb request could not start.")
      );
    }
  });
}

async function runDereverbBeta(mono,strength,onProgress){
  let lastError=null;

  // First attempt reuses a healthy worker when possible. If processing itself
  // fails, restart once with the embedded identical worker before giving up.
  try{
    const workerInstance=await ensureDereverbWorkerReady();
    return await runDereverbOnWorker(
      workerInstance,
      mono,
      strength,
      onProgress
    );
  }catch(error){
    lastError=error;
    console.warn("De-Reverb first attempt failed; restarting once.",error);
    releaseDereverbWorker();
  }

  try{
    const workerInstance=createDereverbWorker(true);
    await waitForDereverbWorkerReady(workerInstance,6000);
    return await runDereverbOnWorker(
      workerInstance,
      mono,
      strength,
      onProgress
    );
  }catch(error){
    lastError=error;
    releaseDereverbWorker();
  }

  throw lastError||new Error("De-Reverb could not run.");
}

function restoreSeparatedSpeechAir(processed48,reference48){
  if(
    !processed48?.length||
    !reference48?.length||
    processed48.length!==reference48.length
  ){
    return processed48;
  }

  // The speaker model works at 16 kHz. Restore only a very small amount of
  // >7.2 kHz detail, and only while the separated speech itself is active.
  // This avoids bringing cymbals/music/noise back as a full-band dry blend.
  const high=highPassBiquadMono(
    reference48,
    48000,
    7200,
    .707
  );

  const out=new Float32Array(processed48.length);

  let refEnergy=0;
  let n=0;
  for(let i=0;i<processed48.length;i+=16){
    refEnergy+=processed48[i]*processed48[i];
    n++;
  }

  const baseRms=Math.sqrt(
    refEnergy/Math.max(1,n)
  );

  const attack=.018;
  const release=.0014;
  let env=0;

  for(let i=0;i<out.length;i++){
    const x=processed48[i]||0;
    const abs=Math.abs(x);

    const k=abs>env?attack:release;
    env+=(abs-env)*k;

    const speechGate=Math.max(
      0,
      Math.min(
        1,
        (env-baseRms*.18)/
        Math.max(1e-5,baseRms*.82)
      )
    );

    out[i]=Math.max(
      -1,
      Math.min(
        1,
        x+
        high[i]*
        .06*
        speechGate
      )
    );
  }

  return out;
}

function highPassBiquadMono(input,sampleRate,frequency,q=.707){
  const out=new Float32Array(input.length);

  const w0=2*Math.PI*frequency/sampleRate;
  const cos=Math.cos(w0);
  const sin=Math.sin(w0);
  const alpha=sin/(2*q);

  let b0=(1+cos)/2;
  let b1=-(1+cos);
  let b2=(1+cos)/2;
  let a0=1+alpha;
  let a1=-2*cos;
  let a2=1-alpha;

  b0/=a0;
  b1/=a0;
  b2/=a0;
  a1/=a0;
  a2/=a0;

  let x1=0,x2=0,y1=0,y2=0;

  for(let i=0;i<input.length;i++){
    const x0=input[i]||0;

    const y0=
      b0*x0+
      b1*x1+
      b2*x2-
      a1*y1-
      a2*y2;

    out[i]=Math.max(
      -1,
      Math.min(1,y0)
    );

    x2=x1;
    x1=x0;
    y2=y1;
    y1=y0;
  }

  return out;
}

function getStereoChannels(buffer){
  if(buffer.numberOfChannels===1){const m=new Float32Array(buffer.getChannelData(0));return {left:m,right:new Float32Array(m)};}
  return {left:new Float32Array(buffer.getChannelData(0)),right:new Float32Array(buffer.getChannelData(1))};
}
function resampleMonoLinear(input,fromRate,toRate){
  if(fromRate===toRate)return new Float32Array(input);if(!input.length)return new Float32Array();const len=Math.max(1,Math.round(input.length*toRate/fromRate)),out=new Float32Array(len),ratio=fromRate/toRate;for(let i=0;i<len;i++){const pos=i*ratio,a=Math.floor(pos),b=Math.min(input.length-1,a+1),t=pos-a;out[i]=(input[a]||0)*(1-t)+(input[b]||0)*t;}return out;
}
function getSpeakerWorker(){
  if(!speakerWorker){
    speakerWorker=new Worker("speaker-separation-worker.js?v=24.0-final",{type:"module"});
  }
  return speakerWorker;
}

function getMusicWorker(){
  if(!musicWorker){
    musicWorker=new Worker("music-separation-worker.js?v=24.0-final",{type:"module"});
  }
  return musicWorker;
}

function warmupBackgroundVoices(){
  // Retained only for compatibility with stale cached UI calls.
  // V23.1 intentionally does not pre-initialize specialist models on toggle.
  const state=$("backgroundVoicesState");
  if(state)state.textContent=backgroundVoicesEnabled?"ON":"OFF";
}

function warmupMusicControl(){
  // Retained only for compatibility with stale cached UI calls.
  const state=$("musicControlState");
  if(state)state.textContent=musicControlEnabled?"ON":"OFF";
}

async function runBackgroundVoicesBeta(mono16,mode,onProgress){
  const w=getSpeakerWorker();
  const copy=new Float32Array(mono16);

  return await new Promise((resolve,reject)=>{
    let settled=false;
    let timeout=null;

    const finishError=error=>{
      if(settled)return;
      settled=true;
      clearTimeout(timeout);
      w.removeEventListener("message",listener);
      w.removeEventListener("error",workerError);
      releaseSpeakerWorker();
      reject(error instanceof Error?error:new Error(String(error||"Background Voices failed.")));
    };

    const refreshTimeout=()=>{
      clearTimeout(timeout);
      timeout=setTimeout(()=>{
        finishError(new Error(
          "Background Voices AI preparation timed out. The specialist was skipped so Clear Voice can continue."
        ));
      },150000);
    };

    const workerError=event=>{
      finishError(new Error(
        event?.message||"Background Voices worker failed to start."
      ));
    };

    const listener=e=>{
      const d=e.data||{};

      if(d.type==="modelProgress"||d.type==="progress"){
        refreshTimeout();
        onProgress?.(Number(d.progress||0),d.text||"Preparing Background Voices AI…");
        return;
      }

      if(d.type==="error"){
        finishError(new Error(d.message||"Background Voices failed."));
        return;
      }

      if(d.type==="done"){
        if(settled)return;
        settled=true;
        clearTimeout(timeout);
        w.removeEventListener("message",listener);
        w.removeEventListener("error",workerError);

        resolve({
          audio:new Float32Array(d.buffer),
          selected:d.selected||"VOICE A",
          energyA:Number(d.energyA||0),
          energyB:Number(d.energyB||0),
          applied:d.applied!==false,
          confidence:Number(d.confidence||0),
          reason:String(d.reason||"")
        });
      }
    };

    w.addEventListener("message",listener);
    w.addEventListener("error",workerError,{once:true});
    refreshTimeout();

    w.postMessage({
      type:"process",
      mode,
      deviceProfile:{...rivaniDeviceProfile,preferWebGPU:false},
      buffer:copy.buffer
    },[copy.buffer]);
  });
}

async function runMusicControlBeta(left,right,amount,onProgress){
  const w=getMusicWorker();
  const l=new Float32Array(left);
  const r=new Float32Array(right);

  return await new Promise((resolve,reject)=>{
    let settled=false;
    let timeout=null;

    const finishError=error=>{
      if(settled)return;
      settled=true;
      clearTimeout(timeout);
      w.removeEventListener("message",listener);
      w.removeEventListener("error",workerError);
      releaseMusicWorker();
      reject(error instanceof Error?error:new Error(String(error||"Music Control failed.")));
    };

    const refreshTimeout=()=>{
      clearTimeout(timeout);
      timeout=setTimeout(()=>{
        finishError(new Error(
          "Music Control AI preparation timed out. The specialist was skipped so Clear Voice can continue."
        ));
      },150000);
    };

    const workerError=event=>{
      finishError(new Error(
        event?.message||"Music Control worker failed to start."
      ));
    };

    const listener=e=>{
      const d=e.data||{};

      if(d.type==="modelProgress"||d.type==="progress"){
        refreshTimeout();
        onProgress?.(Number(d.progress||0),d.text||"Preparing Music Control AI…");
        return;
      }

      if(d.type==="error"){
        finishError(new Error(d.message||"Music Control failed."));
        return;
      }

      if(d.type==="done"){
        if(settled)return;
        settled=true;
        clearTimeout(timeout);
        w.removeEventListener("message",listener);
        w.removeEventListener("error",workerError);

        resolve({
          audio:new Float32Array(d.buffer),
          safetyFallback:Boolean(d.safetyFallback),
          retentionDb:Number(d.retentionDb||0)
        });
      }
    };

    w.addEventListener("message",listener);
    w.addEventListener("error",workerError,{once:true});
    refreshTimeout();

    w.postMessage({
      type:"process",
      amount:Math.max(.60,Math.min(1,Number(amount)||1)),
      deviceProfile:{...rivaniDeviceProfile,preferWebGPU:false},
      left:l.buffer,
      right:r.buffer
    },[l.buffer,r.buffer]);
  });
}

async function runMossFormer(
  mono,
  strength,
  onProgress,
  assistsOverride=null,
  retryCount=0
){
  const w=getWorker();
  const copy=new Float32Array(mono);

  try{
    return await new Promise((resolve,reject)=>{
      let settled=false;
      let inactivityTimer=null;

      // Session compilation can be heavy, but it must not wait forever.
      // Every real worker message refreshes this timer.
      const INACTIVITY_MS=90000;

      const cleanup=()=>{
        clearTimeout(inactivityTimer);
        w.removeEventListener("message",listener);
        w.removeEventListener("error",workerError);
        w.removeEventListener("messageerror",messageError);
      };

      const finishError=error=>{
        if(settled)return;
        settled=true;
        cleanup();
        reject(
          error instanceof Error
            ?error
            :new Error(String(error||"RIVANI AI Engine stopped responding."))
        );
      };

      const refreshWatchdog=()=>{
        clearTimeout(inactivityTimer);
        inactivityTimer=setTimeout(()=>{
          finishError(
            new Error(
              "RIVANI AI Engine stopped responding while preparing. " +
              "The worker will restart automatically."
            )
          );
        },INACTIVITY_MS);
      };

      const workerError=event=>{
        event?.preventDefault?.();
        finishError(
          new Error("RIVANI AI Engine worker could not start.")
        );
      };

      const messageError=()=>{
        finishError(
          new Error("RIVANI AI Engine returned an unreadable worker message.")
        );
      };

      const listener=event=>{
        const d=event.data||{};
        refreshWatchdog();

        if(d.type==="modelProgress"){
          // Give preparation a visibly useful section of the progress bar.
          const prep=Math.max(
            0,
            Math.min(28,Number(d.progress||0)*.28)
          );
          onProgress?.(
            prep,
            d.text||"Preparing RIVANI AI Engine…",
            d.provider
          );
          return;
        }

        if(d.type==="phase"){
          onProgress?.(
            30,
            d.text||"Running RIVANI AI enhancement…",
            d.provider
          );
          return;
        }

        if(d.type==="segmentProgress"){
          const p=32+(Number(d.progress||0)*.68);
          onProgress?.(
            p,
            d.text||"Enhancing speech…",
            d.provider
          );
          return;
        }

        if(d.type==="error"){
          finishError(
            new Error(d.message||"RIVANI AI enhancement failed.")
          );
          return;
        }

        if(d.type==="done"){
          if(settled)return;
          settled=true;
          cleanup();
          activeProvider=d.provider||activeProvider;
          modelReady=true;
          resolve(new Float32Array(d.buffer));
        }
      };

      w.addEventListener("message",listener);
      w.addEventListener("error",workerError);
      w.addEventListener("messageerror",messageError);
      refreshWatchdog();

      const effectiveAssists=assistsOverride||{
        fanAssist,
        trafficAssist
      };

      try{
        w.postMessage({
          type:"process",
          strength,
          fanAssist:Boolean(effectiveAssists.fanAssist),
          trafficAssist:Boolean(effectiveAssists.trafficAssist),
          buffer:copy.buffer
        },[copy.buffer]);
      }catch(error){
        finishError(error);
      }
    });
  }catch(error){
    // One clean retry with a brand-new Worker/session. Do not silently change
    // the model or audio algorithm.
    releaseClearVoiceWorker();

    if(retryCount<1){
      markClearVoiceRetryState(
        "RIVANI AI Engine · Restarting compatibility mode…"
      );

      onProgress?.(
        2,
        "Restarting RIVANI AI Engine in stable compatibility mode…",
        "wasm-full"
      );

      await new Promise(resolve=>setTimeout(resolve,250));

      return runMossFormer(
        mono,
        strength,
        onProgress,
        assistsOverride,
        retryCount+1
      );
    }

    markClearVoiceRetryState(
      "RIVANI AI Engine · Could not start"
    );
    throw error;
  }
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

function levelVoiceRms(buffer,targetDb=-22.2,peakCeilingDb=-2.0){
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
  // Product guard: never make a quiet recording jump unnaturally loud.
  // Attenuation can be stronger when needed; automatic boost stays modest.
  let gainDb=Math.max(-6,Math.min(2.5,targetDb-measured));
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
