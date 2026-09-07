# RIVANI AI V38.1 — Next Action + Silence-Cut Safety

Changed site files:
- `gaming-auto-editor.html`
- `gaming-auto-editor.css`
- `gaming-auto-editor.js`

## Fix 1 — clear action after “Analyze & Build Edit Plan”
After analysis the page now shows an **EDIT PLAN READY** action bar with:
- Preview Auto Edit
- Stop Preview
- Edit Plan JSON
- Final Render status (truthfully marked as the next backend stage)

`Preview Auto Edit` starts from the beginning and non-destructively skips linked cuts while keeping gameplay + facecam + optional voice synchronized.

## Fix 2 — important silence-cut safety
V38 could use gameplay audio as a fallback when no separate voice track existed. That can mistake quiet gameplay/loading/stealth scenes for creator silence.

V38.1 behavior:
- Separate voice track loaded → silence cuts can be applied.
- No voice track → gameplay-audio quiet ranges are detected but **protected by default**.
- User can explicitly enable “Use gameplay audio for silence cuts” if their microphone is clearly mixed into the gameplay recording.
- Protected candidates are included separately in the JSON plan.

## Still not faked
Final MP4 rendering, semantic funny/shock/clutch/story detection, true background removal, speech captions and licensed SFX placement still require the next AI/render backend stage.

Existing RIVANI stable tools/models/DSP/inference are untouched.
