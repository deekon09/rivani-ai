// RIVANI AI Free Clear Voice - DeepFilterNet3 WebAssembly Worker
// All heavy speech denoising runs on the user's device, not on a RIVANI GPU server.

let denoiser = null;
let currentConfig = null;
let modulePromise = null;

async function loadModule() {
  if (!modulePromise) {
    modulePromise = import("https://cdn.jsdelivr.net/npm/deepfilter-standalone@1.0.2/+esm");
  }
  return modulePromise;
}

async function ensureEngine(attenuationLimit, postFilterBeta) {
  const mod = await loadModule();
  const StandaloneDeepFilter =
    mod.StandaloneDeepFilter ||
    mod.default?.StandaloneDeepFilter ||
    mod.default;

  if (!StandaloneDeepFilter) {
    throw new Error("DeepFilterNet3 browser module was not found.");
  }

  if (!denoiser) {
    self.postMessage({type:"phase", phase:"model", text:"Loading DeepFilterNet3 model into WebAssembly…"});
    denoiser = new StandaloneDeepFilter({
      attenuationLimit,
      postFilterBeta
    });
    await denoiser.initialize();
    currentConfig = {attenuationLimit, postFilterBeta};
    self.postMessage({type:"ready"});
    return denoiser;
  }

  if (currentConfig?.attenuationLimit !== attenuationLimit && typeof denoiser.setAttenuationLimit === "function") {
    denoiser.setAttenuationLimit(attenuationLimit);
  }
  if (currentConfig?.postFilterBeta !== postFilterBeta && typeof denoiser.setPostFilterBeta === "function") {
    denoiser.setPostFilterBeta(postFilterBeta);
  }
  currentConfig = {attenuationLimit, postFilterBeta};
  return denoiser;
}

self.onmessage = async (event) => {
  const data = event.data || {};

  try {
    if (data.type === "warmup") {
      await ensureEngine(20, 0.0);
      return;
    }

    if (data.type !== "process") return;

    const input = new Float32Array(data.buffer);
    const attenuationLimit = Number(data.attenuationLimit || 28);
    const postFilterBeta = Number(data.postFilterBeta || 0.006);

    const engine = await ensureEngine(attenuationLimit, postFilterBeta);

    self.postMessage({
      type:"phase",
      phase:"denoise",
      text:`DeepFilterNet3 is reducing broadband noise (${attenuationLimit.toFixed(0)} dB limit)…`
    });

    const started = performance.now();
    let output;
    let stats = null;

    if (typeof engine.processAudioWithStats === "function") {
      const result = engine.processAudioWithStats(input);
      output = result.audio;
      stats = result.stats || null;
    } else {
      output = engine.processAudio(input);
    }

    const clean = output instanceof Float32Array ? output : new Float32Array(output);
    const elapsedMs = performance.now() - started;

    self.postMessage({
      type:"done",
      buffer:clean.buffer,
      stats:{
        ...(stats || {}),
        browserProcessingMs:elapsedMs,
        attenuationLimit,
        postFilterBeta
      }
    }, [clean.buffer]);
  } catch (error) {
    self.postMessage({
      type:"error",
      message:String(error?.message || error || "DeepFilterNet3 failed")
    });
  }
};
