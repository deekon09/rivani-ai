# RIVANI AI V17 — Studio Quality Experiment

V16.2 remains the stable backup. Do not delete that ZIP/build.

V17 intentionally keeps the SAME working AI enhancement engine and runtime.
It does not go back to RNNoise or DeepFilter.

## User-facing branding

The website does NOT expose:
- model name
- ONNX
- WASM
- internal AI framework

The UI says:
- AI Powered
- RIVANI AI Engine
- AI Clear Voice
- Studio Finish

Technical implementation remains in source/legal engineering records only.

## Changes from V16.2

### 1. Adaptive background suppression

V17 no longer applies exactly the same mask-strength shaping to every frame.

The AI mask itself is inspected:
- speech/detail-heavy frames stay close to the native model mask
- noise-heavy frames get a small additional suppression push

The extra suppression is capped.

### 2. Mask temporal smoothing

Mask recovery is faster when speech/detail returns.
Suppression movement is slower.

Goal:
- less flutter
- less musical residue
- smoother background
- protect consonants

### 3. Studio Finish toggle

Default ON.

Studio Finish does NOT add another denoiser.

It adds only restrained presentation processing:
- high-pass cleanup
- adaptive low-mid control
- adaptive voice body
- mild presence shaping
- gentle high-frequency harshness reduction
- 1.28:1 compression
- final voice level target around -18 dB active RMS
- -1.2 dBFS peak ceiling

OFF = Natural Finish:
- simple 62 Hz high-pass
- very gentle 1.15:1 dynamics
- slightly calmer level target

### 4. Loudness

The supplied comparison measured approximately:
- Adobe total RMS: -24.0 dBFS
- RIVANI V16.2 total RMS: -18.3 dBFS

V17 reduces the finishing target by about 1 dB versus V16.2.
It does NOT force RIVANI down to Adobe's level because louder/softer alone
is not a quality metric.

For fair Adobe-vs-RIVANI evaluation, volume-match the samples before judging.

## Pro Noise Mixer

Only Overall Noise is connected to the current enhancement path.

Keep these locked until specialist engines exist:
- Fan / AC
- Traffic
- Background Voices
- Music Control
- De-Reverb
- Click Repair

No fake sliders.

## Testing

First test:
- same source recording
- Enhancement 85%
- Studio Finish ON

Then test:
- same source
- Enhancement 85%
- Studio Finish OFF

Send both if possible.

Do not overwrite the stable V16.2 backup until V17 wins the A/B comparison.
