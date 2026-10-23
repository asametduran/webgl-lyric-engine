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
| [`knowMyNameTrueDamage/`](knowMyNameTrueDamage) | True Damage – *Know My Name* (Worlds 2026 anthem). A directed cyberpunk arena instead of a tunnel: a lava-veined obsidian **monolith** that ignites on the hook, a neon **Z-Drive prism** throwing refracted beams, kick-pumped speaker towers, ES/KR graffiti billboards and a holographic Summoner's-Cup-style trophy that lands on the monolith for the finale. Dynamic **director's cut** (15 hard cuts, kick punch and Dutch tilt, glitch on every cut). |
| [`goHardMeovv/`](goHardMeovv) | MEOVV – *GO HARD* (module 4: **Canvas2D Kinetic Collage Engine**). No 3D world: public-domain Muybridge plates and steam-hammer photographs are cut into frames and stepped "on twos", with film grain, shutter flicker and negative flashes. Typography is the action: a hydraulic press squashes the layout, every HARD is a die stamp, windows multiply, and each hook pass gets a bigger grid. Strict palette (ink / bone / paper + caution yellow), bilingual KR/EN poster type, six chapters. |
| [`unloveuKatseye/`](unloveuKatseye) | KATSEYE – *Unloveu* (module 5: **Frosted-Glass / Prismatic Editorial Engine**). Canvas2D only, no footage and no generated media. Backdrop-blurred glass panels hug each lyric line, a rotating glass prism throws spectral beams on the choruses (a notch bigger each pass), the bridge cracks into drifting shards, and a chrome bead necklace lights up in verse II. Palette: night `#0A1230`, ice `#BFE3FF`, bone `#F2EEE6`, lilac `#B9A6FF`, with negative (difference) flashes on chapter cuts. Seven chapters; fonts are self-hosted. |
| [`firestarterKDA/`](firestarterKDA) | K/DA – *FIRESTARTER* (module 6: **Line Distribution + Karaoke Visualizer**). Canvas2D only, no footage and no generated media. A live HUD tracks each singer's cumulative seconds and share (Miyeon / Soyeon / Sophie Powers / Mimi Webb, colour-coded to Ahri / Akali / Evelynn / Kai'Sa) with a glow pulse on whoever is singing; lyrics fill word by word (karaoke sweep) with Hangul over romanization; the backdrop is reactive neon smoke, a beat grid, CRT scanlines, kick-triggered ember sparks and glitch slices, and the outro shows a **Final Line Distribution** ranking. Palette: obsidian `#08080C`, magenta `#FF0055`, acid `#00FF88`, violet `#9D00FF`, cobalt `#00D4FF`, gold `#FFD700`, ember `#FF5500`. Fonts are self-hosted. |
| [`expectationsOlivia/`](expectationsOlivia) | Olivia Rodrigo ft. Chappell Roan – *expectations* (module 7: **"The Big Expectations Show" TV Game-Show Engine**). Canvas2D only, no footage and no generated media. A 1970s/80s game-show set (sunburst, bulb marquee, LED scoreboard that scores each singer by sung time) crossed with a Y2K riot-grrrl zine (gold tape stickers on the key words, marker scrawls). Hook words fire reactive buzzers: a pink **STRIKE** X on FAKE JOB / PASSIVE, a gold **DING! SURVEY SAYS** on EXPECTATIONS. The host skits are rendered as analog TV: SMPTE colour bars, static, vertical-hold roll, host chyrons, contestant cards and a survey board; the bridge splits the screen purple / pink. Palette: CRT black `#0F0F14`, Olivia purple `#8A2BE2`/`#5B18A7`, Chappell pink `#FF1493`/`#E6005C`, gold `#FFD700`, cyan `#00F5FF`. Fonts are self-hosted. |
| [`tarantinoLisa/`](tarantinoLisa) | LISA – *Tarantino* (module 8: **1970s Grindhouse / Pulp Cinema Engine**). Canvas2D only, no footage and no generated media. Everything is shot through a 2.39:1 scope letterbox with procedural 35mm grain, dust and scratches, gate weave, film slip and projector flicker. The intro skit plays as yellow/cream cinematic subtitles over a film leader; the three choruses are Kill Bill sunburst title cards that escalate (one, two, three slanted split-screen panels), the pre-choruses are *Death Proof* split screens that punch apart on the kick, verse 1 is a motel-neon night, verse 2 a desert sunset with katana slashes, the outro a Hollywood-sign sunset, and the tail is a scrolling end-credits roll plus a retro **FIN** card. Every cut gets an angular wipe, film burn and negative flash. Palette: Kill Bill yellow `#FFE800`, blood red `#D00000`, film black `#0D0C0C`, desert cream `#F4ECD8`. Eight chapters; fonts are self-hosted. |
| [`deserveBaemon/`](deserveBaemon) | BABYMONSTER – *DESERVE* (module 9: **Line Distribution Dashboard + Messenger Bubble Lyrics**). Canvas2D only. Three zones: a left HUD where six rounded avatars (Ruka, Pharita, Asa, Ahyeon, Rora, Chiquita) each get a live pill bar, seconds and share of the song with a glow pulse on whoever is singing; a centre iMessage/DM-style chat where every lyric line arrives as a bubble (a "…" typing indicator 0.4 s ahead, Hangul over romanization, duets as overlapping avatars on a two-colour gradient, each chorus repeat a notch bigger and kick-reactive); and a right column with a Now Playing card, a rounded MV window and a crossfading vocalist spotlight. The outro locks the bars and opens a centred **Final Line Distribution** card. Palette: ink `#0E0F14` + the six member pastels. Member photos go in `assets/members/<name>.png` (procedural silhouette fallback if missing); an optional `assets/mv.webm` clip plays in the MV window (all-intra VP9, frame-seeked during capture; none shipped). |
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

### knowMyNameTrueDamage

Same stack and keys as `tralalaManifest`. What is different:

- **Architecture:** `scene.js` is driven by a cue sheet (`HEAT`, `RISE`, `HEAL`, `PRISM`: vein ignition, ember direction, floor healing, prism glow) and a `SHOTS` list in which every entry is a hard cut (`lerp` or `orbit` move, easing, kick `punch`). On every kick the camera gets a small FOV/dolly punch and a ~1° tilt; each cut triggers a short glitch burst. Post: bloom, kick-reactive chromatic aberration, grain, vignette. Everything is procedural (no models or textures), so the repo stays asset-free.
- **Lyrics:** `lyrics.json` holds the official text on fixed Whisper timings (`python tools/make_lyrics_official.py` rebuilds it; never retime `t`/`end`).

```bash
cd knowMyNameTrueDamage
npm install
npx playwright install chromium

# put your own audio next to package.json as audio.mp3, then:
npm start                          # http://localhost:8080/  -> start button
npm run still -- 33 74 212         # single lossless PNG frames -> tools/stills/ (look-dev)
node capture.mjs --start 28 --end 34 --out test.mp4   # quick preview clip
npm run capture                    # full render -> know-my-name-code-mv.mp4 (1920x1080, 30 fps, ~35 min)
```

Optional lyric timing: `python tools/transcribe.py large-v3 en` (faster-whisper) writes `words.json`.

### goHardMeovv (Canvas2D Kinetic Collage Engine)

No Three.js: `scene.js` is a deterministic Canvas2D renderer (`render(t)`), so capture is the same Playwright + FFmpeg loop. Fonts (Anton, Noto Sans KR 900, Space Mono) load from Google Fonts on first run.

```bash
cd goHardMeovv
npm install
npx playwright install chromium

# put your own audio next to package.json as audio.mp3, then:
python tools/transcribe.py large-v3 auto     # words.json (set PYTHONUTF8=1 on Windows, Hangul output)
npm start                                    # http://localhost:8080/
node tools/still.mjs 36.3 58.4 130.2         # single lossless PNG frames -> tools/stills/
node capture.mjs --crf 18                    # full render -> go-hard-meovv-code-mv.mp4 (1920x1080, 30 fps, ~25 min)
```

Archive material: the Wikimedia Commons originals are listed in `goHardMeovv/assets/CREDITS.md`; `python tools/prep_archive.py` rebuilds `archive/` from them (crops frames, bakes the ink/bone palette, tints hot steel yellow). `lyrics.json` is curated by ear (`doubt:true` marks lines to verify); HARD stamp times come from `words.json`.

### unloveuKatseye (Frosted-Glass / Prismatic Editorial Engine)

Canvas2D like `goHardMeovv`, same Playwright + FFmpeg capture. Instrument Serif and Inter Tight are self-hosted in `assets/fonts` (OFL), so no CDN is needed. Optional video layers (`assets/layers.json`) are supported but not used: the shipped look is fully procedural.

```bash
cd unloveuKatseye
npm install
npx playwright install chromium

# put your own audio next to package.json as audio.mp3, then:
python tools/transcribe.py large-v3 en       # words.json
python tools/make_lyrics.py                  # raw lyrics.json (the shipped one is curated; `doubt:true` = verify)
npm start                                    # http://localhost:8080/
node tools/still.mjs 98 166.8 200            # single lossless PNG frames -> tools/stills/
node capture.mjs --crf 18                    # full render -> unloveu-katseye-code-mv.mp4 (1920x1080, 30 fps, ~20 min)
```

### firestarterKDA (Line Distribution + Karaoke Visualizer)

Canvas2D like `goHardMeovv`, same Playwright + FFmpeg capture. Chakra Petch, Black Han Sans and Share Tech Mono are self-hosted in `assets/fonts` (OFL; `fonts.css` is generated from `@fontsource`), so no CDN is needed. `lyrics.json` carries the per-line singer attribution (`singers`), Hangul romanization (`rom`) and word times; `assumed:true` marks sections where the split between singers is a guess.

```bash
cd firestarterKDA
npm install
npx playwright install chromium

# put your own audio next to package.json as audio.mp3, then:
python tools/transcribe.py large-v3 auto     # words.json (set PYTHONUTF8=1 / PYTHONIOENCODING=utf-8 on Windows)
python tools/make_lyrics.py                  # rebuilds lyrics.json (curated text + singer split + line distribution stats)
npm start                                    # http://localhost:8080/
node capture.mjs --start 100 --end 110 --out test.mp4   # quick preview clip
npm run capture                              # full render -> firestarter-kda-code-mv.mp4 (1920x1080, 30 fps, ~15 min)
```

### expectationsOlivia ("The Big Expectations Show" engine)

Canvas2D like `goHardMeovv`, same Playwright + FFmpeg capture. Bungee, Rubik Mono One, VT323 and Permanent Marker are self-hosted in `assets/fonts` (OFL). `lyrics.json` has the sung lines (`singers`, word times), plus `skits[]` (host speech turned into chyron / card / survey-board events) and `chapters[]`. Chorus 1 deliberately stops where the skit cuts in; `assumed:true` marks the duet sections with estimated line times.

```bash
cd expectationsOlivia
npm install
npx playwright install chromium

# put your own audio next to package.json as audio.mp3, then:
python tools/transcribe.py large-v3 en       # words.json
python tools/retry.py en 253 290 "prompt"    # re-run a clip (used for the duet final chorus)
python tools/make_lyrics.py                  # rebuilds lyrics.json (curated text + times + skit events)
npm start                                    # http://localhost:8080/
node tools/still.mjs 95.8 230 281            # single lossless PNG frames -> tools/stills/
npm run capture                              # full render -> expectations-code-mv.mp4 (1920x1080, 30 fps)
```

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
knowMyNameTrueDamage/   scene.js (cue sheet + SHOTS)  typography.js  timing.js  analyzer.js  main.js  capture.mjs  serve.mjs  tools/
goHardMeovv/       scene.js (Canvas2D chapters)  analyzer.js  main.js  capture.mjs  serve.mjs  archive/  tools/
unloveuKatseye/    scene.js (glass / prism / crack chapters)  analyzer.js  main.js  capture.mjs  serve.mjs  assets/fonts  tools/
firestarterKDA/    scene.js (HUD / karaoke / outro table)  analyzer.js  main.js  capture.mjs  serve.mjs  fonts.css  assets/fonts  tools/
expectationsOlivia/  scene.js (game-show set / skit TV graphics / buzzers)  analyzer.js  main.js  capture.mjs  serve.mjs  fonts.css  assets/fonts  tools/
sawadikaLisa/      scene.js  typography.js  timing.js  analyzer.js  main.js  lyrics.json
```

## License / credits

Code: yours to adapt for your own lyric videos. All music, lyrics and artwork remain the property of their respective owners; see the disclaimer above.
