# LISA – SaWaDiKa · Fan-made MV, the entire video is code

A generative music video for LISA's "SaWaDiKa" rendered live in the browser with **Three.js + GLSL shaders + Canvas typography**. No footage, no editor: a neon Bangkok street canyon the camera flies through, temple-gold chedis, wireframe cages, ember clouds, rain and a wireframe tuk-tuk – all driven frame-by-frame by an analysis of the audio. Same song time → same frame (fully deterministic).

> Fan-made, non-commercial tribute. Music © LISA / her label and publishers. Not affiliated with or endorsed by LISA or her team.

## ▶ Watch it

```bash
python -m http.server 8080
```

Open <http://localhost:8080/>, wait for the analysis bar (≈10 s), click **PLAY FULLSCREEN**. One click starts audio and enters full screen. First run needs internet (Three.js 0.160 loads from jsDelivr).

| Key | Action |
|---|---|
| `Space` / click | Pause / resume |
| `←` `→` | Seek ∓5 s |
| `F` / double-click | Full screen |
| `D` | Debug overlay (current shot, beat, kick/bass/snare, drop, active line) |
| `R` | Record the full video + audio to `.webm` |
| `C` | Copy auto-detected chapter timestamps |

URL options: `?t=32` start at 0:32 · `?q=1.5` supersample (use for recording) · `?auto` rebuild the lyric timing from the analysis instead of `lyrics.json` · `?bpm=93.3&offset=0.19` override the beat grid.

## 📺 YouTube description

### CHAPTERS
```
0:00 Intro – title assembles letter by letter
0:32 Drop 1 – "Hello Sawadika"
0:58 Verse 1
1:26 "How many…" build + drop 2
1:44 Hook
2:07 Verse 2 – "doing donuts in a tuktuk"
2:35 Final drop – hook x2
3:01 Outro – "Hello Sawadika" x4
```

### THE IDEA
Inspired by the "entire MV is code" concept: instead of subtitles on a background, the lyrics *are* the visuals. Every letter is a particle that flies in on the beat, slams, glitches with RGB ghosts and scatters when its line ends. The camera, the city and the colours are instruments played by the song:

- **Kick** – camera zoom punch, building edges flare, embers swell, letters pulse.
- **Snare** – chromatic aberration and glitch slices.
- **Bass** – the camera's speed down the street (louder bass = faster flight), ground grid glow.
- **Beat grid (≈93.3 BPM, 4/4)** – a light wave travels down the street once per beat; windows flash on the beat; word entries land on half-beats; the camera cuts on the downbeat every two bars.
- **Drops (0:32, 1:26, 2:35 – measured as ≥1.45× low-end jumps)** – two bars of riser (tightening vignette, rising shake), then flash, gold takeover of all neon, shockwave of embers, heavy RGB split.
- **Hero lines** – "Hello Sawadika", "Ferrari indigo" (the whole city turns indigo) and "doing donuts in a tuktuk" (camera switches to a wireframe tuk-tuk drifting donuts) get their own treatment.

### HOW IT WAS MADE
- `analyzer.js` – decode → FFT (1024/512) → 3-band energy + spectral-flux onsets → tempo by autocorrelation + joint period/phase search → downbeat from kick energy → bar-level drops and sections.
- `timing.js` – lays the lyrics on the measured bar grid (blocks follow the bass/energy structure; lines inside a block get time proportional to syllables, snapped to half-beats). Output is saved in `lyrics.json`. **Auto-timing is inferred from the audio structure, not from hearing the vocals – nudge `t`/`end` in `lyrics.json` if a line is early/late.**
- `scene.js` – Three.js: instanced shader buildings (procedural windows, neon edges, beat waves), chedi lathe geometry with gold shader, wire-cage gates, floating wire polyhedra, 9,000 GPU embers, 3,200 rain streaks, camera director (8 shots, chosen per two bars from energy), bloom + custom CRT/aberration/glitch pass.
- `typography.js` – per-letter kinetic type on a 2D canvas, uploaded as a texture and rendered inside the 3D pipeline so bloom and aberration hit the letters.
- `main.js` – loading, playback clock, controls, WebM recording.

Export to MP4: `ffmpeg -i sawadika-code-mv.webm -c:v libx264 -crf 16 -pix_fmt yuv420p -c:a aac -b:a 256k out.mp4`

#SaWaDiKa #LISA #FanMade #Threejs #GLSL #CreativeCoding #KineticTypography #Bangkok
