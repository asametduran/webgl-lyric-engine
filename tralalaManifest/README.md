# manifest – TRALALA · fan-made lyrics video (all code)

Three.js infinity-mirror club corridor (deep purple/black, cyan + neon fuchsia) + canvas kinetic typography (Montserrat Bold), driven by an analysis of `audio.mp3`. Deterministic: same time → same frame. No shake, no strobe. Fan-made, non-commercial; music © manifest / label.

```bash
npm start            # http://localhost:8080/  (first run needs internet: three.js + font)
npm run capture      # lossless 1080p MP4 -> tralala-code-mv.mp4 (Playwright + FFmpeg)
```

Keys: `Space` pause · `←/→` ±5 s · `F` fullscreen · `,` / `.` lyric offset ∓/±0.1 s · `/` reset offset · `D` debug · `C` copy chapters.
URL: `?t=60` start at 1:00 · `?nudge=0.3` offset · `?q=1.5` supersample.
Capture options: `node capture.mjs --fps 60 --start 0 --end 30 --nudge 0.2 --crf 12 --out x.mp4`.

Lyrics: `lyrics.json` is **curated** (official text on final timings, `"curated": true`; `make_lyrics.mjs` refuses to overwrite it unless `--force`). Format: (phrase blocks `{t,end,text}`, `\n` = row break). Regenerate: `python tools/transcribe.py large-v3 en` then `node tools/make_lyrics.mjs`
(faster-whisper, CPU by default; `WHISPER_DEVICE=cuda` for GPU). Highlight words are set in `timing.js` (`HIGHLIGHT`).
