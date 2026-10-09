# True Damage - Know My Name (Worlds 2026) - code lyrics video (fan-made)

Three.js + GLSL + canvas typography, same pipeline as the other Code MVs (`npm start` -> :8080, `npm run capture`, `npm run still -- 12 31 74` for single PNG frames in tools/stills).

- `audio.mp3` (yt-dlp, 256.9 s) -> `words.json` (faster-whisper large-v3, `tools/transcribe.py`) -> `lyrics.json` (`tools/make_lyrics.py`, curated by ear; `doubt:true` = verify vs official text; t/end are final).
- `scene.js`: cue sheet (HEAT/RISE/HEAL/PRISM...) + SHOTS list (hard cut per entry) drive everything; render(t) is deterministic.
- Metaphors: lava-vein obsidian monolith (ignites at 30 s, name resolves), embers that fall then rise, floor cracks that heal into wet glass, Z-Drive prism, speaker towers on the kick, ES/KR/EN graffiti boards, Summoner's-Cup-style trophy landing on the monolith (191-220 s).
