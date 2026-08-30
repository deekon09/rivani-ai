# Specialist Pro engine validation

Background Voices:
Use a real two-speaker separation / target-speaker model. Must validate speaker
selection, multilingual speech, overlap, noise and browser runtime.

Music Control:
Use a real speech/vocals-vs-accompaniment separator. Do not imitate this with EQ.

De-Reverb:
Use a dedicated dereverberation/restoration engine. Validate voice identity,
artifacts, memory use and long-file stitching.

Architecture rule:
Each specialist gets its own worker/model/cache route and rollback switch.
Do not place an unvalidated specialist inside the approved Clear Voice worker.
