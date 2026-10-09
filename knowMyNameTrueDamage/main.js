import { analyze, reportText, chaptersMarkdown, fmt } from './analyzer.js';
import { buildTimeline, decorate } from './timing.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const AUDIO_URL = 'audio.mp3';
const QUALITY = Number(params.get('q')) || 1; // ?q=1.5 supersamples
const NUDGE_KEY = 'knowmyname.nudge';

const audio = new Audio();
audio.preload = 'auto';
let actx, an, world, lines = [];
let started = false;
let clockA = 0, clockP = 0, lastCT = -1;
let raw = [], baseOffset = 0, nudge = 0; // lyrics time = raw time + baseOffset (lyrics.json "offset") + nudge (, and . keys)

// one place for all lyric timing corrections
function shiftedLines() {
  const d = baseOffset + nudge;
  return decorate(raw.map((l) => ({
    ...l, t: Math.max(0, l.t + d), end: Math.max(0, l.end + d),
    ...(l.minEnd ? { minEnd: l.minEnd + d } : {}),
  })));
}
let toastTimer = 0;
function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.style.opacity = 1;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.style.opacity = 0; }, 1800);
}
function setNudge(v) {
  nudge = Math.round(v * 100) / 100;
  try { localStorage.setItem(NUDGE_KEY, String(nudge)); } catch { /* optional */ }
  lines = shiftedLines();
  world.lines = lines;
  toast(`söz ofseti ${(baseOffset + nudge).toFixed(2)}s (nudge ${nudge >= 0 ? '+' : ''}${nudge.toFixed(2)}s)  ·  , erken  . geç  / sıfırla`);
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
    status.textContent = 'ses çözülüyor…';
    const buf = await actx.decodeAudioData(ab.slice(0));
    status.textContent = 'ritim, kick, bas analizi…';
    an = await analyze(buf, (p) => { fill.style.width = `${Math.round(p * 100)}%`; });
    applyOverrides();
    window.__an = an;

    raw = await loadLyrics();
    try { nudge = Number(localStorage.getItem(NUDGE_KEY)) || 0; } catch { nudge = 0; }
    if (params.has('nudge')) nudge = Number(params.get('nudge')) || 0; // ?nudge= wins (used by capture)
    lines = shiftedLines();
    window.__exportLyrics = () => JSON.stringify({ bpm: +an.bpm.toFixed(2), offset: baseOffset, lines: raw }, null, 2);
    try { await Promise.all([document.fonts.load('700 100px Montserrat'), document.fonts.load('700 22px Montserrat')]); } catch { /* falls back to Segoe UI */ }

    status.textContent = '3D sahne kuruluyor…';
    await new Promise((r) => setTimeout(r, 30));
    const { World } = await import('./scene.js');
    world = new World($('stage'), an, lines, QUALITY);
    window.__world = world;
    console.log(reportText(an));
    status.textContent = `${an.bpm.toFixed(1)} BPM · ${raw.length} söz bloğu`;
    resize();
    if (params.has('capture')) {
      // offline frame-by-frame rendering (used by capture.mjs): no audio clock, no rAF loop
      $('overlay').classList.add('gone');
      window.__capture = {
        duration: an.duration,
        frame: (t) => { world.render(t); return $('stage').toDataURL('image/png').slice(22); }, // base64 PNG, lossless
      };
      return;
    }
    $('start').hidden = false;
    $('start').focus();
    requestAnimationFrame(frame);
  } catch (e) {
    status.textContent = `hata: ${e.message} — klasörü http ile sun (README); ilk çalıştırma three.js için internet ister`;
    console.error(e);
  }
}

function applyOverrides() {
  if (params.get('bpm')) { an.bpm = Number(params.get('bpm')); an.beatDur = 60 / an.bpm; an.barDur = an.beatDur * 4; }
  if (params.get('offset')) an.offset = Number(params.get('offset'));
}

// lyrics.json (already timed) wins; if it is empty or ?auto is set, a title card is shown instead
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
    actx.createMediaElementSource(audio).connect(actx.destination);
    $('overlay').classList.add('gone');
    $('hud').hidden = false;
    document.body.classList.add('playing');
    if (params.has('t')) audio.currentTime = Number(params.get('t')) || 0; // ?t=32 starts at 0:32
  }
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
    $('debug').textContent = `t ${t.toFixed(2)}s  ${fmt(t)}/${fmt(an.duration)}  pose ${world.shot}  offset ${(baseOffset + nudge).toFixed(2)}s\nbeat ${f.beatPos.toFixed(2)}  kick ${f.kick.toFixed(2)}  bass ${f.bass.toFixed(2)}  mood ${f.section.toFixed(2)}\nline: ${world.typo.activeText}\n\n${reportText(an)}`;
  }
}

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
    case ',': if (world) setNudge(nudge - 0.1); break;
    case '.': if (world) setNudge(nudge + 0.1); break;
    case '/': if (world) setNudge(0); break;
    case 'c': navigator.clipboard.writeText(chaptersMarkdown(an)); break;
    case 'enter': if (!started && !$('start').hidden) play(); break;
    default:
  }
});

boot();
