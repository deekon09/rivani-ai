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
let neuralEnabled = true;
let neuralWorker = null;
let hybridWorker = null;
let lastEngineReport = [];

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
  document.querySelectorAll('[data-engine-mode]').forEach(card => {
    card.classList.toggle('active', card.dataset.engineMode === selectedPreset);
  });
  const defaults = { natural:42, clean:72, studio:86 };
  strength.value = defaults[selectedPreset];
  strengthValue.textContent = `${strength.value}%`;
}));
strength?.addEventListener('input', () => strengthValue.textContent = `${strength.value}%`);


$('neuralToggle')?.addEventListener('click', () => {
  neuralEnabled = !neuralEnabled;
  const btn = $('neuralToggle');
  btn.classList.toggle('active', neuralEnabled);
  btn.setAttribute('aria-pressed', String(neuralEnabled));
  const label = btn.querySelector('b');
  if (label) label.textContent = neuralEnabled ? 'ON' : 'OFF';
  const status = $('neuralEngineStatus');
  if (status) {
    status.textContent = neuralEnabled ? 'RNNoise · Ready' : 'RNNoise · Bypassed';
    status.classList.toggle('muted', !neuralEnabled);
  }
});

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

    // Free Beta target: more generous than many hosted enhancers, while keeping
    // browser memory/CPU safe enough for local neural processing.
    if (sourceBuffer.duration > 45 * 60) {
      sourceBuffer = null;
      throw new Error('FREE_FILE_LIMIT');
    }

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
    if (String(err?.message || err) === 'FREE_FILE_LIMIT') {
      alert('Free Beta supports files up to 45 minutes. Try a shorter file for now.');
    } else {
      alert('This browser could not decode that audio file. Try WAV, MP3, M4A or OGG in a modern browser.');
    }
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

  repairBtn.disabled = true;
  repairPanel.classList.add('hidden');
  result.classList.add('hidden');
  processing.classList.remove('hidden');
  processing.scrollIntoView({behavior:'smooth', block:'center'});

  try {
    const s = Number(strength.value) / 100;
    const preset = selectedPreset;
    lastEngineReport = [];

    const cfg = {
      natural: {
        highpass:66, presence:0.45, bright:-0.10, comp:-13.5, ratio:1.35,
        humQ:7, gateDb:1.8, targetLufs:-18.0, peakDb:-1.2,
        speechWet:0.58, silenceWet:0.88, residualCutoff:9300
      },
      clean: {
        highpass:80, presence:0.85, bright:0.05, comp:-16.0, ratio:1.75,
        humQ:9, gateDb:3.2, targetLufs:-16.8, peakDb:-1.1,
        speechWet:0.80, silenceWet:0.97, residualCutoff:8200
      },
      studio: {
        highpass:92, presence:1.15, bright:0.12, comp:-18.0, ratio:2.15,
        humQ:10, gateDb:4.0, targetLufs:-16.0, peakDb:-1.0,
        speechWet:0.87, silenceWet:0.985, residualCutoff:7400
      }
    }[preset];

    if (voiceLockEnabled) {
      cfg.presence *= 0.82;
      cfg.bright *= 0.70;
      cfg.speechWet *= preset === 'natural' ? 0.90 : 0.94;
    }

    setProcessingStage('scan');
    updateProgress(3, 'Building a speech map to protect words and consonants…');

    const dry48 = await resampleAudioBuffer(sourceBuffer, 48000);
    const dryMono = mixToMono(dry48);

    let speechSegments = [];
    let vadName = 'Energy VAD';

    if (neuralEnabled) {
      try {
        speechSegments = await detectSpeechSilero(dryMono, 48000, p => {
          updateProgress(4 + p * 8, 'Silero VAD is marking speech boundaries…');
        });
        if (speechSegments.length) {
          vadName = 'Silero VAD';
          lastEngineReport.push('Silero VAD');
        }
      } catch (vadError) {
        console.warn('Silero VAD unavailable; using local VAD:', vadError);
      }
    }

    if (!speechSegments.length) {
      speechSegments = detectSpeechEnergy(dryMono, 48000);
      lastEngineReport.push('Local speech map');
    }

    const speechMask = buildSpeechMask(
      dryMono.length,
      48000,
      speechSegments,
      preset === 'natural' ? 80 : 55
    );

    let working48 = dry48;
    let engineLabel = '';
    let neuralStrength = getNeuralStrength(s, preset, environmentMode);

    setProcessingStage('noise');

    if (!neuralEnabled) {
      updateProgress(15, 'Neural engines bypassed — using restoration DSP only…');
      await tick(80);
      engineLabel = 'Local DSP';
    } else if (preset === 'natural') {
      updateProgress(14, 'Natural mode: running a light RNNoise pass…');
      try {
        working48 = await runRnnoiseInWorker(
          dry48,
          neuralStrength,
          voiceLockEnabled,
          'natural',
          p => updateProgress(
            15 + p * 33,
            p < .55 ? 'Removing steady noise gently…' : 'Keeping the original voice texture…'
          )
        );
        lastEngineReport.push('RNNoise');
        engineLabel = 'RNNoise Light';
      } catch (error) {
        console.warn('RNNoise unavailable:', error);
        engineLabel = 'DSP fallback';
      }
    } else {
      updateProgress(14, `${capitalize(preset)} mode: loading full-band DeepFilterNet3…`);
      try {
        const hybrid = await runHybridWorker({
          mono: dryMono,
          sampleRate: 48000,
          preset,
          strength: s,
          doDeepFilter: true,
          doRestoration: false,
          clipped: (analysis?.clipPct || 0) > 0.06,
          onPhase: ({progress, text}) => {
            updateProgress(14 + progress * 40, text);
          }
        });

        if (hybrid.deepFilterUsed) {
          const wetMono = new Float32Array(hybrid.buffer);
          working48 = rebuildVoiceStereo(dry48, wetMono, preset);
          lastEngineReport.push(...hybrid.engines);
          engineLabel = preset === 'clean' ? 'DeepFilter Hybrid' : 'DeepFilter Studio';
        } else {
          throw new Error('DeepFilterNet3 did not initialize');
        }
      } catch (dfError) {
        console.warn('DeepFilterNet3 unavailable; RNNoise fallback:', dfError);
        updateProgress(28, 'DeepFilterNet3 unavailable — switching to RNNoise fallback…');
        working48 = await runRnnoiseInWorker(
          dry48,
          preset === 'studio' ? 0.82 : 0.70,
          voiceLockEnabled,
          preset,
          p => updateProgress(29 + p * 27, 'Running neural fallback cleanup…')
        );
        lastEngineReport.push('RNNoise fallback');
        engineLabel = 'RNNoise fallback';
      }
    }

    // Artifact Guard: use the speech map + dry reference so a neural engine
    // cannot completely overwrite voiced details. It also smooths the
    // high-frequency residual where metallic "shimmer" is most audible.
    setProcessingStage('voice');
    updateProgress(58, 'Artifact Guard is smoothing metallic residue and protecting speech…');

    working48 = artifactGuardBlend(
      dry48,
      working48,
      speechMask,
      cfg.speechWet,
      cfg.silenceWet,
      cfg.residualCutoff
    );
    lastEngineReport.push('Artifact Guard');

    // Clean and Studio receive restoration AFTER artifact protection.
    if (neuralEnabled && preset !== 'natural') {
      try {
        const restoreMono = mixToMono(working48);
        const restored = await runHybridWorker({
          mono: restoreMono,
          sampleRate: 48000,
          preset,
          strength: s,
          doDeepFilter: false,
          doRestoration: true,
          clipped: (analysis?.clipPct || 0) > 0.06,
          onPhase: ({progress, text}) => {
            updateProgress(60 + progress * 14, text);
          }
        });

        if (restored.restorationUsed) {
          working48 = rebuildVoiceStereo(
            working48,
            new Float32Array(restored.buffer),
            preset,
            0.08
          );
          lastEngineReport.push(...restored.engines);
        }
      } catch (restoreError) {
        console.warn('Optional restoration unavailable:', restoreError);
      }
    }

    // Very gentle room-floor control. The strong gate from older builds was
    // removed because it contributed to pumping / "jhil-jhil" transitions.
    const environmentFactor =
      environmentMode === 'studio' ? 1.10 :
      environmentMode === 'natural' ? 0.55 : 0.82;
    const gateReduction = cfg.gateDb * (0.65 + 0.30 * s) * environmentFactor;
    const gated = applySoftAdaptiveGate(working48, gateReduction);

    updateProgress(76, 'Applying hum control, voice tone and smooth dynamics…');
    const polished = await processWithOfflineAudio(gated, {
      highpass: cfg.highpass,
      presence: cfg.presence,
      bright: cfg.bright,
      compressorThreshold: cfg.comp,
      compressorRatio: cfg.ratio,
      humQ: cfg.humQ,
      strength: s
    });

    setProcessingStage('level');
    updateProgress(84, `Leveling voice near ${cfg.targetLufs.toFixed(1)} LUFS without lifting the noise floor…`);
    await levelToLufsStyle(polished, cfg.targetLufs, cfg.peakDb);
    lastEngineReport.push('LUFS leveler', 'Peak guard');

    let finalBuffer = polished;
    if (polished.sampleRate !== sourceBuffer.sampleRate) {
      finalBuffer = await resampleAudioBuffer(polished, sourceBuffer.sampleRate);
    }

    setProcessingStage('export');
    updateProgress(95, 'Encoding repaired WAV…');
    const wav = encodeWav(finalBuffer);

    repairedBlob = new Blob([wav], {type:'audio/wav'});
    if (repairedUrl) URL.revokeObjectURL(repairedUrl);
    repairedUrl = URL.createObjectURL(repairedBlob);
    $('afterPlayer').src = repairedUrl;

    const engineSummary = unique(lastEngineReport).slice(0, 4).join(' + ');
    $('afterPresetLabel').textContent =
      `${capitalize(preset)} · ${engineLabel}${engineSummary ? ' · ' + engineSummary : ''}`;

    const gain =
      preset === 'natural' ? 8 :
      preset === 'clean' ? 15 : 20;
    $('newHealthScore').textContent = Math.min(99, (analysis?.score || 65) + gain);

    const status = $('neuralEngineStatus');
    if (status) {
      status.textContent = `${vadName} · ${engineLabel}`;
      status.classList.remove('engine-error', 'muted');
    }

    updateProgress(100, 'Smooth Voice repair complete.');
    await tick(250);

    processing.classList.add('hidden');
    result.classList.remove('hidden');
    result.scrollIntoView({behavior:'smooth', block:'start'});
  } catch (error) {
    console.error('Audio repair failed:', error);
    processing.classList.add('hidden');
    repairPanel.classList.remove('hidden');
    const detail = String(error?.message || error || '').slice(0, 140);
    alert(`Audio repair could not finish. ${detail ? 'Error: ' + detail : 'Try a shorter file or a modern Chrome/Edge/Safari browser.'}`);
  } finally {
    repairBtn.disabled = false;
  }
}

function getNeuralStrength(baseStrength, preset, envMode) {
  const base =
    preset === 'natural' ? Math.min(0.58, 0.28 + baseStrength * 0.46) :
    preset === 'clean'  ? Math.min(0.78, 0.50 + baseStrength * 0.35) :
                          Math.min(0.86, 0.55 + baseStrength * 0.34);
  const env =
    envMode === 'natural' ? -0.06 :
    envMode === 'studio' ? 0.03 : 0;
  return Math.max(0.22, Math.min(0.88, base + env));
}

async function detectSpeechSilero(mono, sampleRate, onProgress) {
  onProgress?.(0.04);
  const mod = await import("https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.30/+esm");
  const NonRealTimeVAD = mod.NonRealTimeVAD;
  if (!NonRealTimeVAD) throw new Error("Silero NonRealTimeVAD export unavailable");

  const vad = await NonRealTimeVAD.new({
    model: "v5",
    positiveSpeechThreshold: 0.56,
    negativeSpeechThreshold: 0.34,
    redemptionMs: 320,
    preSpeechPadMs: 90,
    minSpeechMs: 180
  });

  const segments = [];
  let count = 0;
  for await (const seg of vad.run(mono, sampleRate)) {
    const start = Number(seg.start || 0);
    const end = Number(seg.end || start);
    if (end > start) segments.push({startMs:start, endMs:end});
    count++;
    // We cannot know total iterator progress precisely; report model activity,
    // not a fake percentage.
    onProgress?.(Math.min(0.92, 0.12 + count * 0.05));
  }
  onProgress?.(1);
  return segments;
}

function detectSpeechEnergy(mono, sampleRate) {
  const frame = Math.max(128, Math.floor(sampleRate * 0.02));
  const hop = frame;
  const rms = [];

  for (let s=0; s<mono.length; s+=hop) {
    let sum=0, n=0;
    for (let i=s; i<Math.min(s+frame, mono.length); i++) {
      sum += mono[i]*mono[i];
      n++;
    }
    rms.push(Math.sqrt(sum/Math.max(1,n)));
  }

  const sorted = [...rms].sort((a,b)=>a-b);
  const floor = sorted[Math.floor(sorted.length * 0.25)] || 1e-5;
  const threshold = Math.max(floor * 3.0, 0.0045);

  const raw = [];
  let activeStart = -1;
  for (let i=0; i<rms.length; i++) {
    const isSpeech = rms[i] >= threshold;
    if (isSpeech && activeStart < 0) activeStart = i;
    if ((!isSpeech || i === rms.length-1) && activeStart >= 0) {
      const endFrame = isSpeech && i === rms.length-1 ? i+1 : i;
      if (endFrame - activeStart >= 5) {
        raw.push({
          startMs: activeStart * hop / sampleRate * 1000,
          endMs: endFrame * hop / sampleRate * 1000
        });
      }
      activeStart = -1;
    }
  }

  // Merge gaps shorter than 180 ms so the protection mask stays smooth.
  const merged = [];
  for (const seg of raw) {
    const prev = merged[merged.length-1];
    if (prev && seg.startMs - prev.endMs < 180) prev.endMs = seg.endMs;
    else merged.push({...seg});
  }
  return merged;
}

function buildSpeechMask(length, sampleRate, segments, fadeMs=60) {
  const mask = new Float32Array(length);
  const fade = Math.max(1, Math.floor(sampleRate * fadeMs / 1000));

  for (const seg of segments) {
    const start = Math.max(0, Math.floor((seg.startMs/1000)*sampleRate));
    const end = Math.min(length, Math.ceil((seg.endMs/1000)*sampleRate));
    const a = Math.max(0, start - fade);
    const b = Math.min(length, end + fade);

    for (let i=a; i<b; i++) {
      let v = 1;
      if (i < start) v = (i-a) / Math.max(1, start-a);
      else if (i >= end) v = 1 - (i-end) / Math.max(1, b-end);
      v = Math.max(0, Math.min(1, v));
      if (v > mask[i]) mask[i] = v;
    }
  }
  return mask;
}

async function runHybridWorker({mono, sampleRate, preset, strength, doDeepFilter, doRestoration, clipped, onPhase}) {
  if (hybridWorker) {
    try { hybridWorker.terminate(); } catch {}
  }

  hybridWorker = new Worker('hybrid-audio-worker.js?v=13', {type:'module'});
  const input = new Float32Array(mono);

  return await new Promise((resolve, reject) => {
    const cleanup = () => {
      if (hybridWorker) {
        hybridWorker.terminate();
        hybridWorker = null;
      }
    };

    hybridWorker.onmessage = (event) => {
      const d = event.data || {};
      if (d.type === 'phase') {
        onPhase?.(d);
        return;
      }
      if (d.type === 'warning') {
        console.warn(d.code || 'Hybrid warning', d.message || '');
        return;
      }
      if (d.type === 'error') {
        cleanup();
        reject(new Error(d.message || 'Hybrid audio worker failed'));
        return;
      }
      if (d.type === 'done') {
        cleanup();
        resolve(d);
      }
    };

    hybridWorker.onerror = event => {
      cleanup();
      reject(new Error(event.message || 'Hybrid audio worker could not load'));
    };

    hybridWorker.postMessage({
      type:'process',
      monoBuffer:input.buffer,
      sampleRate,
      preset,
      strength,
      doDeepFilter,
      doRestoration,
      clipped
    }, [input.buffer]);
  });
}

function rebuildVoiceStereo(reference, processedMono, preset, sideOverride=null) {
  const channels = reference.numberOfChannels;
  const out = new AudioBuffer({
    length: reference.length,
    numberOfChannels: channels,
    sampleRate: reference.sampleRate
  });

  if (channels === 1) {
    out.copyToChannel(ensureFloatLength(processedMono, reference.length), 0);
    return out;
  }

  const L = reference.getChannelData(0);
  const R = reference.getChannelData(1);
  const mono = ensureFloatLength(processedMono, reference.length);
  const sideAmount = sideOverride ?? (
    preset === 'natural' ? 0.24 :
    preset === 'clean' ? 0.12 : 0.06
  );

  const oL = out.getChannelData(0);
  const oR = out.getChannelData(1);
  for (let i=0; i<reference.length; i++) {
    const side = (L[i] - R[i]) * 0.5 * sideAmount;
    oL[i] = mono[i] + side;
    oR[i] = mono[i] - side;
  }

  // Additional channels (rare for this voice tool) receive the repaired center.
  for (let c=2; c<channels; c++) out.copyToChannel(mono, c);
  return out;
}

function artifactGuardBlend(dryBuffer, wetBuffer, speechMask, speechWet, silenceWet, residualCutoff) {
  const length = Math.min(dryBuffer.length, wetBuffer.length);
  const channels = Math.min(dryBuffer.numberOfChannels, wetBuffer.numberOfChannels);
  const out = new AudioBuffer({
    length,
    numberOfChannels: dryBuffer.numberOfChannels,
    sampleRate: dryBuffer.sampleRate
  });

  const sr = dryBuffer.sampleRate;
  const rc = 1 / (2 * Math.PI * Math.max(3500, residualCutoff));
  const dt = 1 / sr;
  const alpha = dt / (rc + dt);
  const frame = Math.max(128, Math.floor(sr * 0.025));

  for (let c=0; c<dryBuffer.numberOfChannels; c++) {
    const dry = dryBuffer.getChannelData(Math.min(c, dryBuffer.numberOfChannels-1));
    const wet = wetBuffer.getChannelData(Math.min(c, channels-1));
    const dst = out.getChannelData(c);

    let residualLP = 0;
    let smoothWet = speechWet;

    for (let s=0; s<length; s+=frame) {
      const e = Math.min(length, s+frame);
      let dryPow=1e-9, diffPow=1e-9, speech=0;
      for (let i=s; i<e; i++) {
        const d = dry[i];
        const diff = wet[i] - d;
        dryPow += d*d;
        diffPow += diff*diff;
        speech += speechMask[i] || 0;
      }
      speech /= Math.max(1, e-s);
      const changeRatio = Math.sqrt(diffPow / dryPow);

      let targetWet = speechWet * speech + silenceWet * (1-speech);

      // If the neural output changes speech too radically, pull some dry voice
      // back in automatically. This is the core anti-metallic Artifact Guard.
      if (speech > 0.35 && changeRatio > 0.72) {
        const penalty = Math.min(0.24, (changeRatio - 0.72) * 0.20);
        targetWet = Math.max(0.48, targetWet - penalty);
      }

      for (let i=s; i<e; i++) {
        smoothWet += (targetWet - smoothWet) * 0.0065;
        const residual = wet[i] - dry[i];
        residualLP += alpha * (residual - residualLP);

        // Preserve low/mid neural correction but soften rapidly-changing HF
        // residual that tends to be perceived as "jhil-jhil" / shimmer.
        const smoothResidual = residualLP * 0.30 + residual * 0.70;
        const value = dry[i] + smoothResidual * smoothWet;
        dst[i] = Math.max(-0.999, Math.min(0.999, value));
      }
    }
  }
  return out;
}

async function levelToLufsStyle(buffer, targetLufs=-16.8, peakCeilingDb=-1.1) {
  const weighted = await kWeightBuffer(buffer);
  const block = Math.max(1, Math.floor(weighted.sampleRate * 0.4));
  const hop = Math.max(1, Math.floor(weighted.sampleRate * 0.1));
  const powers = [];

  for (let start=0; start+block<=weighted.length; start+=hop) {
    let sum=0, n=0;
    for (let c=0; c<weighted.numberOfChannels; c++) {
      const d=weighted.getChannelData(c);
      for (let i=start; i<start+block; i++) {
        sum += d[i]*d[i];
        n++;
      }
    }
    const p=sum/Math.max(1,n);
    const l=-0.691 + 10*Math.log10(Math.max(1e-12,p));
    if (l > -70) powers.push(p);
  }

  if (!powers.length) return;

  let mean = powers.reduce((a,b)=>a+b,0)/powers.length;
  let preliminary = -0.691 + 10*Math.log10(Math.max(1e-12,mean));
  const relativeGate = preliminary - 10;
  const gated = powers.filter(p => (-0.691 + 10*Math.log10(Math.max(1e-12,p))) > relativeGate);
  if (gated.length) mean = gated.reduce((a,b)=>a+b,0)/gated.length;

  const measured = -0.691 + 10*Math.log10(Math.max(1e-12,mean));
  let gainDb = Math.max(-5.5, Math.min(5.5, targetLufs - measured));
  let gain = Math.pow(10, gainDb/20);

  const ceiling = Math.pow(10, peakCeilingDb/20);
  const tp = estimateTruePeak4x(buffer);
  if (tp * gain > ceiling) gain = ceiling / Math.max(1e-9,tp);

  const fade = Math.min(Math.floor(buffer.sampleRate*0.012), Math.floor(buffer.length/4));
  for (let c=0; c<buffer.numberOfChannels; c++) {
    const d=buffer.getChannelData(c);
    for (let i=0; i<d.length; i++) {
      let edge=1;
      if (fade && i<fade) edge=0.5-0.5*Math.cos(Math.PI*i/fade);
      else if (fade && i>=d.length-fade) {
        const j=d.length-1-i;
        edge=0.5-0.5*Math.cos(Math.PI*Math.max(0,j)/fade);
      }
      d[i]=softLimit(d[i]*gain*edge);
    }
  }
}

async function kWeightBuffer(buffer) {
  const offline = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );
  const src=offline.createBufferSource();
  src.buffer=buffer;

  const hp=offline.createBiquadFilter();
  hp.type='highpass';
  hp.frequency.value=38;
  hp.Q.value=0.50;

  const shelf=offline.createBiquadFilter();
  shelf.type='highshelf';
  shelf.frequency.value=1682;
  shelf.gain.value=4.0;

  src.connect(hp).connect(shelf).connect(offline.destination);
  src.start();
  return await offline.startRendering();
}

function estimateTruePeak4x(buffer) {
  let peak=0;
  for (let c=0; c<buffer.numberOfChannels; c++) {
    const d=buffer.getChannelData(c);
    if (!d.length) continue;
    peak=Math.max(peak,Math.abs(d[0]));
    for (let i=1; i<d.length; i++) {
      const a=d[i-1], b=d[i];
      peak=Math.max(peak,Math.abs(b));
      // 4x linear intersample guard. Not a mastering-certified true-peak
      // meter, but catches many overshoots missed by sample peak alone.
      peak=Math.max(
        peak,
        Math.abs(a+(b-a)*0.25),
        Math.abs(a+(b-a)*0.50),
        Math.abs(a+(b-a)*0.75)
      );
    }
  }
  return peak;
}

function ensureFloatLength(value, length) {
  const src = value instanceof Float32Array ? value : new Float32Array(value || 0);
  if (src.length === length) return src;
  const out = new Float32Array(length);
  out.set(src.subarray(0, Math.min(length, src.length)));
  return out;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

async function runRnnoiseInWorker(buffer, neuralStrength, voiceLock, preset, onProgress) {
  const channels = [];
  const transfers = [];

  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const copy = new Float32Array(buffer.getChannelData(c));
    channels.push(copy.buffer);
    transfers.push(copy.buffer);
  }

  if (neuralWorker) {
    try { neuralWorker.terminate(); } catch {}
  }

  neuralWorker = new Worker('rnnoise-worker.js?v=13', { type: 'module' });

  return await new Promise((resolve, reject) => {
    const cleanup = () => {
      if (neuralWorker) {
        neuralWorker.terminate();
        neuralWorker = null;
      }
    };

    neuralWorker.onmessage = (event) => {
      const data = event.data || {};

      if (data.type === 'progress') {
        onProgress?.(Math.max(0, Math.min(1, Number(data.progress || 0))));
        return;
      }

      if (data.type === 'error') {
        cleanup();
        reject(new Error(data.message || 'RNNoise worker failed'));
        return;
      }

      if (data.type === 'done') {
        try {
          const returned = data.channels || [];
          const out = new AudioBuffer({
            length: new Float32Array(returned[0]).length,
            numberOfChannels: returned.length,
            sampleRate: 48000
          });

          returned.forEach((buf, index) => {
            out.copyToChannel(new Float32Array(buf), index);
          });

          cleanup();
          resolve(out);
        } catch (error) {
          cleanup();
          reject(error);
        }
      }
    };

    neuralWorker.onerror = (event) => {
      cleanup();
      reject(new Error(event.message || 'RNNoise worker could not load'));
    };

    neuralWorker.postMessage({
      type: 'denoise',
      channels,
      strength: neuralStrength,
      voiceLock,
      preset
    }, transfers);
  });
}

async function resampleAudioBuffer(buffer, targetSampleRate) {
  if (buffer.sampleRate === targetSampleRate) return buffer;

  const targetLength = Math.max(
    1,
    Math.ceil(buffer.duration * targetSampleRate)
  );

  const offline = new OfflineAudioContext(
    buffer.numberOfChannels,
    targetLength,
    targetSampleRate
  );

  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();

  return await offline.startRendering();
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
    const openThreshold = floor * 2.15;
    const fullThreshold = floor * 5.1;
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
      const coeff = target > smoothGain ? 0.22 : 0.045;
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

function levelVoiceSmoothly(buffer, targetSpeechDb = -17.5, peakCeilingDb = -1.4) {
  const frameSize = Math.max(256, Math.floor(buffer.sampleRate * 0.02));
  const framePowers = [];

  // Build a mono energy estimate only for level detection.
  for (let start = 0; start < buffer.length; start += frameSize) {
    let sum = 0;
    let count = 0;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const d = buffer.getChannelData(c);
      const end = Math.min(start + frameSize, d.length);
      for (let i = start; i < end; i++) {
        sum += d[i] * d[i];
        count++;
      }
    }
    framePowers.push(sum / Math.max(1, count));
  }

  const rmsFrames = framePowers.map(p => Math.sqrt(Math.max(0, p)));
  const sorted = [...rmsFrames].sort((a,b) => a-b);
  const floor = sorted[Math.floor(sorted.length * 0.22)] || 1e-5;

  // Treat frames clearly above the measured floor as likely speech/activity.
  const active = rmsFrames.filter(r => r > Math.max(floor * 3.2, 0.004));
  const speechRms = active.length
    ? Math.sqrt(active.reduce((s,r) => s + r*r, 0) / active.length)
    : Math.sqrt(rmsFrames.reduce((s,r) => s + r*r, 0) / Math.max(1, rmsFrames.length));

  const currentDb = 20 * Math.log10(Math.max(1e-8, speechRms));
  const wantedGain = Math.pow(10, (targetSpeechDb - currentDb) / 20);

  // Never make a cleanup result massively louder just because quiet sections
  // were suppressed. This was the biggest reason the sample sounded "different"
  // mostly by volume instead of by cleanup.
  let gain = Math.max(0.68, Math.min(1.85, wantedGain));

  let peak = 0;
  for (let c=0; c<buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i=0; i<d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  }

  const peakCeiling = Math.pow(10, peakCeilingDb / 20);
  if (peak > 1e-8 && peak * gain > peakCeiling) {
    gain = peakCeiling / peak;
  }

  // Apply a short cosine fade at the boundaries to avoid clicks after
  // resampling/processing and use the soft limiter only as a last safety net.
  const fadeSamples = Math.min(Math.floor(buffer.sampleRate * 0.012), Math.floor(buffer.length / 4));

  for (let c=0; c<buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i=0; i<d.length; i++) {
      let edge = 1;
      if (fadeSamples > 0 && i < fadeSamples) {
        edge = 0.5 - 0.5 * Math.cos(Math.PI * i / fadeSamples);
      } else if (fadeSamples > 0 && i >= d.length - fadeSamples) {
        const j = d.length - 1 - i;
        edge = 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0,j) / fadeSamples);
      }
      d[i] = softLimit(d[i] * gain * edge);
    }
  }
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
