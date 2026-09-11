RIVANI VIDEO STUDIO V45.1 — CATEGORY MASK ONLY

V45.0 stopped because this browser returned one confidence mask. That is allowed. V45.1 removes confidence masks from foreground removal.

Cutout engine:
- outputCategoryMask=true
- outputConfidenceMasks=false
- official binary mapping: 0=background, 1=person
- any non-zero category is retained as person
- no confidence-channel assumptions
- no polarity guessing
- impossible almost-full-frame masks stop instead of producing an inverted result

CACHE BREAK: upload video-studio-v451.js with this exact filename.
Verify UI says: V45.1 JS ACTIVE · category-mask engine loaded.
Test Studio preview before export.
