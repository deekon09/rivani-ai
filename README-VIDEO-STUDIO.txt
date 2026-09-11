RIVANI VIDEO STUDIO V45.6 — CONNECTED SUBJECT MATTE

GOAL
Close the visible gap with Cutout.pro without changing the proven V45.5 model
or the working native VP9 alpha exporter.

WHAT CHANGED

1) CLASS 5 HARD DELETE IS REMOVED
V45.5 deleted multiclass category 5 ("others/accessories") everywhere.
That caused holes through footballs / phones / bags / objects held in front of
the body.

V45.6 preserves category-5 pixels ONLY when they are touching or immediately
adjacent to real human classes (hair, skin, face, clothes).
Independent background objects are still suppressed.

2) CONNECTED-SUBJECT SUPPORT
The engine creates a fast expanded support map around human classes.
Held / worn / touching foreground can join the subject.
Unrelated distant objects cannot.

3) COLOR-AWARE EDGE MATTE
Uncertain edge alpha is refined with a lightweight 3x3 RGB-guided filter.
Neighbouring pixels with similar source colour influence the matte more than
different-colour background pixels.
This reduces jagged edges, coloured fringe and excess soft alpha.

4) LESS SEMI-TRANSPARENT FRINGE
The matte transition is narrower and default Feather is reduced to 0.35px.
This targets the higher semi-transparent-edge ratio seen in the RIVANI output.

5) BETTER MOTION TEMPORAL
Background release is faster than foreground acquisition.
This reduces trails behind moving arms / shoulders / legs without destabilizing
the main person core.

UNCHANGED / PRESERVED
- same stable Selfie Multiclass model
- same V45.5 native WebCodecs + Mediabunny VP9 alpha export
- transparent never silently becomes Studio gradient
- Choose Another Video / Clear Video
- face-only glow
- subject-only Studio Light
- inversion safety guard

CACHE BREAK
New engine file:
  video-studio-v456.js

VERIFY
Page must show:
  V45.6 ENGINE ACTIVE · connected-subject matte + native VP9 alpha loaded

TEST
Use the same soccer sample and compare against Cutout.pro at 0.5s / 1.5s /
2.5s / 3.5s / 4.5s.

Look for:
- no torso holes behind held football
- football/held object preserved only when attached to the human
- cleaner hair and shoulder edge
- less semi-transparent fringe
- less motion trail
- isolated background still removed
- transparent export still works
