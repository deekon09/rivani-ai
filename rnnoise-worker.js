import { Rnnoise } from "https://unpkg.com/@shiguredo/rnnoise-wasm@2025.1.5/dist/rnnoise.js";

let rnnoisePromise;

function getRnnoise() {
  if (!rnnoisePromise) rnnoisePromise = Rnnoise.load();
  return rnnoisePromise;
}

self.onmessage = async (event) => {
  const data = event.data || {};
  if (data.type !== "denoise") return;

  const {
    channels = [],
    strength = 0.72,
    voiceLock = true
  } = data;

  try {
    const rnnoise = await getRnnoise();
    const frameSize = rnnoise.frameSize;
    const totalFrames = channels.reduce(
      (sum, buf) => sum + Math.ceil((buf?.byteLength || 0) / 4 / frameSize),
      0
    );

    let completedFrames = 0;
    const outputs = [];

    for (let channelIndex = 0; channelIndex < channels.length; channelIndex++) {
      const input = new Float32Array(channels[channelIndex]);
      const output = new Float32Array(input.length);
      const state = rnnoise.createDenoiseState();

      try {
        const frame = new Float32Array(frameSize);
        const dry = new Float32Array(frameSize);
        const frameCount = Math.ceil(input.length / frameSize);

        for (let f = 0; f < frameCount; f++) {
          const offset = f * frameSize;
          const remaining = Math.min(frameSize, input.length - offset);

          frame.fill(0);
          dry.fill(0);

          for (let i = 0; i < remaining; i++) {
            const sample = Math.max(-1, Math.min(1, input[offset + i]));
            dry[i] = sample;
            // RNNoise expects float samples in 16-bit PCM amplitude scale.
            frame[i] = sample * 32767;
          }

          const vad = state.processFrame(frame);

          // Smooth wet/dry behavior:
          // - noise-only frames can receive full requested suppression
          // - speech-confident frames stay a little drier when Voice Lock is enabled
          let wet = Math.max(0, Math.min(1, strength));
          if (voiceLock) {
            const speechProtection = 0.48 + 0.52 * (1 - Math.max(0, Math.min(1, vad)));
            wet *= speechProtection;
          }

          // RNNoise has one-frame temporal state. Keep the opening frame mostly dry
          // and ramp in over the first few frames to avoid a hard transition.
          const warmup = Math.min(1, Math.max(0.12, (f + 1) / 5));
          wet *= warmup;

          for (let i = 0; i < remaining; i++) {
            const denoised = Math.max(-1, Math.min(1, frame[i] / 32767));
            let mixed = dry[i] * (1 - wet) + denoised * wet;

            // Very gentle safety limiter, only at extreme peaks.
            if (Math.abs(mixed) > 0.995) mixed = Math.sign(mixed) * 0.995;
            output[offset + i] = mixed;
          }

          completedFrames++;
          if (completedFrames % 120 === 0 || completedFrames === totalFrames) {
            self.postMessage({
              type: "progress",
              progress: totalFrames ? completedFrames / totalFrames : 1
            });
            // Yield inside the worker so progress messages are painted smoothly.
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
      } finally {
        state.destroy();
      }

      outputs.push(output.buffer);
    }

    self.postMessage(
      { type: "done", channels: outputs },
      outputs
    );
  } catch (error) {
    self.postMessage({
      type: "error",
      message: String(error?.message || error || "RNNoise failed")
    });
  }
};
