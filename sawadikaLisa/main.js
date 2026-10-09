import { analyze, reportText, chaptersMarkdown, fmt } from './analyzer.js';
import { buildTimeline, decorate } from './timing.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const AUDIO_URL = 'audio.mp3';
const QUALITY = Number(params.get('q')) || 1; // ?q=1.5 supersamples for recording

const audio = new Audio();
audio.preload = 'auto';
let actx, recDest, an, world, lines = [];
let started = false, finished = false;
let clockA = 0, clockP = 0, lastCT = -1;
let recorder = null, recChunks = [];
let raw = [], baseOffset = 0, nudge = 0; // lyrics time = raw time + baseOffset (lyrics.json "offset") + nudge (, and . keys)

// one place for all lyric timing corrections: no more per-line patches
function shiftedLines() {
  const d = baseOffset + nudge;
  return decorate(raw.map((l) => ({
    ...l, t: Math.max(0, l.t + d), end: Math.max(0, l.end + d),
    ...(l.minEnd ? { minEnd: l.minEnd + d } : {}),
  })), an);
}
let toastTimer = 0;
function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.style.opacity = 1;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.style.opacity = 0; }, 1800);
}
function nudgeLyrics(d) {
  nudge = Math.round((nudge + d) * 100) / 100;
  try { localStorage.setItem('sawadika.nudge', String(nudge)); } catch { /* optional */ }
  lines = shiftedLines();
  world.lines = lines;
  toast(`lyrics offset ${(baseOffset + nudge).toFixed(2)}s  (nudge ${nudge >= 0 ? '+' : ''}${nudge.toFixed(2)}s)  ·  , earlier  . later  / reset`);
}

// ---------- boot: audio -> analysis -> lyric timeline -> 3D world
async function boot() {
  const status = $('status'), fill = $('barfill');
  try {
    const res = await fetch(AUDIO_URL);
    if (!res.ok) throw new Error(`${AUDIO_URL}: HTTP ${res.status}`);
    const ab = await res.arrayBuffer();
    audio.src = URL.createObjectURL(new Blob([ab], { type: 'audio/mpeg' }));
    actx = new AudioContext();
    status.textContent = 'decoding audio…';
    const buf = await actx.decodeAudioData(ab.slice(0));
    status.textContent = 'analysing beats, kicks, bass, drops…';
    an = await analyze(buf, (p) => { fill.style.width = `${Math.round(p * 100)}%`; });
    applyOverrides();
    window.__an = an;

    raw = await loadLyrics();
    try { nudge = Number(localStorage.getItem('sawadika.nudge')) || 0; } catch { nudge = 0; }
    lines = shiftedLines();
    window.__exportLyrics = () => JSON.stringify({ bpm: +an.bpm.toFixed(2), lines: raw }, null, 2);
    try { await Promise.all([document.fonts.load('800 100px Montserrat'), document.fonts.load('600 22px Montserrat')]); } catch { /* falls back to Segoe UI */ }

    status.textContent = 'building the 3D city…';
    await new Promise((r) => setTimeout(r, 30));
    const { World } = await import('./scene.js');
    world = new World($('stage'), an, lines, QUALITY);
    window.__world = world;
    console.log(reportText(an));
    status.textContent = `${an.bpm.toFixed(1)} BPM · ${an.drops.length} drops · ${raw.length} lyric lines timed automatically`;
    if (params.has('nudge')) { nudge = Number(params.get('nudge')) || 0; lines = shiftedLines(); world.lines = lines; }
    resize();
    if (params.has('capture')) {
      // offline frame-by-frame rendering (used by the video exporter): no audio clock, no rAF loop
      $('overlay').classList.add('gone');
      window.__capture = {
        duration: an.duration,
        frame: (t) => { world.render(t); return $('stage').toDataURL('image/jpeg', 0.96); },
      };
      return;
    }
    $('start').hidden = false;
    $('start').focus();
    requestAnimationFrame(frame);
  } catch (e) {
    status.textContent = `error: ${e.message} — serve this folder over http (see README); the first run also needs internet for three.js`;
    console.error(e);
  }
}

function applyOverrides() {
  if (params.get('bpm')) {
    an.bpm = Number(params.get('bpm')); an.beatDur = 60 / an.bpm; an.barDur = an.beatDur * 4;
  }
  if (params.get('offset')) an.offset = Number(params.get('offset'));
}

// lyrics.json (already timed) wins; if it is empty or ?auto is set, the timeline is rebuilt from the analysis
async function loadLyrics() {
  if (!params.has('auto')) {
    try {
      const r = await fetch('lyrics.json', { cache: 'no-store' });
      if (r.ok) { const j = await r.json(); if (j.lines && j.lines.length) { baseOffset = Number(j.offset) || 0; return j.lines; } }
    } catch { /* fall through */ }
  }
  return buildTimeline(an);
}

// ---------- playback clock (audio.currentTime is coarse; interpolate between its ticks)
function clock() {
  const now = performance.now();
  if (audio.currentTime !== lastCT) { lastCT = audio.currentTime; clockA = lastCT; clockP = now; }
  return audio.paused ? audio.currentTime : clockA + Math.min(0.1, (now - clockP) / 1000);
}

async function play() {
  if (!started) {
    started = true;
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => { /* user may deny */ });
    await actx.resume();
    const src = actx.createMediaElementSource(audio);
    recDest = actx.createMediaStreamDestination();
    src.connect(actx.destination); src.connect(recDest);
    $('overlay').classList.add('gone');
    $('hud').hidden = false;
    document.body.classList.add('playing');
    if (params.has('t')) audio.currentTime = Number(params.get('t')) || 0; // ?t=32 starts at 0:32
  }
  finished = false;
  await audio.play();
}

function toggle() { if (audio.paused) play(); else audio.pause(); }
function seek(d) { audio.currentTime = Math.max(0, Math.min(an.duration - 0.1, audio.currentTime + d)); }
function fullscreen() { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); }

// the web font may arrive after the first layout pass: measure again once it is really there
document.fonts.addEventListener('loadingdone', () => { if (world) world.typo.cache.clear(); });

function resize() { if (world) world.resize(window.innerWidth, window.innerHeight); }
window.addEventListener('resize', resize);
document.addEventListener('fullscreenchange', resize);

// ---------- render loop
let dbgAt = 0;
function frame() {
  requestAnimationFrame(frame);
  const t = Math.min(clock(), an.duration);
  world.render(t);
  $('hudfill').style.width = `${(t / an.duration) * 100}%`;
  if (!$('debug').hidden && performance.now() - dbgAt > 150) {
    dbgAt = performance.now();
    const f = world.features(t);
    $('debug').textContent = `t ${t.toFixed(2)}s  ${fmt(t)}/${fmt(an.duration)}  shot ${world.shot}\nbeat ${f.beatPos.toFixed(2)}  kick ${f.kick.toFixed(2)}  bass ${f.bass.toFixed(2)}  snare ${f.snare.toFixed(2)}\ndrop ${f.drop.toFixed(2)}  riser ${f.riser.toFixed(2)}  type-impact ${world.typo.impact.toFixed(2)}\nline: ${world.typo.activeText}\n\n${reportText(an)}`;
  }
}

// ---------- recording (WebM, canvas + audio). Convert to MP4 with ffmpeg for YouTube.
function toggleRecord() {
  if (recorder) { recorder.stop(); return; }
  if (!started) return;
  const stream = $('stage').captureStream(60);
  recDest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
  const mime = ['video/webm;codecs=vp9,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
  recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 20e6 });
  recChunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size) recChunks.push(e.data); };
  recorder.onstop = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(recChunks, { type: 'video/webm' }));
    a.download = 'sawadika-code-mv.webm'; a.click();
    recorder = null; document.title = document.title.replace('● REC ', '');
  };
  audio.currentTime = 0; play();
  recorder.start(1000);
  document.title = `● REC ${document.title}`;
}
audio.addEventListener('ended', () => { finished = true; if (recorder) recorder.stop(); });

// ---------- input
$('start').addEventListener('click', play);
$('stage').addEventListener('click', () => { if (started) toggle(); });
$('stage').addEventListener('dblclick', fullscreen);
window.addEventListener('keydown', (e) => {
  switch (e.key.toLowerCase()) {
    case ' ': e.preventDefault(); if (started) toggle(); break;
    case 'f': fullscreen(); break;
    case 'arrowright': if (started) seek(5); break;
    case 'arrowleft': if (started) seek(-5); break;
    case 'd': $('debug').hidden = !$('debug').hidden; break;
    case 'h': $('hud').hidden = !$('hud').hidden; break;
    case 'r': toggleRecord(); break;
    case ',': if (started) nudgeLyrics(-0.1); break;
    case '.': if (started) nudgeLyrics(0.1); break;
    case '/': if (started) nudgeLyrics(-nudge); break;
    case 'c': navigator.clipboard.writeText(chaptersMarkdown(an)); break;
    case 'enter': if (!started && !$('start').hidden) play(); break;
    default:
  }
});

boot();
