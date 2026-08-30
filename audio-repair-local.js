// RIVANI AI Free Clear Voice
// DeepFilterNet3 WASM -> Artifact Guard -> voice finish -> loudness / peak guard.

const $ = (id) => document.getElementById(id);

const input = $('audioFileInput');
const dropZone = $('audioDropZone');
const editor = $('audioEditor');
const chooseBtn = $('chooseAudioBtn');
const replaceBtn = $('replaceAudioBtn');
const scanBtn = $('scanAudioBtn');
const repairPanel = $('repairPanel');
const repairBtn = $('repairAudioBtn');
const processing = $('audioProcessing');
const result = $('audioResult');
const strength = $('repairStrength');
const strengthValue = $('repairStrengthValue');

let sourceFile = null;
let sourceBuffer = null;
let sourceUrl = null;
let repairedBlob = null;
let repairedUrl = null;
let analysis = null;
let voiceFinish = 'broadcast';
let dfWorker = null;
let engineReady = false;
let engineWarmupStarted = false;

chooseBtn?.addEventListener('click', () => input?.click());
replaceBtn?.addEventListener('click', () => input?.click());

input?.addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (file) loadAudioFile(file);
});

['dragenter','dragover'].forEach(type => dropZone?.addEventListener(type, e => {
  e.preventDefault();
  dropZone.classList.add('dragging');
}));
['dragleave','drop'].forEach(type => dropZone?.addEventListener(type, e => {
  e.preventDefault();
  dropZone.classList.remove('dragging');
}));
dropZone?.addEventListener('drop', e => {
  const file = [...(e.dataTransfer?.files || [])].find(f =>
    f.type.startsWith('audio/') || /\.(wav|mp3|m4a|aac|ogg|flac)$/i.test(f.name)
  );
  if (file) loadAudioFile(file);
});

strength?.addEventListener('input', () => {
  strengthValue.textContent = `${strength.value}%`;
});

document.querySelectorAll('#voiceFinishOptions button').forEach(btn => {
  btn.addEventListener('click', () => {
    voiceFinish = btn.dataset.finish || 'broadcast';
    document.querySelectorAll('#voiceFinishOptions button').forEach(x => {
      x.classList.toggle('active', x === btn);
    });
  });
});

document.querySelectorAll('[data-pro-preview]').forEach(btn => {
  btn.addEventListener('click', () => $('proPreviewModal')?.classList.remove('hidden'));
});
document.querySelectorAll('[data-close-pro]').forEach(btn => {
  btn.addEventListener('click', () => $('proPreviewModal')?.classList.add('hidden'));
});

scanBtn?.addEventListener('click', runScan);
repairBtn?.addEventListener('click', repairLocally);

$('tryAgainBtn')?.addEventListener('click', () => {
  result.classList.add('hidden');
  repairPanel.classList.remove('hidden');
  repairPanel.scrollIntoView({behavior:'smooth', block:'center'});
});

$('downloadAudioBtn')?.addEventListener('click', () => {
  if (!repairedBlob || !repairedUrl) return;
  const a = document.createElement('a');
  a.href = repairedUrl;
  const base = (sourceFile?.name || 'rivani-audio').replace(/\.[^.]+$/, '');
  a.download = `${base}-rivani-clear-voice.wav`;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

async function loadAudioFile(file) {
  try {
    chooseBtn.disabled = true;

    if (file.size > 250 * 1024 * 1024) {
      throw new Error('This local Beta currently supports files up to 250 MB.');
    }

    sourceFile = file;
    const arrayBuffer = await file.arrayBuffer();
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    sourceBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    await ctx.close();

    if (sourceBuffer.duration > 60 * 60) {
      throw new Error('This local Beta currently supports recordings up to 60 minutes.');
    }

    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceUrl = URL.createObjectURL(file);

    $('audioFileName').textContent = file.name;
    $('audioFileDetails').textContent =
      `${formatBytes(file.size)} · ${sourceBuffer.numberOfChannels === 1 ? 'Mono' : `${sourceBuffer.numberOfChannels} channels`} · ${(sourceBuffer.sampleRate/1000).toFixed(1)} kHz`;
    $('audioDuration').textContent = formatTime(sourceBuffer.duration);
    $('beforePlayer').src = sourceUrl;

    drawWaveform(sourceBuffer, $('waveCanvas'));
    resetAnalysis();

    dropZone.classList.add('hidden');
    editor.classList.remove('hidden');
    editor.scrollIntoView({behavior:'smooth', block:'start'});

    warmupEngine();
  } catch (error) {
    console.error(error);
    alert(String(error?.message || 'This browser could not decode that audio file.'));
  } finally {
    chooseBtn.disabled = false;
  }
}

function resetAnalysis() {
  analysis = null;
  $('healthScore').textContent = '--';
  $('healthLabel').textContent = 'Ready to scan';
  $('healthSummary').textContent =
    'RIVANI will inspect clipping, recording level and background-floor indicators before local AI repair.';
  $('issueCount').textContent = '0 found';
  $('issueList').innerHTML = '<div class="issue-empty">Run the audio scan to see findings.</div>';
  repairPanel.classList.add('hidden');
  result.classList.add('hidden');
}

async function runScan() {
  if (!sourceBuffer) return;
  scanBtn.disabled = true;
  scanBtn.textContent = 'Scanning…';
  await tick(70);

  analysis = analyzeBuffer(sourceBuffer);

  $('healthScore').textContent = analysis.score;
  $('healthLabel').textContent =
    analysis.score >= 82 ? 'Healthy recording' :
    analysis.score >= 65 ? 'Needs light repair' :
    analysis.score >= 45 ? 'Clear Voice recommended' :
    'Strong cleanup recommended';

  $('healthSummary').textContent = analysis.summary;
  $('issueCount').textContent = `${analysis.issues.length} found`;

  const list = $('issueList');
  list.innerHTML = '';

  if (!analysis.issues.length) {
    list.innerHTML =
      '<div class="issue-empty good">No major technical fault detected. A restrained cleanup can still improve consistency.</div>';
  } else {
    for (const issue of analysis.issues) {
      const el = document.createElement('div');
      el.className = `issue-row severity-${issue.severity}`;
      el.innerHTML =
        `<span class="issue-dot"></span><div><strong>${issue.name}</strong><small>${issue.detail}</small></div><b>${issue.label}</b>`;
      list.appendChild(el);
    }
  }

  repairPanel.classList.remove('hidden');
  scanBtn.textContent = '✓ Scan Complete';
  scanBtn.disabled = false;
  repairPanel.scrollIntoView({behavior:'smooth', block:'center'});
}

async function warmupEngine() {
  if (engineWarmupStarted || engineReady) return;
  engineWarmupStarted = true;

  const status = $('clearEngineStatus');
  if (status) {
    status.textContent = 'DeepFilterNet3 · loading model…';
    status.classList.remove('engine-error');
  }

  try {
    const worker = getDeepFilterWorker();
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('DeepFilterNet3 model warmup timed out.')), 45000);

      const handler = event => {
        const d = event.data || {};
        if (d.type === 'ready') {
          clearTimeout(timeout);
          worker.removeEventListener('message', handler);
          engineReady = true;
          if (status) status.textContent = 'DeepFilterNet3 WASM · Ready';
          resolve();
        }
        if (d.type === 'error') {
          clearTimeout(timeout);
          worker.removeEventListener('message', handler);
          reject(new Error(d.message || 'DeepFilterNet3 could not load'));
        }
      };

      worker.addEventListener('message', handler);
      worker.postMessage({type:'warmup'});
    });
  } catch (error) {
    console.warn(error);
    if (status) {
      status.textContent = 'DeepFilterNet3 · tap Repair to retry';
      status.classList.add('engine-error');
    }
  } finally {
    engineWarmupStarted = false;
  }
}

async function repairLocally() {
  if (!sourceBuffer) return;

  repairBtn.disabled = true;
  repairPanel.classList.add('hidden');
  result.classList.add('hidden');
  processing.classList.remove('hidden');
  processing.scrollIntoView({behavior:'smooth', block:'center'});

  try {
    const amount = Number(strength.value) / 100;
    const settings = mapNoiseStrength(amount);

    setStage('upload');
    updateProgress(4, 'Preparing audio locally. Nothing is being uploaded…');

    const original48 = await resampleAudioBuffer(sourceBuffer, 48000);
    const dryMono = mixToMono(original48);
    const speechMask = buildEnergySpeechMask(dryMono, 48000);

    setStage('model');
    updateProgress(12, 'Loading DeepFilterNet3 full-band speech model…');

    const processed = await processDeepFilter(
      dryMono,
      settings.attenuationLimit,
      settings.postFilterBeta,
      text => updateProgress(24, text)
    );

    setStage('restore');
    updateProgress(62, 'Artifact Guard is smoothing metallic residue…');

    const guardedMono = artifactGuardMono(
      dryMono,
      processed.audio,
      speechMask,
      amount
    );

    let repaired48 = rebuildFromMono(original48, guardedMono);

    updateProgress(72, 'Applying restrained voice finishing…');
    repaired48 = await applyVoiceFinish(repaired48, voiceFinish);

    setStage('level');
    updateProgress(84, 'Balancing spoken-word loudness without lifting the noise floor…');
    await levelToLufsStyle(
      repaired48,
      voiceFinish === 'natural' ? -18.0 :
      voiceFinish === 'studio' ? -16.0 : -16.5,
      -1.2
    );

    let finalBuffer = repaired48;
    if (sourceBuffer.sampleRate !== 48000) {
      finalBuffer = await resampleAudioBuffer(repaired48, sourceBuffer.sampleRate);
    }

    setStage('export');
    updateProgress(95, 'Encoding repaired WAV…');

    const wav = encodeWav(finalBuffer);
    repairedBlob = new Blob([wav], {type:'audio/wav'});

    if (repairedUrl) URL.revokeObjectURL(repairedUrl);
    repairedUrl = URL.createObjectURL(repairedBlob);

    $('afterPlayer').src = repairedUrl;
    $('afterPresetLabel').textContent =
      `Clear Voice · ${Math.round(amount*100)}% · ${capitalize(voiceFinish)} finish`;

    const status = $('clearEngineStatus');
    if (status) {
      status.textContent =
        `DeepFilterNet3 · ${settings.attenuationLimit.toFixed(0)} dB limit · local`;
      status.classList.remove('engine-error');
    }

    updateProgress(100, 'Local Clear Voice repair complete.');
    await tick(240);

    processing.classList.add('hidden');
    result.classList.remove('hidden');
    result.scrollIntoView({behavior:'smooth', block:'start'});
  } catch (error) {
    console.error(error);
    processing.classList.add('hidden');
    repairPanel.classList.remove('hidden');

    const status = $('clearEngineStatus');
    if (status) {
      status.textContent = 'DeepFilterNet3 · could not load';
      status.classList.add('engine-error');
    }

    const detail = String(error?.message || error || '').slice(0,180);
    alert(
      `Clear Voice could not finish. ${detail}\n\n` +
      `No lower-quality fake result was generated. Check internet once for the model download, then retry.`
    );
  } finally {
    repairBtn.disabled = false;
  }
}

function mapNoiseStrength(amount) {
  // Avoid extreme attenuation that creates metallic / musical-noise artifacts.
  // 25% -> ~13 dB, 80% -> ~31 dB, 100% -> ~38 dB.
  const x = Math.max(.25, Math.min(1, amount));
  const attenuationLimit = 5 + 33 * x;
  const postFilterBeta =
    x < .55 ? .002 :
    x < .85 ? .006 : .010;

  return {attenuationLimit, postFilterBeta};
}

function getDeepFilterWorker() {
  if (!dfWorker) {
    dfWorker = new Worker('deepfilter-worker.js?v=14f', {type:'module'});
  }
  return dfWorker;
}

async function processDeepFilter(mono, attenuationLimit, postFilterBeta, onPhase) {
  const worker = getDeepFilterWorker();
  const copy = new Float32Array(mono);

  return await new Promise((resolve, reject) => {
    const handler = event => {
      const d = event.data || {};

      if (d.type === 'phase') {
        onPhase?.(d.text || 'DeepFilterNet3 is processing speech…');
        return;
      }

      if (d.type === 'ready') {
        engineReady = true;
        return;
      }

      if (d.type === 'error') {
        worker.removeEventListener('message', handler);
        reject(new Error(d.message || 'DeepFilterNet3 failed'));
        return;
      }

      if (d.type === 'done') {
        worker.removeEventListener('message', handler);
        engineReady = true;
        resolve({
          audio: new Float32Array(d.buffer),
          stats: d.stats || {}
        });
      }
    };

    worker.addEventListener('message', handler);
    worker.postMessage({
      type:'process',
      buffer:copy.buffer,
      attenuationLimit,
      postFilterBeta
    }, [copy.buffer]);
  });
}

function buildEnergySpeechMask(mono, sampleRate) {
  const frame = Math.max(128, Math.floor(sampleRate * .02));
  const rms = [];

  for (let s=0; s<mono.length; s+=frame) {
    let sum=0, n=0;
    for (let i=s; i<Math.min(s+frame,mono.length); i++) {
      sum += mono[i]*mono[i];
      n++;
    }
    rms.push(Math.sqrt(sum/Math.max(1,n)));
  }

  const sorted=[...rms].sort((a,b)=>a-b);
  const floor=sorted[Math.floor(sorted.length*.24)] || 1e-5;
  const threshold=Math.max(floor*2.8,.0038);
  const raw=new Float32Array(mono.length);

  for (let f=0; f<rms.length; f++) {
    if (rms[f] < threshold) continue;
    const start=f*frame;
    const end=Math.min(mono.length,start+frame);
    for(let i=start;i<end;i++) raw[i]=1;
  }

  // Smooth around speech boundaries (~70 ms) so the mix never chatters.
  const radius=Math.max(1,Math.floor(sampleRate*.07));
  const mask=new Float32Array(mono.length);
  let active=0;

  for(let i=0;i<mono.length;i++){
    if(raw[i]) active=1;
    else active=Math.max(0,active-1/radius);
    mask[i]=Math.max(mask[i],active);
  }
  active=0;
  for(let i=mono.length-1;i>=0;i--){
    if(raw[i]) active=1;
    else active=Math.max(0,active-1/radius);
    mask[i]=Math.max(mask[i],active);
  }

  return mask;
}

function artifactGuardMono(dry, wetInput, speechMask, amount) {
  const wet = ensureLength(wetInput, dry.length);
  const out = new Float32Array(dry.length);

  // Stronger removal can use more of the neural output during silence.
  const speechWet = 0.82 + amount * 0.12;
  const silenceWet = 0.94 + amount * 0.055;

  // Smooth only the neural residual above the main voice band. This specifically
  // targets "jhil-jhil"/musical-noise without low-passing the actual dry voice.
  const cutoff = amount > .85 ? 7200 : amount > .55 ? 8200 : 9200;
  const rc=1/(2*Math.PI*cutoff);
  const dt=1/48000;
  const alpha=dt/(rc+dt);
  let residualLP=0;
  let mix=speechWet;

  const frame=1200; // 25 ms
  for(let start=0; start<dry.length; start+=frame){
    const end=Math.min(dry.length,start+frame);
    let dryPow=1e-10,diffPow=1e-10,speech=0;

    for(let i=start;i<end;i++){
      const diff=wet[i]-dry[i];
      dryPow+=dry[i]*dry[i];
      diffPow+=diff*diff;
      speech+=speechMask[i]||0;
    }

    speech/=Math.max(1,end-start);
    const change=Math.sqrt(diffPow/dryPow);

    let target=speechWet*speech + silenceWet*(1-speech);

    // If the model changed active speech unusually strongly, blend a little
    // natural voice back in instead of accepting a metallic frame.
    if(speech>.35 && change>.80){
      target-=Math.min(.18,(change-.80)*.13);
    }
    target=Math.max(.68,Math.min(.997,target));

    for(let i=start;i<end;i++){
      mix+=(target-mix)*.005;
      const residual=wet[i]-dry[i];
      residualLP+=alpha*(residual-residualLP);

      // Preserve most model correction; soften only the fastest HF residual.
      const smoothResidual=residual*.76 + residualLP*.24;
      out[i]=Math.max(-.999,Math.min(.999,dry[i]+smoothResidual*mix));
    }
  }

  return out;
}

function rebuildFromMono(reference, monoInput) {
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

  // Keep a very small original side signal so stereo recordings do not collapse
  // into an unnaturally hard mono center.
  for(let i=0;i<mono.length;i++){
    const side=(L[i]-R[i])*.04;
    oL[i]=mono[i]+side;
    oR[i]=mono[i]-side;
  }

  for(let c=2;c<reference.numberOfChannels;c++) out.copyToChannel(mono,c);
  return out;
}

async function applyVoiceFinish(buffer, finish) {
  const offline=new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  const src=offline.createBufferSource();
  src.buffer=buffer;

  const hp=offline.createBiquadFilter();
  hp.type='highpass';
  hp.frequency.value=finish==='natural'?62:finish==='studio'?82:72;
  hp.Q.value=.62;

  const mud=offline.createBiquadFilter();
  mud.type='peaking';
  mud.frequency.value=240;
  mud.Q.value=.85;
  mud.gain.value=finish==='natural'?-.25:finish==='studio'?-1.15:-.75;

  const presence=offline.createBiquadFilter();
  presence.type='peaking';
  presence.frequency.value=2850;
  presence.Q.value=.82;
  presence.gain.value=finish==='natural'?.25:finish==='studio'?1.25:.85;

  const air=offline.createBiquadFilter();
  air.type='highshelf';
  air.frequency.value=7000;
  air.gain.value=finish==='natural'?-.10:finish==='studio'?.22:.10;

  const comp=offline.createDynamicsCompressor();
  comp.threshold.value=finish==='natural'?-12:finish==='studio'?-18:-16;
  comp.knee.value=20;
  comp.ratio.value=finish==='natural'?1.25:finish==='studio'?2.05:1.65;
  comp.attack.value=.010;
  comp.release.value=.22;

  src.connect(hp).connect(mud).connect(presence).connect(air).connect(comp).connect(offline.destination);
  src.start();
  return await offline.startRendering();
}

async function levelToLufsStyle(buffer,targetLufs=-16.5,peakCeilingDb=-1.2){
  const weighted=await kWeightBuffer(buffer);
  const block=Math.max(1,Math.floor(weighted.sampleRate*.4));
  const hop=Math.max(1,Math.floor(weighted.sampleRate*.1));
  const powers=[];

  for(let start=0;start+block<=weighted.length;start+=hop){
    let sum=0,n=0;
    for(let c=0;c<weighted.numberOfChannels;c++){
      const d=weighted.getChannelData(c);
      for(let i=start;i<start+block;i++){sum+=d[i]*d[i];n++;}
    }
    const p=sum/Math.max(1,n);
    const l=-.691+10*Math.log10(Math.max(1e-12,p));
    if(l>-70)powers.push(p);
  }

  if(!powers.length)return;

  let mean=powers.reduce((a,b)=>a+b,0)/powers.length;
  let prelim=-.691+10*Math.log10(Math.max(1e-12,mean));
  const relative=prelim-10;
  const gated=powers.filter(p=>(-.691+10*Math.log10(Math.max(1e-12,p)))>relative);
  if(gated.length)mean=gated.reduce((a,b)=>a+b,0)/gated.length;

  const measured=-.691+10*Math.log10(Math.max(1e-12,mean));
  let gainDb=Math.max(-4.5,Math.min(4.5,targetLufs-measured));
  let gain=Math.pow(10,gainDb/20);

  const ceiling=Math.pow(10,peakCeilingDb/20);
  const peak=estimatePeak(buffer);
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
      d[i]=softLimit(d[i]*gain*edge);
    }
  }
}

async function kWeightBuffer(buffer){
  const offline=new OfflineAudioContext(buffer.numberOfChannels,buffer.length,buffer.sampleRate);
  const src=offline.createBufferSource();
  src.buffer=buffer;

  const hp=offline.createBiquadFilter();
  hp.type='highpass';
  hp.frequency.value=38;
  hp.Q.value=.5;

  const shelf=offline.createBiquadFilter();
  shelf.type='highshelf';
  shelf.frequency.value=1682;
  shelf.gain.value=4;

  src.connect(hp).connect(shelf).connect(offline.destination);
  src.start();
  return await offline.startRendering();
}

function estimatePeak(buffer){
  let peak=0;
  for(let c=0;c<buffer.numberOfChannels;c++){
    const d=buffer.getChannelData(c);
    for(let i=0;i<d.length;i++)peak=Math.max(peak,Math.abs(d[i]));
  }
  return peak;
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
    issues.push({name:'Clipping / overload',detail:`About ${clipPct.toFixed(2)}% of sampled peaks are near maximum.`,severity:high?'high':'medium',label:high?'High':'Medium'});
    penalty+=high?22:12;
  }

  if(rmsDb<-28){
    const high=rmsDb<-36;
    issues.push({name:'Voice level is low',detail:`Average level is approximately ${rmsDb.toFixed(1)} dBFS.`,severity:high?'high':'medium',label:high?'High':'Medium'});
    penalty+=high?16:9;
  }

  if(floorDb>-38&&crest<19){
    const high=floorDb>-30;
    issues.push({name:'Background noise floor',detail:`Quiet sections remain around ${floorDb.toFixed(1)} dBFS.`,severity:high?'high':'medium',label:high?'High':'Medium'});
    penalty+=high?20:12;
  }

  const score=Math.max(20,Math.min(98,Math.round(94-penalty)));
  const summary=issues.length
    ? `${issues.length} issue${issues.length===1?'':'s'} detected. DeepFilterNet3 will run locally and Artifact Guard will protect the natural voice.`
    : 'No major technical fault detected. Use a lower Noise Removal setting for the most natural result.';

  return {score,issues,rmsDb,peakDb,floorDb,clipPct};
}

function drawWaveform(buffer,canvas){
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const dpr=Math.min(2,window.devicePixelRatio||1);
  const cssW=canvas.clientWidth||700,cssH=canvas.clientHeight||220;
  canvas.width=Math.floor(cssW*dpr);canvas.height=Math.floor(cssH*dpr);
  ctx.scale(dpr,dpr);ctx.clearRect(0,0,cssW,cssH);

  const grad=ctx.createLinearGradient(0,0,cssW,0);
  grad.addColorStop(0,'#12c9ff');grad.addColorStop(.5,'#4f7dff');grad.addColorStop(1,'#b52cff');
  ctx.strokeStyle=grad;ctx.lineWidth=1.6;ctx.globalAlpha=.9;

  const mono=mixToMono(buffer),mid=cssH/2;
  const step=Math.max(1,Math.floor(mono.length/cssW));
  ctx.beginPath();

  for(let x=0;x<cssW;x++){
    let min=1,max=-1;
    const start=x*step;
    for(let i=start;i<Math.min(start+step,mono.length);i++){
      const v=mono[i];if(v<min)min=v;if(v>max)max=v;
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
  write('RIFF');view.setUint32(o,36+length*blockAlign,true);o+=4;
  write('WAVE');write('fmt ');view.setUint32(o,16,true);o+=4;
  view.setUint16(o,1,true);o+=2;view.setUint16(o,channels,true);o+=2;
  view.setUint32(o,sampleRate,true);o+=4;view.setUint32(o,sampleRate*blockAlign,true);o+=4;
  view.setUint16(o,blockAlign,true);o+=2;view.setUint16(o,16,true);o+=2;
  write('data');view.setUint32(o,length*blockAlign,true);o+=4;

  const data=Array.from({length:channels},(_,c)=>buffer.getChannelData(c));
  for(let i=0;i<length;i++){
    for(let c=0;c<channels;c++){
      const s=Math.max(-1,Math.min(1,data[c][i]));
      view.setInt16(o,s<0?s*0x8000:s*0x7fff,true);o+=2;
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

function softLimit(x){
  if(Math.abs(x)<=.965)return x;
  const sign=Math.sign(x);
  const over=Math.abs(x)-.965;
  return sign*(.965+.035*Math.tanh(over/.035));
}

function setStage(stage){
  const order=['upload','model','restore','level','export'];
  const current=Math.max(0,order.indexOf(stage));
  document.querySelectorAll('#processingStages [data-stage]').forEach(el=>{
    const idx=order.indexOf(el.dataset.stage);
    el.classList.toggle('active',idx===current);
    el.classList.toggle('done',idx<current);
  });
}

function updateProgress(p,text){
  $('processingBar').style.width=`${p}%`;
  $('processingPercent').textContent=`${Math.round(p)}%`;
  $('processingText').textContent=text;
}

function toDb(x){return 20*Math.log10(Math.max(1e-9,x));}
function formatTime(sec){const m=Math.floor(sec/60),s=Math.floor(sec%60);return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}
function formatBytes(n){if(n<1024*1024)return `${(n/1024).toFixed(0)} KB`;return `${(n/1024/1024).toFixed(1)} MB`;}
function capitalize(s){return String(s||'').charAt(0).toUpperCase()+String(s||'').slice(1);}
function tick(ms=0){return new Promise(r=>setTimeout(r,ms));}
