// RIVANI AI V16 - Clear Voice X
// MossFormer2_SE_48K ONNX in-browser speech enhancement.
// No server GPU. No RNNoise/DeepFilter stacking. No time-domain dry/wet mix.
//
// Reference pipeline reproduced from audiosronnx / ClearerVoice-Studio:
// 48 kHz, 40 ms Kaldi fbank, 8 ms hop, 60 mels + delta + delta-delta,
// waveform scale x32768, symmetric Hamming, 1920-point non-centred STFT,
// ONNX mask [1,T,961], overlap-add ISTFT.
//
// The model is fetched automatically and cached by the browser. The user never
// needs to manually install/download a model file.

const ORT_VERSION = "1.29.0";
const ORT_URL = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/ort.min.mjs`;
const ORT_WASM_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;

const MODEL_PROXY_URL =
  "https://rivani-models.rivani.workers.dev/mossformer2_48k.onnx";

const MODEL_DIRECT_URL =
  "https://huggingface.co/TigreGotico/audiosronnx-mossformer2/resolve/main/mossformer2_48k.onnx?download=true";

const MODEL_URLS = [MODEL_PROXY_URL, MODEL_DIRECT_URL];

const MODEL_CACHE = "rivani-clear-voice-models-v16";
const SR = 48000;
const WIN = 1920;         // 40 ms
const HOP = 384;          // 8 ms
const FBANK_FFT = 2048;
const NUM_MELS = 60;
const BINS = WIN / 2 + 1; // 961
const MAX_WAV = 32768.0;
const EPS32 = 1.1920928955078125e-7;

// V24.1 Adaptive Performance.
// IMPORTANT: Clear Voice remains the approved single-thread full-WASM
// runtime. Only cooperative scheduling adapts to the device; model/DSP math
// is unchanged.
const RIVANI_PERF = detectAdaptivePerformance();

function detectAdaptivePerformance(){
  const nav=self.navigator||{};
  const cores=Math.max(1,Number(nav.hardwareConcurrency)||4);
  const memory=Number(nav.deviceMemory)||0;
  const ua=String(nav.userAgent||"");
  const mobile=/Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const lowMemory=memory>0&&memory<=4;

  if(!mobile&&!lowMemory&&cores>=8){
    return {
      mode:"fast",
      yieldMs:1,
      frameYieldEvery:64,
      chunkRestMs:3
    };
  }

  if(!mobile&&!lowMemory&&cores>=6){
    return {
      mode:"balanced",
      yieldMs:2,
      frameYieldEvery:32,
      chunkRestMs:8
    };
  }

  return {
    mode:"cool",
    yieldMs:4,
    frameYieldEvery:16,
    chunkRestMs:18
  };
}

const CPU_YIELD_MS=RIVANI_PERF.yieldMs;
const CPU_YIELD_FRAMES=RIVANI_PERF.frameYieldEvery;

function cpuYield(ms=CPU_YIELD_MS){
  if(ms<=0)return Promise.resolve();
  return new Promise(resolve=>setTimeout(resolve,ms));
}

let ort = null;
let session = null;
let provider = null;
let modelPromise = null;
let runtimePromise = null;
let bluestein1920 = null;
let melFilters = null;
let symmetricHamming1920 = null;

self.onmessage = async (event) => {
  const data = event.data || {};

  try {
    if (data.type === "warmup") {
      await ensureSession();
      self.postMessage({type:"ready", provider});
      return;
    }

    if (data.type !== "process") return;

    const input = new Float32Array(data.buffer);
    const strength = Math.max(0.25, Math.min(1, Number(data.strength || 0.85)));
    const assists = {
      fanAssist:Boolean(data.fanAssist),
      trafficAssist:Boolean(data.trafficAssist)
    };

    await ensureSession();
    self.postMessage({
      type:"phase",
      phase:"model",
      text:"RIVANI AI is enhancing the voice…"
    });

    const started = performance.now();
    const output = await denoiseLong(input, strength, assists);
    const elapsedMs = performance.now() - started;

    self.postMessage({
      type:"done",
      provider,
      elapsedMs,
      buffer:output.buffer
    }, [output.buffer]);
  } catch (error) {
    console.error(error);
    self.postMessage({
      type:"error",
      message:String(error?.message || error || "MossFormer2 failed")
    });
  }
};

async function ensureRuntime() {
  if (ort) return ort;

  if (!runtimePromise) {
    runtimePromise = (async () => {
      self.postMessage({type:"phase", phase:"model", text:"Loading RIVANI AI engine…"});
      const mod = await import(ORT_URL);

      mod.env.wasm.wasmPaths = ORT_WASM_BASE;

      // V23.3 stability rollback:
      // Clear Voice's approved browser baseline is full WASM, single-thread.
      // This avoids the SharedArrayBuffer / threaded-WASM initialization hang
      // seen after cross-origin isolation was enabled for the speed experiment.
      // Model weights, DSP, chunking and audio quality are unchanged.
      mod.env.wasm.numThreads = 1;

      ort = mod;
      return ort;
    })();
  }

  return runtimePromise;
}

async function ensureSession() {
  if (session) return session;
  if (modelPromise) return modelPromise;

  modelPromise = (async () => {
    const runtime = await ensureRuntime();
    const modelBytes = await loadModelBytes();

    self.postMessage({
      type:"phase",
      phase:"model",
      text:"Starting RIVANI AI engine…"
    });

    try {
      session = await runtime.InferenceSession.create(modelBytes, {
        executionProviders:["wasm"],
        graphOptimizationLevel:"all",
        executionMode:"sequential",
        preferredOutputLocation:"cpu"
      });
      provider = "wasm-full";
      return session;
    } catch (error) {
      // Do not silently swap to another denoiser. Surface a diagnostic that
      // distinguishes browser-runtime incompatibility from model download.
      const msg = String(error?.message || error || "");
      if (/Cast\(13\)|Could not find an implementation/i.test(msg)) {
        throw new Error(
          "MossFormer2 model loaded correctly, but this browser ONNX runtime " +
          "cannot execute one Cast(13) node in the exported graph. " +
          "This requires a browser-safe MossFormer2 ONNX export, not another noise filter. " +
          "Runtime detail: " + msg
        );
      }
      throw error;
    }
  })();

  try {
    return await modelPromise;
  } catch (e) {
    modelPromise = null;
    throw e;
  }
}

async function loadModelBytes() {
  const cache = "caches" in self ? await caches.open(MODEL_CACHE) : null;

  // Prefer the stable RIVANI proxy cache key so model storage survives source
  // URL changes.
  if (cache) {
    const cached = await cache.match(MODEL_PROXY_URL);
    if (cached) {
      const blob = await cached.blob();
      if (blob.size > 200 * 1024 * 1024) {
        self.postMessage({
          type:"modelProgress",
          cached:true,
          progress:100,
          text:"AI engine loaded from browser cache."
        });
        return await blob.arrayBuffer();
      }
      // Bad/partial cache entry: remove it before retrying.
      try { await cache.delete(MODEL_PROXY_URL); } catch {}
    }
  }

  let lastError = null;

  for (let sourceIndex=0; sourceIndex<MODEL_URLS.length; sourceIndex++) {
    const url = MODEL_URLS[sourceIndex];
    const sourceName = sourceIndex === 0 ? "RIVANI model proxy" : "direct model source";

    self.postMessage({
      type:"modelProgress",
      cached:false,
      progress:0,
      text:`Connecting to ${sourceName}…`
    });

    try {
      const response = await fetchWithTimeout(url, 120000);

      if (!response.ok) {
        throw new Error(`${sourceName} returned HTTP ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";
      const total = Number(response.headers.get("content-length") || 229126935);
      const reader = response.body?.getReader();

      if (!reader) {
        const blob = await response.blob();
        validateModelBlob(blob, sourceName, contentType);

        if (cache) {
          try {
            await cache.put(
              MODEL_PROXY_URL,
              new Response(blob, {
                headers:{
                  "content-type":"application/octet-stream",
                  "content-length":String(blob.size)
                }
              })
            );
          } catch (error) {
            console.warn("Browser model cache unavailable:", error);
          }
        }

        return await blob.arrayBuffer();
      }

      const chunks = [];
      let loaded = 0;
      let lastReport = 0;

      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.byteLength;

        const now = performance.now();
        if (now - lastReport > 180) {
          lastReport = now;
          const pct = Math.max(0, Math.min(99, (loaded / total) * 100));
          self.postMessage({
            type:"modelProgress",
            cached:false,
            progress:pct,
            text:`Loading RIVANI AI engine… ${Math.round(pct)}%`
          });
        }
      }

      const blob = new Blob(chunks, {type:"application/octet-stream"});
      validateModelBlob(blob, sourceName, contentType);

      if (cache) {
        try {
          await cache.put(
            MODEL_PROXY_URL,
            new Response(blob, {
              headers:{
                "content-type":"application/octet-stream",
                "content-length":String(blob.size)
              }
            })
          );
        } catch (error) {
          console.warn("Browser model cache unavailable:", error);
        }
      }

      self.postMessage({
        type:"modelProgress",
        cached:false,
        progress:100,
        text:"RIVANI AI engine ready."
      });

      return await blob.arrayBuffer();
    } catch (error) {
      lastError = error;
      console.warn(`${sourceName} failed`, error);

      self.postMessage({
        type:"sourceFailed",
        source:sourceName,
        text:`${sourceName} failed: ${String(error?.message || error)}`
      });
    }
  }

  throw new Error(
    `AI model could not be fetched. ${String(lastError?.message || lastError || "")} ` +
    `Check that https://rivani-models.rivani.workers.dev/health returns OK.`
  );
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);

  try {
    return await fetch(url, {
      method:"GET",
      mode:"cors",
      cache:"no-store",
      redirect:"follow",
      signal:controller.signal
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("model request timed out");
    }
    throw new Error(`network/CORS fetch failed (${String(error?.message || error)})`);
  } finally {
    clearTimeout(timer);
  }
}

function validateModelBlob(blob, sourceName, contentType) {
  // Official ONNX is 229,126,935 bytes. Leave margin for source metadata but
  // reject HTML error pages / LFS pointer files / truncated responses.
  if (blob.size < 200 * 1024 * 1024) {
    throw new Error(
      `${sourceName} returned only ${(blob.size/1024/1024).toFixed(1)} MB ` +
      `instead of the ~229 MB ONNX model`
    );
  }

  if (/text\/html|application\/json/i.test(contentType)) {
    throw new Error(`${sourceName} returned ${contentType} instead of ONNX bytes`);
  }
}

// ---------------------------------------------------------------------------
// MossFormer2 pipeline
// ---------------------------------------------------------------------------

async function denoiseLong(input, strength, assists={}) {
  const x = sanitize(input);
  if (!x.length) return x;

  prepareDSP();

  const windowSamples = SR * 4; // 4 s model context
  const stride = SR * 3;        // 3 s movement
  const overlap = windowSamples - stride; // 1 s

  if (x.length <= windowSamples) {
    const padded = padSegmentReflect(x, windowSamples);
    const enhanced = await enhanceSegment(padded, strength, assists);
    return enhanced.subarray(0, x.length);
  }

  const positions = [];
  for (let pos=0; pos<x.length; pos+=stride) {
    positions.push(pos);
    if (pos + windowSamples >= x.length) break;
  }

  // Weighted overlap-add instead of a hard 0.5 s discard/switch.
  const sum = new Float64Array(x.length);
  const weight = new Float64Array(x.length);

  for (let s=0; s<positions.length; s++) {
    const pos = positions[s];
    const valid = Math.min(windowSamples, x.length - pos);

    const seg = padSegmentReflect(x.subarray(pos, pos + valid), windowSamples);

    self.postMessage({
      type:"segmentProgress",
      segment:s+1,
      segments:positions.length,
      progress:Math.round((s / positions.length) * 100),
      text:`AI enhancing segment ${s+1} of ${positions.length}…`
    });

    const enhanced = await enhanceSegment(seg, strength, assists);

    for (let i=0; i<valid; i++) {
      const oi = pos + i;
      if (oi >= x.length) break;

      let ww = 1;

      // Equal-power-ish cosine crossfade over the entire 1 s overlap.
      if (s > 0 && i < overlap) {
        const t = i / Math.max(1, overlap - 1);
        ww *= 0.5 - 0.5 * Math.cos(Math.PI * t);
      }

      if (s < positions.length - 1 && i >= stride) {
        const t = (i - stride) / Math.max(1, overlap - 1);
        ww *= 0.5 + 0.5 * Math.cos(Math.PI * t);
      }

      sum[oi] += enhanced[i] * ww;
      weight[oi] += ww;
    }

    if(s<positions.length-1){
      await cpuYield(RIVANI_PERF.chunkRestMs);
    }
  }

  const out = new Float32Array(x.length);
  for (let i=0; i<out.length; i++) {
    if (weight[i] > 1e-9) out[i] = sum[i] / weight[i];
    else out[i] = x[i];
  }

  // Very light seam/tail smoothing only on sample-to-sample discontinuities.
  // This is NOT a noise gate and does not lower quiet words.
  smoothRareDiscontinuities(out);

  self.postMessage({
    type:"segmentProgress",
    segment:positions.length,
    segments:positions.length,
    progress:100,
    text:"AI voice cleanup complete."
  });

  return out;
}

function padSegmentReflect(input, targetLength) {
  const src = input instanceof Float32Array ? input : new Float32Array(input);
  if (src.length >= targetLength) return src.subarray(0, targetLength);

  const out = new Float32Array(targetLength);
  out.set(src);

  if (src.length === 0) return out;
  if (src.length === 1) {
    out.fill(src[0], 1);
    return out;
  }

  // Reflect the last ~600 ms repeatedly rather than appending a sudden wall
  // of zeros. The model gets realistic continuing context near the real tail,
  // while only the original valid portion is ever returned to the user.
  const context = Math.min(src.length, Math.floor(SR * 0.60));
  const contextStart = src.length - context;

  for (let i=src.length; i<targetLength; i++) {
    const p = (i - src.length) % Math.max(2, context * 2 - 2);
    const r = p < context ? p : (context * 2 - 2 - p);
    const idx = Math.max(contextStart, Math.min(src.length - 1, src.length - 1 - r));
    out[i] = src[idx];
  }

  return out;
}

function smoothRareDiscontinuities(audio) {
  if (audio.length < 4) return;

  // Local median-like correction only for extremely abnormal one-sample jumps.
  // Normal consonant attacks are far below this threshold and remain untouched.
  for (let i=2; i<audio.length-2; i++) {
    const jump = Math.abs(audio[i] - audio[i-1]);
    const local =
      (Math.abs(audio[i-1]-audio[i-2]) +
       Math.abs(audio[i+1]-audio[i])) * 0.5;

    if (jump > 0.42 && jump > local * 7) {
      audio[i] = (audio[i-1] + audio[i+1]) * 0.5;
    }
  }
}

async function enhanceSegment(input, strength, assists={}) {
  const scaled = new Float64Array(input.length);
  for (let i=0;i<input.length;i++) scaled[i] = input[i] * MAX_WAV;

  const {features, frames} = await computeFeatures(scaled);
  if (!frames) return new Float32Array(input.length);

  const tensor = new ort.Tensor("float32", features, [1, frames, 180]);
  const feeds = {[session.inputNames[0]]: tensor};
  const results = await session.run(feeds);
  const resultTensor = results[session.outputNames[0]];
  const maskDataRaw = await resultTensor.getData();
  const mask = maskDataRaw instanceof Float32Array
    ? maskDataRaw
    : new Float32Array(maskDataRaw);

  try { resultTensor.dispose?.(); } catch {}
  try { tensor.dispose?.(); } catch {}

  const enhancedScaled = await applyMaskISTFT(scaled, mask, frames, strength, assists);
  const out = new Float32Array(input.length);

  for (let i=0;i<out.length;i++) {
    const y = i < enhancedScaled.length ? enhancedScaled[i] / MAX_WAV : 0;
    out[i] = Number.isFinite(y) ? Math.max(-1, Math.min(1, y)) : 0;
  }

  return out;
}

function prepareDSP() {
  if (!symmetricHamming1920) {
    symmetricHamming1920 = hammingSymmetric(WIN);
  }
  if (!melFilters) {
    melFilters = buildSparseMelFilters(NUM_MELS, FBANK_FFT, SR);
  }
  if (!bluestein1920) {
    bluestein1920 = new BluesteinPlan(WIN);
  }
}

async function computeFeatures(scaled) {
  if (scaled.length < WIN) {
    return {features:new Float32Array(0), frames:0};
  }

  const frames = 1 + Math.floor((scaled.length - WIN) / HOP);
  const mels = new Float32Array(frames * NUM_MELS);

  const frame = new Float64Array(FBANK_FFT);
  const re = new Float64Array(FBANK_FFT);
  const im = new Float64Array(FBANK_FFT);

  for (let t=0; t<frames; t++) {
    const start=t*HOP;

    let mean=0;
    for (let n=0;n<WIN;n++) mean += scaled[start+n];
    mean /= WIN;

    let prev = scaled[start] - mean;
    for (let n=0;n<WIN;n++) {
      const raw = scaled[start+n] - mean;
      const shifted = n===0 ? raw : prev;
      const emphasized = raw - 0.97 * shifted;
      frame[n] = emphasized * symmetricHamming1920[n];
      prev = raw;
    }
    frame.fill(0, WIN);

    re.set(frame);
    im.fill(0);
    fftRadix2(re, im, false);

    for (let m=0;m<NUM_MELS;m++) {
      const filter = melFilters[m];
      let energy=0;
      const weights=filter.weights;

      for (let k=0;k<weights.length;k++) {
        const bin=filter.start+k;
        const power=re[bin]*re[bin]+im[bin]*im[bin];
        energy += power * weights[k];
      }

      mels[t*NUM_MELS+m] = Math.log(Math.max(energy, EPS32));
    }

    if((t+1)%CPU_YIELD_FRAMES===0){
      await cpuYield();
    }
  }

  const d1 = computeDeltas(mels, frames, NUM_MELS);
  const d2 = computeDeltas(d1, frames, NUM_MELS);
  const features = new Float32Array(frames * 180);

  for (let t=0;t<frames;t++) {
    const o=t*180, b=t*NUM_MELS;
    features.set(mels.subarray(b,b+NUM_MELS), o);
    features.set(d1.subarray(b,b+NUM_MELS), o+60);
    features.set(d2.subarray(b,b+NUM_MELS), o+120);
  }

  return {features, frames};
}

async function applyMaskISTFT(scaled, mask, featureFrames, strength, assists={}) {
  const nFrames = Math.min(
    1 + Math.floor((scaled.length - WIN) / HOP),
    featureFrames,
    Math.floor(mask.length / BINS)
  );

  const outLen = WIN + HOP * Math.max(0, nFrames - 1);
  const ola = new Float64Array(Math.max(outLen, scaled.length));
  const winSq = new Float64Array(Math.max(outLen, scaled.length));

  // V17: use the model's own mask confidence to decide how hard to suppress.
  // Speech-like frames keep near-native masks; noise-heavy frames are pushed
  // slightly harder. This avoids globally increasing enhancement strength.
  const baseGamma = 0.52 + 0.55 * strength;
  const maxAttDb = 20 + 31 * strength;
  const maskFloor = Math.pow(10, -maxAttDb / 20);

  // Temporal smoothing of masks reduces flutter / musical residue.
  // Recovery toward speech is faster than movement toward suppression.
  const previous = new Float64Array(BINS);
  previous.fill(1);

  const rawFrame = new Float64Array(BINS);
  const smoothFrame = new Float64Array(BINS);
  const time = new Float64Array(WIN);

  for (let t=0; t<nFrames; t++) {
    const start=t*HOP;

    for (let n=0;n<WIN;n++) {
      time[n] = scaled[start+n] * symmetricHamming1920[n];
    }

    const spec = bluestein1920.forwardReal(time);
    const re = spec.re;
    const im = spec.im;

    const mo=t*BINS;

    // Measure the model mask in the main voice/noise range ~100 Hz–12 kHz.
    let maskSum=0, maskCount=0;
    const lowBin = 4;
    const highBin = Math.min(BINS-1, 480); // ~12 kHz at 48 kHz / 1920 FFT

    for (let f=0;f<BINS;f++) {
      let m=mask[mo+f];
      if (!Number.isFinite(m)) m=1;
      m=Math.max(0,Math.min(1.5,m));
      rawFrame[f]=m;

      if (f>=lowBin && f<=highBin) {
        maskSum += Math.min(1,m);
        maskCount++;
      }
    }

    const meanMask = maskSum / Math.max(1,maskCount);

    // Lower mean mask = model thinks this frame needs more suppression.
    // The extra push is capped and only applied to values below 1.
    let adaptiveBoost = 0;
    if (meanMask < .72) {
      adaptiveBoost = Math.min(.18, (.72-meanMask)*.55);
    }

    const gamma = baseGamma + adaptiveBoost;

    // Light 3-bin frequency smoothing before temporal smoothing.
    for (let f=0;f<BINS;f++) {
      const a=rawFrame[Math.max(0,f-1)];
      const b=rawFrame[f];
      const c=rawFrame[Math.min(BINS-1,f+1)];
      smoothFrame[f]=(a+b*2+c)/4;
    }

    for (let f=0;f<BINS;f++) {
      let m=smoothFrame[f];

      // Attack/release smoothing:
      // if mask opens (speech/detail returns), follow quickly;
      // if mask closes (suppression), move a little slower.
      const prev=previous[f];
      const alpha=m>prev ? .78 : .42;
      m=prev + (m-prev)*alpha;
      previous[f]=m;

      let effective=m;
      if (m<1) {
        let localGamma=gamma;
        const hz=f*SR/WIN;

        // These assists strengthen only frequencies that the main AI already
        // predicts should be attenuated. They do not independently classify
        // or fabricate a removed source.
        if(assists.fanAssist && hz>=70 && hz<=1400){
          localGamma+=.055;
        }

        if(assists.trafficAssist && hz>=55 && hz<=650){
          localGamma+=.045;
        }

        effective=Math.max(maskFloor,Math.pow(m,localGamma));
      }

      re[f]*=effective;
      im[f]*=effective;

      if (f>0 && f<WIN/2) {
        const mirror=WIN-f;
        re[mirror]*=effective;
        im[mirror]*=effective;
      }
    }

    const restored = bluestein1920.inverseComplex(re, im);

    for (let n=0;n<WIN;n++) {
      const idx=start+n;
      const ww=symmetricHamming1920[n];
      ola[idx] += restored[n] * ww;
      winSq[idx] += ww*ww;
    }

    if((t+1)%CPU_YIELD_FRAMES===0){
      await cpuYield();
    }
  }

  const result = new Float32Array(scaled.length);
  for (let i=0;i<result.length;i++) {
    const denom=winSq[i];
    result[i] = denom>1e-11 ? ola[i]/denom : 0;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Exact-ish Kaldi front-end helpers
// ---------------------------------------------------------------------------

function hammingSymmetric(n) {
  const out=new Float64Array(n);
  for(let k=0;k<n;k++) out[k]=0.54-0.46*Math.cos(2*Math.PI*k/(n-1));
  return out;
}

function hzToMel(freq) {
  return 1127 * Math.log(1 + freq / 700);
}

function buildSparseMelFilters(numBins, paddedWindow, sampleRate) {
  const nyquist=sampleRate/2;
  const fftBinWidth=sampleRate/paddedWindow;
  const melLow=hzToMel(20);
  const melHigh=hzToMel(nyquist);
  const delta=(melHigh-melLow)/(numBins+1);
  const filters=[];

  // Kaldi's mel_banks has paddedWindow//2 columns (excludes Nyquist).
  const freqBins=paddedWindow/2;

  for(let b=0;b<numBins;b++) {
    const left=melLow+b*delta;
    const center=melLow+(b+1)*delta;
    const right=melLow+(b+2)*delta;

    let start=-1,end=-1;
    const temp=[];

    for(let k=0;k<freqBins;k++) {
      const mel=hzToMel(fftBinWidth*k);
      const up=(mel-left)/(center-left);
      const down=(right-mel)/(right-center);
      const w=Math.max(0,Math.min(up,down));
      if(w>0) {
        if(start<0) start=k;
        end=k;
        temp.push([k,w]);
      }
    }

    if(start<0) {
      filters.push({start:0,weights:new Float64Array(0)});
      continue;
    }

    const weights=new Float64Array(end-start+1);
    for(const [k,w] of temp) weights[k-start]=w;
    filters.push({start,weights});
  }

  return filters;
}

function computeDeltas(features, frames, channels) {
  if (!frames) return new Float32Array(0);
  const out=new Float32Array(frames*channels);
  const denom=10; // 2*(1^2+2^2)

  for(let t=0;t<frames;t++) {
    const tm2=Math.max(0,t-2), tm1=Math.max(0,t-1);
    const tp1=Math.min(frames-1,t+1), tp2=Math.min(frames-1,t+2);

    for(let c=0;c<channels;c++) {
      out[t*channels+c] =
        (
          (features[tp1*channels+c]-features[tm1*channels+c]) +
          2*(features[tp2*channels+c]-features[tm2*channels+c])
        ) / denom;
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// FFT
// 2048-point radix-2 for Kaldi fbank.
// 1920-point Bluestein FFT for exact MossFormer STFT.
// ---------------------------------------------------------------------------

function fftRadix2(re, im, inverse) {
  const n=re.length;
  if ((n & (n-1)) !== 0) throw new Error("radix2 FFT requires power-of-two length");

  for(let i=1,j=0;i<n;i++) {
    let bit=n>>1;
    for(;j&bit;bit>>=1) j^=bit;
    j^=bit;
    if(i<j) {
      let tr=re[i];re[i]=re[j];re[j]=tr;
      let ti=im[i];im[i]=im[j];im[j]=ti;
    }
  }

  for(let len=2;len<=n;len<<=1) {
    const angle=(inverse?2:-2)*Math.PI/len;
    const wlenR=Math.cos(angle), wlenI=Math.sin(angle);

    for(let i=0;i<n;i+=len) {
      let wr=1,wi=0;
      const half=len>>1;

      for(let j=0;j<half;j++) {
        const uR=re[i+j],uI=im[i+j];
        const vR=re[i+j+half]*wr-im[i+j+half]*wi;
        const vI=re[i+j+half]*wi+im[i+j+half]*wr;

        re[i+j]=uR+vR; im[i+j]=uI+vI;
        re[i+j+half]=uR-vR; im[i+j+half]=uI-vI;

        const nwr=wr*wlenR-wi*wlenI;
        wi=wr*wlenI+wi*wlenR;
        wr=nwr;
      }
    }
  }

  if(inverse) {
    for(let i=0;i<n;i++) {re[i]/=n;im[i]/=n;}
  }
}

class BluesteinPlan {
  constructor(n) {
    this.n=n;
    let m=1;
    while(m<2*n-1)m<<=1;
    this.m=m;

    this.chirpR=new Float64Array(n);
    this.chirpI=new Float64Array(n);

    const bR=new Float64Array(m);
    const bI=new Float64Array(m);

    for(let k=0;k<n;k++) {
      const angle=Math.PI*((k*k)%(2*n))/n;
      const c=Math.cos(angle),s=Math.sin(angle);
      this.chirpR[k]=c;
      this.chirpI[k]=s;

      bR[k]=c;bI[k]=s;
      if(k!==0) {
        bR[m-k]=c;
        bI[m-k]=s;
      }
    }

    fftRadix2(bR,bI,false);
    this.bFftR=bR;
    this.bFftI=bI;
  }

  forwardReal(input) {
    const n=this.n,m=this.m;
    const aR=new Float64Array(m);
    const aI=new Float64Array(m);

    for(let k=0;k<n;k++) {
      const c=this.chirpR[k],s=this.chirpI[k];
      const xr=input[k];
      aR[k]=xr*c;
      aI[k]=-xr*s;
    }

    fftRadix2(aR,aI,false);

    for(let i=0;i<m;i++) {
      const ar=aR[i],ai=aI[i],br=this.bFftR[i],bi=this.bFftI[i];
      aR[i]=ar*br-ai*bi;
      aI[i]=ar*bi+ai*br;
    }

    fftRadix2(aR,aI,true);

    const re=new Float64Array(n);
    const im=new Float64Array(n);
    for(let k=0;k<n;k++) {
      const c=this.chirpR[k],s=this.chirpI[k];
      const ar=aR[k],ai=aI[k];
      re[k]=ar*c+ai*s;
      im[k]=ai*c-ar*s;
    }
    return {re,im};
  }

  forwardComplex(inRe,inIm) {
    const n=this.n,m=this.m;
    const aR=new Float64Array(m);
    const aI=new Float64Array(m);

    for(let k=0;k<n;k++) {
      const c=this.chirpR[k],s=this.chirpI[k];
      const xr=inRe[k],xi=inIm[k];
      aR[k]=xr*c+xi*s;
      aI[k]=xi*c-xr*s;
    }

    fftRadix2(aR,aI,false);

    for(let i=0;i<m;i++) {
      const ar=aR[i],ai=aI[i],br=this.bFftR[i],bi=this.bFftI[i];
      aR[i]=ar*br-ai*bi;
      aI[i]=ar*bi+ai*br;
    }

    fftRadix2(aR,aI,true);

    const re=new Float64Array(n);
    const im=new Float64Array(n);
    for(let k=0;k<n;k++) {
      const c=this.chirpR[k],s=this.chirpI[k];
      const ar=aR[k],ai=aI[k];
      re[k]=ar*c+ai*s;
      im[k]=ai*c-ar*s;
    }
    return {re,im};
  }

  inverseComplex(inRe,inIm) {
    const n=this.n;
    const conjIm=new Float64Array(n);
    for(let i=0;i<n;i++) conjIm[i]=-inIm[i];
    const y=this.forwardComplex(inRe,conjIm);
    const out=new Float64Array(n);
    for(let i=0;i<n;i++) out[i]=y.re[i]/n;
    return out;
  }
}

function sanitize(input) {
  const out=new Float32Array(input.length);
  for(let i=0;i<input.length;i++) {
    const v=input[i];
    out[i]=Number.isFinite(v)?Math.max(-1,Math.min(1,v)):0;
  }
  return out;
}
