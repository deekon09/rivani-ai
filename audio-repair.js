// RIVANI AI Audio Repair Beta v1
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
const presets = [...document.querySelectorAll('.preset-card')];

let sourceFile = null;
let sourceBuffer = null;
let sourceUrl = null;
let repairedBlob = null;
let repairedUrl = null;
let analysis = null;
let selectedPreset = 'natural';
let voiceLockEnabled = true;
let environmentMode = 'balanced';

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
  const file = [...(e.dataTransfer?.files || [])].find(f => f.type.startsWith('audio/') || /\.(wav|mp3|m4a|aac|ogg|flac)$/i.test(f.name));
  if (file) loadAudioFile(file);
});

presets.forEach(btn => btn.addEventListener('click', () => {
  selectedPreset = btn.dataset.preset || 'natural';
  presets.forEach(p => p.classList.toggle('active', p === btn));
  const defaults = { natural:55, clean:75, studio:88 };
  strength.value = defaults[selectedPreset];
  strengthValue.textContent = `${strength.value}%`;
}));
strength?.addEventListener('input', () => strengthValue.textContent = `${strength.value}%`);


$('voiceLockToggle')?.addEventListener('click', () => {
  voiceLockEnabled = !voiceLockEnabled;
  const btn = $('voiceLockToggle');
  btn.classList.toggle('active', voiceLockEnabled);
  btn.setAttribute('aria-pressed', String(voiceLockEnabled));
  const label = btn.querySelector('b');
  if (label) label.textContent = voiceLockEnabled ? 'ON' : 'OFF';
});

document.querySelectorAll('#environmentOptions button').forEach(btn => {
  btn.addEventListener('click', () => {
    environmentMode = btn.dataset.env || 'balanced';
    document.querySelectorAll('#environmentOptions button').forEach(x => x.classList.toggle('active', x === btn));
  });
});

document.querySelectorAll('[data-pro-preview]').forEach(btn => {
  btn.addEventListener('click', () => $('proPreviewModal')?.classList.remove('hidden'));
});
document.querySelectorAll('[data-close-pro]').forEach(btn => {
  btn.addEventListener('click', () => $('proPreviewModal')?.classList.add('hidden'));
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') $('proPreviewModal')?.classList.add('hidden');
});

scanBtn?.addEventListener('click', runScan);
repairBtn?.addEventListener('click', repairAudio);
$('tryAgainBtn')?.addEventListener('click', () => {
  result.classList.add('hidden');
  repairPanel.classList.remove('hidden');
  repairPanel.scrollIntoView({behavior:'smooth', block:'center'});
});
$('downloadAudioBtn')?.addEventListener('click', () => {
  if (!repairedBlob) return;
  const a = document.createElement('a');
  a.href = repairedUrl;
  const base = (sourceFile?.name || 'rivani-audio').replace(/\.[^.]+$/, '');
  a.download = `${base}-rivani-repaired.wav`;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

async function loadAudioFile(file) {
  try {
    setEditorLoading(true);
    sourceFile = file;
    const arrayBuffer = await file.arrayBuffer();
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    sourceBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    await ctx.close();

    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceUrl = URL.createObjectURL(file);

    $('audioFileName').textContent = file.name;
    $('audioFileDetails').textContent = `${formatBytes(file.size)} · ${sourceBuffer.numberOfChannels === 1 ? 'Mono' : `${sourceBuffer.numberOfChannels} channels`} · ${(sourceBuffer.sampleRate/1000).toFixed(1)} kHz`;
    $('audioDuration').textContent = formatTime(sourceBuffer.duration);
    $('beforePlayer').src = sourceUrl;

    drawWaveform(sourceBuffer, $('waveCanvas'));
    resetAnalysis();
    dropZone.classList.add('hidden');
    editor.classList.remove('hidden');
    editor.scrollIntoView({behavior:'smooth', block:'start'});
  } catch (err) {
    alert('This browser could not decode that audio file. Try WAV, MP3, M4A or OGG in a modern browser.');
    console.error(err);
  } finally {
    setEditorLoading(false);
  }
}

function resetAnalysis() {
  analysis = null;
  $('healthScore').textContent = '--';
  $('healthLabel').textContent = 'Ready to scan';
  $('healthSummary').textContent = 'We’ll inspect level, clipping, low-frequency rumble, hum and background-floor indicators.';
  $('issueCount').textContent = '0 found';
  $('issueList').innerHTML = '<div class="issue-empty">Run the audio scan to see findings.</div>';
  repairPanel.classList.add('hidden');
  result.classList.add('hidden');
}

async function runScan() {
  if (!sourceBuffer) return;
  scanBtn.disabled = true;
  scanBtn.textContent = 'Scanning…';
  await tick(120);

  analysis = analyzeBuffer(sourceBuffer);
  $('healthScore').textContent = analysis.score;
  $('healthLabel').textContent = analysis.score >= 82 ? 'Healthy recording' : analysis.score >= 65 ? 'Needs light repair' : analysis.score >= 45 ? 'Repair recommended' : 'Heavy repair recommended';
  $('healthSummary').textContent = analysis.summary;
  $('issueCount').textContent = `${analysis.issues.length} found`;

  const list = $('issueList');
  list.innerHTML = '';
  if (!analysis.issues.length) {
    list.innerHTML = '<div class="issue-empty good">No major technical issue detected. A light Natural pass may still improve consistency.</div>';
  } else {
    analysis.issues.forEach(issue => {
      const el = document.createElement('div');
      el.className = `issue-row severity-${issue.severity}`;
      el.innerHTML = `<span class="issue-dot"></span><div><strong>${issue.name}</strong><small>${issue.detail}</small></div><b>${issue.label}</b>`;
      list.appendChild(el);
    });
  }

  repairPanel.classList.remove('hidden');
  repairPanel.scrollIntoView({behavior:'smooth', block:'center'});
  scanBtn.textContent = '✓ Scan Complete';
  scanBtn.disabled = false;
}

function analyzeBuffer(buffer) {
  const mono = mixToMono(buffer);
  const sr = buffer.sampleRate;
  const maxSamples = Math.min(mono.length, sr * 120);
  const stride = Math.max(1, Math.floor(maxSamples / 500000));
  let peak = 0, sumSq = 0, count = 0, clipped = 0, diffSq = 0, lowDrift = 0;
  let prev = 0;

  const frameSize = Math.max(128, Math.floor(sr * 0.02));
  const frameRms = [];

  for (let start = 0; start < maxSamples; start += frameSize) {
    let fsq = 0, fn = 0;
    for (let i = start; i < Math.min(start + frameSize, maxSamples); i += stride) {
      const x = mono[i];
      const ax = Math.abs(x);
      peak = Math.max(peak, ax);
      sumSq += x*x;
      diffSq += (x-prev)*(x-prev);
      prev = x;
      if (ax >= 0.985) clipped++;
      fsq += x*x;
      fn++; count++;
    }
    if (fn) frameRms.push(Math.sqrt(fsq/fn));
  }

  const rms = Math.sqrt(sumSq / Math.max(1,count));
  const rmsDb = toDb(rms);
  const peakDb = toDb(peak);
  const clipPct = clipped / Math.max(1,count) * 100;
  const sorted = [...frameRms].sort((a,b)=>a-b);
  const noiseFloor = sorted[Math.floor(sorted.length * 0.2)] || 0;
  const noiseDb = toDb(noiseFloor);
  const crestDb = peakDb - rmsDb;

  const hum50 = goertzelPower(mono, sr, 50, maxSamples);
  const hum60 = goertzelPower(mono, sr, 60, maxSamples);
  const hum100 = goertzelPower(mono, sr, 100, maxSamples);
  const hum120 = goertzelPower(mono, sr, 120, maxSamples);
  const humPower = Math.max(hum50+hum100, hum60+hum120);
  const broadPower = Math.max(1e-12, sumSq/count);
  const humRatio = humPower / broadPower;

  const lowEnergy = bandProxy(mono, sr, 25, 120, maxSamples);
  const midEnergy = bandProxy(mono, sr, 300, 3400, maxSamples);
  const rumbleRatio = lowEnergy / Math.max(1e-12, midEnergy);

  const issues = [];
  let penalty = 0;

  if (clipPct > 0.08) {
    const sev = clipPct > 1 ? 'high' : 'medium';
    issues.push({name:'Clipping / overload', detail:`About ${clipPct.toFixed(2)}% of sampled peaks are near digital maximum.`, severity:sev, label:sev==='high'?'High':'Medium'});
    penalty += sev==='high'?22:12;
  }

  if (rmsDb < -28) {
    const sev = rmsDb < -36 ? 'high' : 'medium';
    issues.push({name:'Voice level is low', detail:`Average level is approximately ${rmsDb.toFixed(1)} dBFS.`, severity:sev, label:sev==='high'?'High':'Medium'});
    penalty += sev==='high'?17:10;
  } else if (rmsDb > -10) {
    issues.push({name:'Recording is very loud', detail:`Average level is approximately ${rmsDb.toFixed(1)} dBFS, leaving limited headroom.`, severity:'medium', label:'Medium'});
    penalty += 10;
  }

  if (noiseDb > -38 && crestDb < 18) {
    const sev = noiseDb > -30 ? 'high' : 'medium';
    issues.push({name:'Background floor / room noise', detail:`Quiet sections remain around ${noiseDb.toFixed(1)} dBFS, suggesting audible room or device noise.`, severity:sev, label:sev==='high'?'High':'Medium'});
    penalty += sev==='high'?18:11;
  }

  if (rumbleRatio > 0.5) {
    const sev = rumbleRatio > 1.2 ? 'high' : 'medium';
    issues.push({name:'Low-frequency rumble', detail:'Extra low-frequency energy may come from handling noise, traffic, fans or mic proximity.', severity:sev, label:sev==='high'?'High':'Medium'});
    penalty += sev==='high'?14:8;
  }

  if (humRatio > 0.018) {
    issues.push({name:'Possible electrical hum', detail:'A narrow 50/60 Hz pattern was detected. The repair pass will apply hum notches.', severity:'medium', label:'Detected'});
    penalty += 8;
  }

  if (crestDb < 7 && rmsDb > -28) {
    issues.push({name:'Limited dynamics', detail:'The recording has a small peak-to-average range and may already be heavily compressed.', severity:'low', label:'Low'});
    penalty += 5;
  }

  const score = Math.max(20, Math.min(98, Math.round(94 - penalty)));
  const summary = issues.length
    ? `${issues.length} issue${issues.length===1?'':'s'} detected. The strongest repair opportunities are ${issues.slice(0,2).map(i=>i.name.toLowerCase()).join(' and ')}.`
    : 'No major technical fault was detected in the sampled signal. Use Natural mode for a gentle consistency pass.';

  return { score, issues, rmsDb, peakDb, noiseDb, clipPct, humRatio, rumbleRatio };
}

async function repairAudio() {
  if (!sourceBuffer) return;
  repairPanel.classList.add('hidden');
  result.classList.add('hidden');
  processing.classList.remove('hidden');
  processing.scrollIntoView({behavior:'smooth', block:'center'});
  setProcessingStage('scan');
  updateProgress(4, 'Preparing local repair engine…');
  await tick(80);

  const s = Number(strength.value)/100;
  const preset = selectedPreset;
  const cfg = {
    natural: { gateDb: 9, highpass:75, presence:1.4, comp:-15, ratio:2.1, humQ:7, bright:0.4 },
    clean:   { gateDb: 16, highpass:90, presence:2.4, comp:-18, ratio:2.8, humQ:9, bright:0.9 },
    studio:  { gateDb: 21, highpass:105,presence:3.3, comp:-20, ratio:3.6, humQ:10,bright:1.4 }
  }[preset];

  // Voice Lock intentionally softens the most aggressive tonal changes.
  if (voiceLockEnabled) {
    cfg.presence *= 0.82;
    cfg.bright *= 0.75;
    cfg.ratio *= 0.92;
  }

  // "Keep the vibe" controls how much room tone the adaptive gate preserves.
  const environmentFactor = environmentMode === 'studio' ? 1.18 : environmentMode === 'natural' ? 0.72 : 1;

  setProcessingStage('scan');
  updateProgress(15, 'Estimating room floor and voice activity…');
  await tick(30);
  const gated = applySoftAdaptiveGate(sourceBuffer, cfg.gateDb * (0.55 + 0.55*s) * environmentFactor);

  setProcessingStage('noise');
  updateProgress(42, 'Reducing rumble, hum and steady noise…');
  const filtered = await processWithOfflineAudio(gated, {
    highpass: cfg.highpass + 20*(s-.5),
    presence: cfg.presence*s,
    bright: cfg.bright*s,
    compressorThreshold: cfg.comp,
    compressorRatio: cfg.ratio,
    humQ: cfg.humQ,
    strength: s
  });

  setProcessingStage('voice');
  updateProgress(68, 'Protecting voice tone and clarity…');
  await tick(90);
  setProcessingStage('level');
  updateProgress(78, 'Balancing voice level and dynamics…');
  normalizeAudioBuffer(filtered, preset === 'studio' ? 0.88 : 0.82);

  setProcessingStage('export');
  updateProgress(91, 'Encoding repaired WAV…');
  const wav = encodeWav(filtered);
  repairedBlob = new Blob([wav], {type:'audio/wav'});
  if (repairedUrl) URL.revokeObjectURL(repairedUrl);
  repairedUrl = URL.createObjectURL(repairedBlob);
  $('afterPlayer').src = repairedUrl;
  $('afterPresetLabel').textContent = `${capitalize(preset)} repair`;

  const gain = preset === 'natural' ? 8 : preset === 'clean' ? 13 : 17;
  $('newHealthScore').textContent = Math.min(99, (analysis?.score || 65) + gain);

  updateProgress(100, 'Repair complete.');
  await tick(250);
  processing.classList.add('hidden');
  result.classList.remove('hidden');
  result.scrollIntoView({behavior:'smooth', block:'start'});
}

function applySoftAdaptiveGate(buffer, reductionDb) {
  const out = cloneAudioBuffer(buffer);
  const sr = buffer.sampleRate;
  const frame = Math.max(128, Math.floor(sr * 0.01));
  const reduction = Math.pow(10, -reductionDb/20);

  for (let c=0; c<buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c);
    const dst = out.getChannelData(c);
    const rmsFrames = [];
    for (let s=0; s<src.length; s+=frame) {
      let sq=0, n=0;
      for (let i=s; i<Math.min(s+frame,src.length); i++) { sq += src[i]*src[i]; n++; }
      rmsFrames.push(Math.sqrt(sq/Math.max(1,n)));
    }
    const sorted=[...rmsFrames].sort((a,b)=>a-b);
    const floor=sorted[Math.floor(sorted.length*.22)] || 0.001;
    const openThreshold = floor * 2.5;
    const fullThreshold = floor * 5.5;
    let smoothGain = 1;

    for (let fi=0; fi<rmsFrames.length; fi++) {
      const r=rmsFrames[fi];
      let target;
      if (r <= openThreshold) target = reduction;
      else if (r >= fullThreshold) target = 1;
      else {
        const t=(r-openThreshold)/(fullThreshold-openThreshold);
        target=reduction+(1-reduction)*(t*t*(3-2*t));
      }
      const coeff = target > smoothGain ? 0.38 : 0.10;
      smoothGain += (target-smoothGain)*coeff;
      const start=fi*frame, end=Math.min(start+frame,src.length);
      for(let i=start;i<end;i++) dst[i]=src[i]*smoothGain;
    }
  }
  return out;
}

async function processWithOfflineAudio(buffer, settings) {
  const offline = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  const src = offline.createBufferSource();
  src.buffer = buffer;

  const hp = offline.createBiquadFilter();
  hp.type='highpass'; hp.frequency.value=Math.max(55, settings.highpass); hp.Q.value=.7;

  const hum50=offline.createBiquadFilter(); hum50.type='notch'; hum50.frequency.value=50; hum50.Q.value=settings.humQ;
  const hum60=offline.createBiquadFilter(); hum60.type='notch'; hum60.frequency.value=60; hum60.Q.value=settings.humQ;
  const hum100=offline.createBiquadFilter(); hum100.type='notch'; hum100.frequency.value=100; hum100.Q.value=settings.humQ*.8;
  const hum120=offline.createBiquadFilter(); hum120.type='notch'; hum120.frequency.value=120; hum120.Q.value=settings.humQ*.8;

  const presence = offline.createBiquadFilter();
  presence.type='peaking'; presence.frequency.value=2900; presence.Q.value=.85; presence.gain.value=settings.presence;

  const air = offline.createBiquadFilter();
  air.type='highshelf'; air.frequency.value=6500; air.gain.value=settings.bright;

  const comp = offline.createDynamicsCompressor();
  comp.threshold.value=settings.compressorThreshold;
  comp.knee.value=18;
  comp.ratio.value=settings.compressorRatio;
  comp.attack.value=.008;
  comp.release.value=.20;

  src.connect(hp).connect(hum50).connect(hum60).connect(hum100).connect(hum120).connect(presence).connect(air).connect(comp).connect(offline.destination);
  src.start();
  return await offline.startRendering();
}

function normalizeAudioBuffer(buffer, targetPeak=.82) {
  let peak=0;
  for(let c=0;c<buffer.numberOfChannels;c++){
    const d=buffer.getChannelData(c);
    for(let i=0;i<d.length;i++) peak=Math.max(peak,Math.abs(d[i]));
  }
  if(peak<1e-6) return;
  const gain=Math.min(4, targetPeak/peak);
  for(let c=0;c<buffer.numberOfChannels;c++){
    const d=buffer.getChannelData(c);
    for(let i=0;i<d.length;i++) d[i]=softLimit(d[i]*gain);
  }
}

function softLimit(x) {
  if (Math.abs(x) <= .96) return x;
  const sign=Math.sign(x);
  const over=Math.abs(x)-.96;
  return sign*(.96 + .04*Math.tanh(over/.04));
}

function cloneAudioBuffer(buffer) {
  const out = new AudioBuffer({length:buffer.length, numberOfChannels:buffer.numberOfChannels, sampleRate:buffer.sampleRate});
  for(let c=0;c<buffer.numberOfChannels;c++) out.copyToChannel(buffer.getChannelData(c), c);
  return out;
}

function mixToMono(buffer) {
  const n=buffer.length, ch=buffer.numberOfChannels;
  const mono=new Float32Array(n);
  for(let c=0;c<ch;c++){
    const d=buffer.getChannelData(c);
    for(let i=0;i<n;i++) mono[i]+=d[i]/ch;
  }
  return mono;
}

function goertzelPower(data, sr, freq, maxSamples) {
  const N=Math.min(maxSamples, Math.floor(sr*30), data.length);
  if(N<64) return 0;
  const stride=Math.max(1,Math.floor(N/120000));
  const w=2*Math.PI*freq/sr;
  const coeff=2*Math.cos(w);
  let s0=0,s1=0,s2=0,count=0;
  for(let i=0;i<N;i+=stride){s0=data[i]+coeff*s1-s2;s2=s1;s1=s0;count++;}
  return (s1*s1+s2*s2-coeff*s1*s2)/Math.max(1,count*count);
}

function bandProxy(data, sr, low, high, maxSamples) {
  const freqs=[low,(low+high)*.35,(low+high)*.55,(low+high)*.75,high];
  return freqs.reduce((sum,f)=>sum+goertzelPower(data,sr,f,maxSamples),0);
}

function encodeWav(buffer) {
  const channels=buffer.numberOfChannels;
  const sampleRate=buffer.sampleRate;
  const length=buffer.length;
  const bytesPerSample=2;
  const blockAlign=channels*bytesPerSample;
  const out=new ArrayBuffer(44+length*blockAlign);
  const view=new DataView(out);
  let o=0;
  const writeStr=s=>{for(let i=0;i<s.length;i++)view.setUint8(o++,s.charCodeAt(i));};
  writeStr('RIFF'); view.setUint32(o,36+length*blockAlign,true);o+=4;
  writeStr('WAVE'); writeStr('fmt '); view.setUint32(o,16,true);o+=4;
  view.setUint16(o,1,true);o+=2; view.setUint16(o,channels,true);o+=2;
  view.setUint32(o,sampleRate,true);o+=4; view.setUint32(o,sampleRate*blockAlign,true);o+=4;
  view.setUint16(o,blockAlign,true);o+=2; view.setUint16(o,16,true);o+=2;
  writeStr('data'); view.setUint32(o,length*blockAlign,true);o+=4;
  const channelData=Array.from({length:channels},(_,c)=>buffer.getChannelData(c));
  for(let i=0;i<length;i++){
    for(let c=0;c<channels;c++){
      const s=Math.max(-1,Math.min(1,channelData[c][i]));
      view.setInt16(o,s<0?s*0x8000:s*0x7fff,true);o+=2;
    }
  }
  return out;
}

function drawWaveform(buffer, canvas) {
  if(!canvas) return;
  const ctx=canvas.getContext('2d');
  const dpr=Math.min(2,window.devicePixelRatio||1);
  const cssW=canvas.clientWidth||700, cssH=canvas.clientHeight||220;
  canvas.width=Math.floor(cssW*dpr); canvas.height=Math.floor(cssH*dpr);
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,cssW,cssH);
  const grad=ctx.createLinearGradient(0,0,cssW,0);
  grad.addColorStop(0,'#12c9ff');grad.addColorStop(.5,'#4f7dff');grad.addColorStop(1,'#b52cff');
  ctx.strokeStyle=grad;ctx.lineWidth=1.6;ctx.globalAlpha=.9;
  const mono=mixToMono(buffer);
  const mid=cssH/2;
  const step=Math.max(1,Math.floor(mono.length/cssW));
  ctx.beginPath();
  for(let x=0;x<cssW;x++){
    let min=1,max=-1;
    const start=x*step;
    for(let i=start;i<Math.min(start+step,mono.length);i++){const v=mono[i];if(v<min)min=v;if(v>max)max=v;}
    ctx.moveTo(x,mid+min*mid*.82);ctx.lineTo(x,mid+max*mid*.82);
  }
  ctx.stroke();
  ctx.globalAlpha=.2;ctx.strokeStyle='#8ba8ff';ctx.beginPath();ctx.moveTo(0,mid);ctx.lineTo(cssW,mid);ctx.stroke();
}

function setProcessingStage(stage) {
  document.querySelectorAll('#processingStages [data-stage]').forEach(el => {
    const names = ['scan','noise','voice','level','export'];
    const current = names.indexOf(stage);
    const idx = names.indexOf(el.dataset.stage);
    el.classList.toggle('active', idx === current);
    el.classList.toggle('done', idx < current);
  });
}

function updateProgress(p,text){
  $('processingBar').style.width=`${p}%`;
  $('processingPercent').textContent=`${Math.round(p)}%`;
  $('processingText').textContent=text;
}
function setEditorLoading(flag){ if(chooseBtn) chooseBtn.disabled=flag; }
function toDb(x){return 20*Math.log10(Math.max(1e-9,x));}
function formatTime(sec){const m=Math.floor(sec/60),s=Math.floor(sec%60);return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}
function formatBytes(n){if(n<1024*1024)return `${(n/1024).toFixed(0)} KB`;return `${(n/1024/1024).toFixed(1)} MB`;}
function capitalize(s){return s.charAt(0).toUpperCase()+s.slice(1);}
function tick(ms=0){return new Promise(r=>setTimeout(r,ms));}
