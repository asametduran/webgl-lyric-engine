# MEOVV - GO HARD - code lyrics video (fan-made)

Archive / collage kinetic-poster pipeline (Canvas2D, no Three.js): public-domain Muybridge plates and steam-hammer photographs cut into frames and stepped "on twos", typography as the action, ink / bone / paper + one accent (caution yellow `#FFC400`), negative flashes on hits, six chapters.

`npm start` -> http://localhost:8080 (needs internet once for Google Fonts: Anton, Noto Sans KR 900, Space Mono) · `npm run capture` -> `go-hard-meovv-code-mv.mp4` (1080p30, ~25 min; `--crf 18` keeps the grain file size sane) · `node tools/still.mjs 36.3 58.4` -> single PNGs in `tools/stills/`.

## Pipeline
- `audio.mp3` (yt-dlp, youtu.be/8aKR2Ho--5k, 192 s) -> `words.json` (`tools/transcribe.py`, faster-whisper large-v3, language auto; run with `PYTHONUTF8=1` on Windows because of Hangul) -> `lyrics.json` (`tools/make_lyrics_curated.py`; official text was not published at build time, so lines are cleaned by ear and `doubt:true` marks lines to verify; `t`/`end` are final).
- `assets/` (Wikimedia Commons originals, see `assets/CREDITS.md`) -> `tools/prep_archive.py` -> `archive/` (cropped Muybridge frames + industrial plates, ink/bone palette baked in, hot steel tinted yellow).
- `scene.js`: `CHAPTERS` cue sheet + one draw function per chapter; `render(t)` is deterministic. HARD stamps = whisper "hard" word starts + beat-grid fill 128-136.6 s.

## Chapters
I EXPOSURE 0-22 (aperture, slow-mo figure, contact strip develops) · II PRESS 22-48 (slabs close, layout squashed, "fall in love" x3 = 1/2/3 windows, "fall hard" drops the text) · III SMASH 48-69 (every HARD is a die stamp, inversion flash, final full-yellow HARD) · IV COPY 69-112 (ghost trail in the break, windows multiply every line) · V OVERLOAD 112-138 (3 hook passes: 2x2 -> 3x3 -> 5x4, 12/18/24 fps, meter fills and pins) · VI AFTERMATH 138-192 (engraving + backwards counter, reversed last lines, end card + credits).

Keys in the player: Space, arrows, F, `,` `.` `/` lyric offset, D debug.
