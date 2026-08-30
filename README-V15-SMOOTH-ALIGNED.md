# RIVANI AI V15 — Smooth Aligned Clear Voice

Built after the uploaded V14F output still sounded "fate-fate / phasey / metallic".

Main fixes:
- Automatic DeepFilterNet3 latency measurement and sample alignment before any dry/wet blend.
- Correlation search within +/-45 ms, refined to single-sample alignment.
- If alignment confidence is weak, no artificial shift is applied.
- Default Noise Removal reduced from 80% to 60%.
- Neural attenuation now ranges roughly 10–25 dB instead of 13–38 dB.
- DeepFilter post-filter is OFF for normal settings, tiny only above 90%.
- Speech wet mix reduced to roughly 60–72%; silence can still use 89–96%.
- Transient/consonant protection pulls dry P/T/K/S attacks back in.
- Artifact Guard reacts when neural output changes active speech too strongly.
- Presence/air boosts reduced.
- Compression is slower and gentler to reduce pumping.

Important:
This build intentionally prioritizes smooth natural speech over maximum noise deletion.
For Adobe-Podcast-like restoration on very poor audio, a larger server/GPU model is
still a higher quality route, but this V15 remains zero server-GPU cost.

Deploy:
Replace all website files with V15, Cloudflare deploy, Ctrl+F5, then test the SAME
original noisy sample at the default 60% first.
