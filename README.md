# WebGL Lyric Engine

Headless, audio-reactive 3D lyric video rendering engine built with **Three.js**, **Canvas2D**, **Playwright**, and **FFmpeg**.

The whole video is code: no footage, no editor. Lyrics are kinetic typography on a Canvas2D texture composited over a Three.js scene (bloom, aberration, vignette), driven frame by frame by an analysis of the song. Rendering is deterministic: the same song time always produces the same frame.

> Fan-made, non-commercial tributes. Music and lyrics belong to their artists, labels and publishers. This repository ships **no audio or video files**; bring your own `audio.mp3`.

## Architecture pipeline

```
Audio / Whisper Timestamps
        │   analyzer.js (beat grid, kick/bass envelopes)  ·  faster-whisper word timings -> lyrics.json
        ▼
Kinetic Typography & Three.js Scene
        │   typography.js (Canvas2D phrase blocks)  ·  scene.js (WebGL world, post-processing)  ·  timing.js
        ▼
Headless Playwright Capture
        │   ?capture mode: render(t) for every frame, lossless PNG
        ▼
Deterministic FFmpeg 1080p 30fps Output
            libx264 CRF 14, yuv420p, AAC 320k  ->  MP4
```

## Projects

| Folder | What it is |
|---|---|
| [`tralalaManifest/`](tralalaManifest) | manifest – *TRALALA*. The full pipeline: Whisper word timestamps -> curated `lyrics.json`, infinity-mirror neon club corridor, fuchsia-highlighted hook words, Playwright + FFmpeg capture (`capture.mjs`). |
| [`sawadikaLisa/`](sawadikaLisa) | LISA – *SaWaDiKa*. The original: a neon Bangkok street canyon with temple chedis and a wireframe tuk-tuk. Plays live in the browser (optional in-browser `.webm` recording with `R`); no capture script yet. |

## Getting started

Requirements: Node.js 20+, FFmpeg on `PATH`, Python 3.10+ (only for lyric timing), internet on first run (Three.js and Montserrat load from CDNs).

### tralalaManifest

```bash
cd tralalaManifest
npm install
npx playwright install chromium

# put your own audio next to package.json as audio.mp3, then:
npm run serve      # http://localhost:8080/  -> click "TAM EKRAN OYNAT"
npm run capture    # headless render -> tralala-code-mv.mp4 (1920x1080, 30 fps, with audio)
```

Capture options: `node capture.mjs --fps 30 --start 0 --end 30 --nudge 0.2 --crf 14 --out clip.mp4` (use `--start/--end` for a quick preview).

Browser keys: `Space` pause · `←/→` ±5 s · `F` fullscreen · `,` `.` shift lyrics ∓/±0.1 s · `/` reset · `D` debug · `C` copy chapters. URL options: `?t=60`, `?nudge=0.3`, `?q=1.5`.

Lyric timings: `python tools/transcribe.py large-v3 en` (faster-whisper, CPU by default, `WHISPER_DEVICE=cuda` for GPU) then `node tools/make_lyrics.mjs`. The shipped `lyrics.json` is curated (`"curated": true`), so the script refuses to overwrite it without `--force`.

### sawadikaLisa

```bash
cd sawadikaLisa
# put your own audio next to index.html as audio.mp3, then:
python -m http.server 8080     # http://localhost:8080/
```

See [`sawadikaLisa/README.md`](sawadikaLisa/README.md) for controls and URL options.

## Repository layout

```
tralalaManifest/   scene.js  typography.js  timing.js  analyzer.js  main.js  capture.mjs  serve.mjs  tools/
sawadikaLisa/      scene.js  typography.js  timing.js  analyzer.js  main.js  lyrics.json
```

## License / credits

Code: yours to adapt for your own lyric videos. All music, lyrics and artwork remain the property of their respective owners; see the disclaimer above.
