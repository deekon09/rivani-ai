// RIVANI AI V16 - Clear Voice X frontend
// One-click local speech enhancement with MossFormer2_SE_48K.

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

chooseBtn?.addEventListener("click",()=>input?.click());
replaceBtn?.addEventListener("click",()=>input?.click());

input?.addEventListener("change",e=>{
  const file=e.target.files?.[0];
  if(file)loadAudioFile(file);
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
  if(file)loadAudioFile(file);
});

strength?.addEventListener("input",()=>{
  strengthValue.textContent=`${strength.value}%`;
});

document.querySelectorAll("[data-pro-preview]").forEach(btn=>{
  btn.addEventListener("click",()=>$("proPreviewModal")?.classList.remove("hidden"));
});
document.querySelectorAll("[data-close-pro]").forEach(btn=>{
  btn.addEventListener("click",()=>$("proPreviewModal")?.classList.add("hidden"));
});

scanBtn?.addEventListener("click",runScan);
repairBtn?.addEventListener("click",repairLocally);

$("tryAgainBtn")?.addEventListener("click",()=>{
  result.classList.add("hidden");
  repairPanel.classList.remove("hidden");
  repairPanel.scrollIntoView({behavior:"smooth",block:"center"});
});

$("downloadAudioBtn")?.addEventListener("click",()=>{
  if(!repairedBlob||!repairedUrl)return;
  const a=document.createElement("a");
  a.href=repairedUrl;
  const base=(sourceFile?.name||"rivani-audio").replace(/\.[^.]+$/,"");
  a.download=`${base}-rivani-clear-voice-x.wav`;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

async function loadAudioFile(file){
  try{
    chooseBtn.disabled=true;

    if(file.size>250*1024*1024){
      throw new Error("This local Beta currently supports files up to 250 MB.");
    }

    sourceFile=file;
    const arr=await file.arrayBuffer();
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    sourceBuffer=await ctx.decodeAudioData(arr.slice(0));
    await ctx.close();

    if(sourceBuffer.duration>60*60){
      throw new Error("This local Beta currently supports recordings up to 60 minutes.");
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
    "RIVANI will inspect clipping, level and background-floor indicators, then Clear Voice X will run the 48 kHz speech model locally.";
  $("issueCount").textContent="0 found";
  $("issueList").innerHTML='<div class="issue-empty">Run the audio scan to see findings.</div>';
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
    analysis.score>=45?"Clear Voice X recommended":
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
  scanBtn.textContent="✓ Scan Complete";
  scanBtn.disabled=false;
  repairPanel.scrollIntoView({behavior:"smooth",block:"center"});
}

function getWorker(){
  if(worker)return worker;
  worker=new Worker("mossformer2-worker.js?v=16.2",{type:"module"});

  worker.addEventListener("message",event=>{
    const d=event.data||{};
    const status=$("clearEngineStatus");

    if(d.type==="sourceFailed"){
      console.warn(d.text);
      if(status){
        status.textContent="Primary model route failed · trying backup…";
        status.classList.add("engine-error");
      }
    }

    if(d.type==="modelProgress"){
      if(status){
        status.textContent=d.cached
          ?"MossFormer2 48K · cached & ready"
          :`MossFormer2 48K · model ${Math.round(d.progress||0)}%`;
        status.classList.remove("engine-error");
      }
    }

    if(d.type==="ready"){
      modelReady=true;
      activeProvider=d.provider||"";
      if(status){
        status.textContent="MossFormer2 48K · Full WASM ready";
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
    status.textContent="MossFormer2 48K · loading automatically…";
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
        status.textContent="MossFormer2 48K · tap Enhance to retry";
        status.classList.add("engine-error");
      }
    }
  };

  w.addEventListener("message",listener);
  w.postMessage({type:"warmup"});
}

async function repairLocally(){
  if(!sourceBuffer)return;

  repairBtn.disabled=true;
  repairPanel.classList.add("hidden");
  result.classList.add("hidden");
  processing.classList.remove("hidden");
  processing.scrollIntoView({behavior:"smooth",block:"center"});

  try{
    setStage("upload");
    updateProgress(3,"Preparing the recording locally. Your audio is not uploaded to a RIVANI GPU server…");

    const buffer48=await resampleAudioBuffer(sourceBuffer,48000);
    const mono=mixToMono(buffer48);

    setStage("model");
    updateProgress(8,"Preparing MossFormer2 48K…");

    const enhanced=await runMossFormer(
      mono,
      Number(strength.value)/100,
      (p,text,providerName)=>{
        activeProvider=providerName||activeProvider;
        const mapped=10+Math.round(p*.70);
        updateProgress(Math.min(80,mapped),text);
      }
    );

    setStage("restore");
    updateProgress(82,"Applying transparent voice finishing—no dry/wet neural blend…");

    let repaired48=rebuildFromMono(buffer48,enhanced);
    repaired48=await applyAutoFinish(repaired48);

    setStage("level");
    updateProgress(91,"Balancing spoken-word loudness and protecting peaks…");
    levelVoiceRms(repaired48,-17.0,-1.2);

    let finalBuffer=repaired48;
    if(sourceBuffer.sampleRate!==48000){
      finalBuffer=await resampleAudioBuffer(repaired48,sourceBuffer.sampleRate);
    }

    setStage("export");
    updateProgress(97,"Encoding repaired WAV…");

    const wav=encodeWav(finalBuffer);
    repairedBlob=new Blob([wav],{type:"audio/wav"});

    if(repairedUrl)URL.revokeObjectURL(repairedUrl);
    repairedUrl=URL.createObjectURL(repairedBlob);

    $("afterPlayer").src=repairedUrl;
    $("afterPresetLabel").textContent=
      `Clear Voice X · ${strength.value}% · Full WASM`;

    const status=$("clearEngineStatus");
    if(status){
      status.textContent="MossFormer2 48K · Full WASM · ready";
      status.classList.remove("engine-error");
    }

    updateProgress(100,"Clear Voice X complete.");
    await tick(240);

    processing.classList.add("hidden");
    result.classList.remove("hidden");
    result.scrollIntoView({behavior:"smooth",block:"start"});
  }catch(error){
    console.error(error);
    processing.classList.add("hidden");
    repairPanel.classList.remove("hidden");

    const status=$("clearEngineStatus");
    if(status){
      status.textContent="MossFormer2 48K · could not start";
      status.classList.add("engine-error");
    }

    const detail=String(error?.message||error||"").slice(0,220);
    alert(
      `Clear Voice X could not finish. ${detail}\n\n`+
      `No lower-quality fallback result was generated. If this says model fetch failed, open the RIVANI model-proxy /health URL first and make sure it returns OK.`
    );
  }finally{
    repairBtn.disabled=false;
  }
}

async function runMossFormer(mono,strength,onProgress){
  const w=getWorker();
  const copy=new Float32Array(mono);

  return await new Promise((resolve,reject)=>{
    const listener=event=>{
      const d=event.data||{};

      if(d.type==="modelProgress"){
        onProgress?.(
          Math.min(15,Number(d.progress||0)*.15),
          d.text||"Loading AI model…",
          d.provider
        );
        return;
      }

      if(d.type==="phase"){
        onProgress?.(18,d.text||"Running MossFormer2…",d.provider);
        return;
      }

      if(d.type==="segmentProgress"){
        const p=20+(Number(d.progress||0)*.80);
        onProgress?.(p,d.text||"Enhancing speech…",d.provider);
        return;
      }

      if(d.type==="error"){
        w.removeEventListener("message",listener);
        reject(new Error(d.message||"MossFormer2 failed."));
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
      buffer:copy.buffer
    },[copy.buffer]);
  });
}

async function applyAutoFinish(buffer){
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
  mud.frequency.value=235;
  mud.Q.value=.85;
  mud.gain.value=-.55;

  const presence=offline.createBiquadFilter();
  presence.type="peaking";
  presence.frequency.value=2850;
  presence.Q.value=.8;
  presence.gain.value=.35;

  const comp=offline.createDynamicsCompressor();
  comp.threshold.value=-14;
  comp.knee.value=24;
  comp.ratio.value=1.3;
  comp.attack.value=.020;
  comp.release.value=.32;

  src.connect(hp).connect(mud).connect(presence).connect(comp).connect(offline.destination);
  src.start();
  return await offline.startRendering();
}

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
    ? `${issues.length} issue${issues.length===1?"":"s"} detected. Clear Voice X will use one full-band neural mask model instead of stacking multiple denoisers.`
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
