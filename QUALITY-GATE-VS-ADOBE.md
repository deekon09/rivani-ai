# RIVANI Clear Voice X — Adobe-beating Quality Gate

Do not optimize by guessing anymore.

Use the same source clips through:
A) Original
B) Adobe Podcast Enhance Speech v2
C) RIVANI Clear Voice X

Blind the filenames before listening.

## Minimum test set

At least 20 clips:
- fan / AC
- traffic
- wind
- hiss
- hum
- keyboard / clicks
- room echo
- stairwell / strong reverb
- distant microphone
- low voice level
- phone / codec damage
- café / crowd
- changing background noise
- background music
- second speaker in background
- plosives
- harsh sibilance
- clipped speech
- clean studio reference
- Hindi / Hinglish speech

## Human score (1–5 each)

1. Voice naturalness
2. Noise removal
3. Word clarity
4. Voice body / fullness
5. S / T / K smoothness
6. No metallic "jhil-jhil"
7. No broken "fate-fate" texture
8. No pumping
9. No changing voice color
10. Overall preference

## Pass target

Do NOT call RIVANI "better than Adobe" because of one clip.

Initial launch-quality target:
- RIVANI preferred overall on >= 60% of the blind clips
- no severe artifact on any normal speech clip
- background noise materially lower than original
- naturalness score >= Adobe average
- no mode that silently falls back to another engine

If RIVANI loses on a category, add a specialist engine only for that detected defect.

Examples:
- reverb loss -> de-reverb model
- background music -> source separation
- overlapping people -> target speaker separation
- damaged/muffled speech -> restoration / super-resolution

Do not stack every model on every file.
