import { analyze, reportText, fmt } from './analyzer.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const AUDIO_URL = 'audio.mp3';
const NUDGE_KEY = 'unloveu.nudge';

const audio = new Audio();
audio.preload = 'auto';
let actx, an, scene, raw = [], baseOffset = 0, nudge = 0, started = false;
let clockA = 0, clockP = 0, lastCT = -1;
const layers = {}; // optional Higgsfield background loops: { name: { video, a, b } } (assets/layers.json)

function shiftedLines() {
  const d = baseOffset + nudge;
  return raw.map((l) => ({ ...l, shift: d, t: Math.max(0, l.t + d), end: Math.max(0, l.end + d) })).sort((a, b) => a.t - b.t);
}
let toastTimer = 0;
function toast(msg) {
  let el = $('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.style.opacity = 1;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.style.opacity = 0; }, 1800);
}
function setNudge(v) {
  nudge = Math.round(v * 100) / 100;
  try { localStorage.setItem(NUDGE_KEY, String(nudge)); } catch { /* optional */ }
  scene.setLines(shiftedLines());
  toast(`lyric offset ${(baseOffset + nudge).toFixed(2)}s  ·  , earlier  . later  / reset`);
}

// Optional video layers. assets/layers.json: { "iceMelt": { "src": "assets/ice-melt.mp4", "a": 0, "b": 20 }, ... }; missing file = no layers.
async function loadLayers() {
  let man;
  try {
    const r = await fetch('assets/layers.json', { cache: 'no-store' });
    if (!r.ok) return;
    man = await r.json();
  } catch { return; }
  await Promise.all(Object.entries(man).map(([name, L]) => new Promise((res) => {
    const v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.src = L.src;
    v.onloadeddata = () => { layers[name] = { video: v, a: L.a, b: L.b }; res(); };
    v.onerror = () => res();
  })));
}
const seekOne = (v, ct) => new Promise((res) => {
  if (Math.abs(v.currentTime - ct) < 0.001) { res(); return; }
  const done = () => { v.removeEventListener('seeked', done); res(); };
  v.addEventListener('seeked', done); v.currentTime = ct;
  setTimeout(done, 1500);
});
async function seekLayers(t) {
  await Promise.all(Object.values(layers).map(({ video, a, b }) => {
    if (t < a - 0.5 || t > b + 0.5) return null;
    return seekOne(video, ((t - a) % video.duration + video.duration) % video.duration);
  }));
}

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
    status.textContent = 'beat / kick / bass analysis…';
    an = await analyze(buf, (p) => { fill.style.width = `${Math.round(p * 100)}%`; });
    if (params.get('bpm')) { an.bpm = Number(params.get('bpm')); an.beatDur = 60 / an.bpm; an.barDur = an.beatDur * 4; }
    if (params.get('offset')) an.offset = Number(params.get('offset'));
    window.__an = an;

    const j = await (await fetch('lyrics.json', { cache: 'no-store' })).json();
    raw = j.lines; baseOffset = Number(j.offset) || 0;
    const words = (await (await fetch('words.json', { cache: 'no-store' })).json()).words;
    try { nudge = Number(localStorage.getItem(NUDGE_KEY)) || 0; } catch { nudge = 0; }
    if (params.has('nudge')) nudge = Number(params.get('nudge')) || 0;

    status.textContent = 'loading fonts…';
    try {
      await Promise.all([
        document.fonts.load('italic 400 100px "Instrument Serif"'), document.fonts.load('400 100px "Instrument Serif"'),
        document.fonts.load('500 20px "Inter Tight"'), document.fonts.load('700 20px "Inter Tight"'),
      ]);
    } catch { /* falls back to system fonts */ }
    await loadLayers();

    const { Scene } = await import('./scene.js');
    scene = new Scene($('stage'), an, shiftedLines(), words, layers);
    window.__scene = scene;
    console.log(reportText(an));
    status.textContent = `${an.bpm.toFixed(1)} BPM · ${raw.length} lyric lines · ${Object.keys(layers).length} video layer(s)`;
    if (params.has('capture')) {
      $('overlay').classList.add('gone');
      window.__capture = {
        duration: an.duration,
        frame: async (t) => { await seekLayers(t); scene.render(t); return $('stage').toDataURL('image/png').slice(22); },
      };
      return;
    }
    $('start').hidden = false; $('start').focus();
    requestAnimationFrame(frame);
  } catch (e) {
    status.textContent = `error: ${e.message} — serve the folder over http (npm start); first run needs internet for Google Fonts`;
    console.error(e);
  }
}

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
    actx.createMediaElementSource(audio).connect(actx.destination);
    $('overlay').classList.add('gone'); $('hud').hidden = false; document.body.classList.add('playing');
    if (params.has('t')) audio.currentTime = Number(params.get('t')) || 0;
  }
  Object.values(layers).forEach(({ video }) => video.play().catch(() => { /* autoplay denied: frame stays still */ }));
  await audio.play();
}
const toggle = () => { if (audio.paused) play(); else { audio.pause(); Object.values(layers).forEach(({ video }) => video.pause()); } };
const seek = (d) => { audio.currentTime = Math.max(0, Math.min(an.duration - 0.1, audio.currentTime + d)); };
const fullscreen = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); };

let dbgAt = 0;
function frame() {
  requestAnimationFrame(frame);
  const t = Math.min(clock(), an.duration);
  scene.render(t);
  $('hudfill').style.width = `${(t / an.duration) * 100}%`;
  if (!$('debug').hidden && performance.now() - dbgAt > 150) {
    dbgAt = performance.now();
    $('debug').textContent = `t ${t.toFixed(2)}s  ${fmt(t)}/${fmt(an.duration)}  chapter ${scene.chapter}  offset ${(baseOffset + nudge).toFixed(2)}s\n\n${reportText(an)}`;
  }
}

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
    case ',': if (scene) setNudge(nudge - 0.1); break;
    case '.': if (scene) setNudge(nudge + 0.1); break;
    case '/': if (scene) setNudge(0); break;
    case 'enter': if (!started && !$('start').hidden) play(); break;
    default:
  }
});

boot();
