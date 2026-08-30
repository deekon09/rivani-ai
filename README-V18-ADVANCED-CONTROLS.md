# RIVANI AI V18 — Advanced Controls

V17.1 remains the quality/seam reference.

V18 adds only controls that have real processing behind them.

## Working

Overall Noise
- main AI Enhancement slider

Fan / AC Assist
- slightly stronger AI attenuation in steady low/mid bands only where the AI
  already predicts noise
- automatic 50 Hz vs 60 Hz mains-family detection
- narrow hum harmonic notches
- restrained fan-bed low/mid reduction
- OFF by default

Traffic Assist
- slightly stronger AI attenuation in road/engine bands only where the AI
  already predicts noise
- gentle 78 Hz high-pass
- restrained ~310 Hz road-bed reduction
- OFF by default because this range can overlap male voice body

Click Repair
- ON by default
- detects isolated impulse discontinuities
- repairs them with short interpolation
- does not add another denoising model

Studio Finish
- remains working / ON by default

## Still locked

Background Voices
- requires speech separation / target-speaker processing

Music Control
- requires speech/music source separation

De-Reverb
- requires a validated dedicated dereverberation engine

These remain locked rather than pretending an EQ slider solved the task.

## Default

AI Enhancement: 85%
Studio Finish: ON
Click Repair: ON
Fan / AC Assist: OFF
Traffic Assist: OFF

The existing `rivani-models` Cloudflare Worker does not need any changes.
