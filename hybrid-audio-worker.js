// RIVANI AI V13 - hybrid neural/restoration worker
// Heavy processing stays off the UI thread.

const DFN_ESM = "https://cdn.jsdelivr.net/npm/deepfilter-standalone@1.0.2/+esm";
const RESTORE_ESM = "https://cdn.jsdelivr.net/npm/@audio/denoise@0.3.7/+esm";

let dfModulePromise = null;
let restoreModulePromise = null;

function getDFModule() {
  if (!dfModulePromise) dfModulePromise = import(DFN_ESM);
  return dfModulePromise;
}
function getRestoreModule() {
  if (!restoreModulePromise) restoreModulePromise = import(RESTORE_ESM);
  return restoreModulePromise;
}

self.onmessage = async (event) => {
  const d = event.data || {};
  if (d.type !== "process") return;

  const input = new Float32Array(d.monoBuffer);
  const {
    preset = "clean",
    strength = 0.75,
    sampleRate = 48000,
    doDeepFilter = true,
    doRestoration = true,
    clipped = false
  } = d;

  try {
    let out = new Float32Array(input);
    let deepFilterUsed = false;
    let restorationUsed = false;
    const engines = [];

    if (doDeepFilter) {
      self.postMessage({type:"phase", progress:0.12, text:"Loading DeepFilterNet3 full-band model…"});
      try {
        const mod = await getDFModule();
        const StandaloneDeepFilter = mod.StandaloneDeepFilter || mod.default?.StandaloneDeepFilter || mod.default;
        if (!StandaloneDeepFilter) throw new Error("DeepFilterNet3 export not found");

        const attenuationLimit =
          preset === "studio" ? 30 + 16 * strength :
          preset === "clean"  ? 18 + 14 * strength :
                                12 + 8 * strength;
        const postFilterBeta =
          preset === "studio" ? 0.018 :
          preset === "clean"  ? 0.010 : 0.004;

        const denoiser = new StandaloneDeepFilter({
          attenuationLimit,
          postFilterBeta
        });

        await denoiser.initialize();
        self.postMessage({type:"phase", progress:0.27, text:"DeepFilterNet3 is separating voice from broadband noise…"});

        const processed = denoiser.processAudio(out);
        out = ensureLength(processed, input.length);

        try { denoiser.destroy(); } catch {}
        deepFilterUsed = true;
        engines.push("DeepFilterNet3");
        self.postMessage({type:"phase", progress:0.62, text:"Full-band neural cleanup complete."});
      } catch (err) {
        self.postMessage({
          type:"warning",
          code:"DFN_UNAVAILABLE",
          message:String(err?.message || err || "DeepFilterNet3 unavailable")
        });
      }
    }

    if (doRestoration) {
      self.postMessage({type:"phase", progress:0.68, text:"Running voice restoration and artifact control…"});
      try {
        const restore = await getRestoreModule();
        let x = out;

        // Only repair clipping when the scanner actually found clipping.
        if (clipped && typeof restore.declip === "function") {
          x = restore.declip(x, { fs: sampleRate });
          engines.push("De-clip");
        }

        // Conservative transient repair. The detectors only act when their
        // target event is present, so consonants are preserved better.
        if (preset !== "natural" && typeof restore.deplosive === "function") {
          x = restore.deplosive(x, {
            fs: sampleRate,
            triggerRatio: preset === "studio" ? 4.4 : 4.9,
            attenuation: preset === "studio" ? -12 : -8,
            crossover: 190,
            attack: 0.004,
            release: 0.085
          });
          engines.push("De-plosive");
        }

        if (preset === "studio" && typeof restore.declick === "function") {
          x = restore.declick(x, {
            fs: sampleRate,
            threshold: 5.3,
            order: 50,
            guard: 2,
            maxBurst: 32
          });
          engines.push("De-click");
        }

        if (preset !== "natural" && typeof restore.deesser === "function") {
          x = restore.deesser(x, {
            fs: sampleRate,
            freq: preset === "studio" ? 6100 : 6500,
            threshold: preset === "studio" ? -27 : -25,
            ratio: preset === "studio" ? 3.2 : 2.2,
            attack: 0.0015,
            release: 0.065,
            Q: 1.25,
            block: 96
          });
          engines.push("De-esser");
        }

        // Moderate dereverb only. Heavy dereverb is intentionally avoided
        // because it can create metallic tails on single-channel recordings.
        if (preset === "studio" && typeof restore.dereverb === "function") {
          x = restore.dereverb(x, {
            fs: sampleRate,
            t60: 0.38,
            predelay: 0.035,
            alpha: 1.12,
            alphaDD: 0.985,
            gMin: 0.22
          });
          engines.push("De-reverb");
        }

        if (preset === "studio" && typeof restore.debreath === "function") {
          x = restore.debreath(x, {
            fs: sampleRate,
            range: -5.5
          });
          engines.push("Breath control");
        }

        out = ensureLength(x, input.length);
        restorationUsed = true;
      } catch (err) {
        self.postMessage({
          type:"warning",
          code:"RESTORE_UNAVAILABLE",
          message:String(err?.message || err || "Restoration package unavailable")
        });
      }
    }

    self.postMessage({
      type:"done",
      buffer:out.buffer,
      deepFilterUsed,
      restorationUsed,
      engines
    }, [out.buffer]);
  } catch (error) {
    self.postMessage({
      type:"error",
      message:String(error?.message || error || "Hybrid worker failed")
    });
  }
};

function ensureLength(value, wanted) {
  const src = value instanceof Float32Array ? value : new Float32Array(value || 0);
  if (src.length === wanted) return src;
  const out = new Float32Array(wanted);
  out.set(src.subarray(0, Math.min(src.length, wanted)));
  return out;
}
