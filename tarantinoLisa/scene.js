// LISA - Tarantino: 1970s grindhouse / pulp cinema. Canvas2D, deterministic render(t) (seek / frame-capture safe), no external media.
// Palette: Kill Bill yellow #FFE800, blood / lipstick red #D00000, film black #0D0C0C, desert-sand cream #F4ECD8.
// Pipeline: scene drawn into a 1920x804 (2.39:1) "scope" buffer -> gate weave / film slip -> letterbox bars -> 35mm grain, dust, scratches, vignette.
// Looks: reel leader + cinematic subtitles (skit), title sequence, Kill Bill stripes + motel neon, Death Proof split screens, desert katana slashes,
// Hollywood sign sunset, scrolling end credits and a FIN card. Every chorus repeats one notch bigger (more split panels, more tilt).

const W = 1920, H = 1080, SH = 804, TOP = 138;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const easeOut = (x) => 1 - (1 - clamp(x)) ** 3;
const easeBack = (x) => { x = clamp(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; };
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const SLAB = '"Alfa Slab One", Impact, sans-serif', SCRIPT = '"Shrikhand", "Brush Script MT", cursive', TYPE = '"Special Elite", "Courier New", monospace';
const WEST = '"Rye", "Alfa Slab One", serif', SUB = '"Oswald", "Arial Narrow", sans-serif';

const YEL = hex('#FFE800'), RED = hex('#D00000'), BLK = hex('#0D0C0C'), CRM = hex('#F4ECD8');
const SAND = [222, 184, 126], DUNE = [158, 106, 58];
const KEYW = /^(tarantino|camino|movie|hollywood|kill|bill|death|proof|katana|chopper|boss|don|gun|razor|teaser)$/;
const ROMAN = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN'];
// backdrop schedule (nominal times, not shifted by the lyric nudge): [start, kind, escalation]
const SEQ = [[0, 'reel', 0], [29.5, 'chorus', 0], [61.5, 'verse1', 0], [74.0, 'pre', 0], [86.4, 'chorus', 1], [110.3, 'verse2', 0],
  [123.2, 'pre', 1], [135.3, 'chorus', 2], [160.6, 'post', 0], [171.8, 'outro', 0], [184.5, 'credits', 0], [211.4, 'fin', 0]];
const PLATE = { chorus: 0.8, pre: 0.82, verse2: 0.84, outro: 0.7, post: 0, verse1: 0, reel: 0, credits: 0, fin: 0 };

const poly = (c, pts) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };

export class Scene {
  constructor(canvas, an, lines, meta) {
    this.canvas = canvas; this.g = canvas.getContext('2d');
    this.S = document.createElement('canvas'); this.S.width = W; this.S.height = SH; this.c = this.S.getContext('2d');
    this.T = document.createElement('canvas'); this.T.width = 16; this.T.height = 16; this.tg = this.T.getContext('2d');
    this.nw = 320; this.nh = 134;
    this.nzC = document.createElement('canvas'); this.nzC.width = this.nw; this.nzC.height = this.nh;
    this.nzG = this.nzC.getContext('2d'); this.nzD = this.nzG.createImageData(this.nw, this.nh);
    this.an = an; this.meta = meta; this.sectionName = '';
    const n = an.kick.length, kd = Math.exp(-6 / an.fps);
    this.kickE = new Float32Array(n);
    for (let i = 1; i < n; i++) this.kickE[i] = Math.max(this.kickE[i - 1] * kd, an.kick[i] > 0.5 ? an.kick[i] : 0);
    this.vig = this.makeVignette(); this.dots = this.makeHalftone();
    this.chapters = meta.chapters || []; this.skit = meta.skit; this.credits = meta.credits;
    this.setLines(lines);
  }

  // ---------- static resources
  makeVignette() {
    const c = document.createElement('canvas'); c.width = W / 4; c.height = SH / 4;
    const g = c.getContext('2d'), r = g.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.38, c.width / 2, c.height / 2, c.height * 1.05);
    r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(0,0,0,0.72)');
    g.fillStyle = r; g.fillRect(0, 0, c.width, c.height);
    return c;
  }
  makeHalftone() {
    const c = document.createElement('canvas'); c.width = 18; c.height = 18;
    const g = c.getContext('2d'); g.fillStyle = '#000'; g.beginPath(); g.arc(4.5, 4.5, 2.6, 0, 7); g.arc(13.5, 13.5, 2.6, 0, 7); g.fill();
    return this.g.createPattern(c, 'repeat');
  }

  // ---------- lines: layout and cues
  setLines(lines) {
    this.lines = [...lines].sort((a, b) => a.t - b.t);
    this.lay = this.lines.map((l) => this.layout(l));
    this.cue = {};
    for (const l of this.lines) for (const w of l.words) {
      const k = w.w.toLowerCase().replace(/[^a-z-]/g, '');
      if (!this.cue[k]) this.cue[k] = [];
      this.cue[k].push(w.s);
    }
  }
  layout(line) {
    const c = this.tg;
    let inE = false;
    const items = line.words.map((w) => {
      let s = w.w; const echo = inE || s.startsWith('(');
      if (s.startsWith('(')) inE = true;
      if (s.endsWith(')')) inE = false;
      s = s.replace(/[()]/g, '').toUpperCase();
      const key = !echo && KEYW.test(s.toLowerCase().replace(/[^a-z]/g, ''));
      c.font = echo ? `400 100px ${SCRIPT}` : `400 100px ${SLAB}`;
      return { s, echo, key, w100: c.measureText(s).width * (echo ? 0.5 : 1) };
    });
    c.font = `400 100px ${SLAB}`;
    const gap100 = c.measureText(' ').width * 0.8 + 16, MAXW = 1560;
    let S = line.words.length <= 3 ? 184 : 132, rows;
    for (; S >= 52; S -= 4) {
      rows = [[]]; let cur = 0;
      items.forEach((it, i) => {
        const add = (rows[rows.length - 1].length ? gap100 : 0) * S / 100 + it.w100 * S / 100;
        if (cur + add > MAXW && rows[rows.length - 1].length) { rows.push([]); cur = 0; }
        cur += (rows[rows.length - 1].length ? gap100 : 0) * S / 100 + it.w100 * S / 100; rows[rows.length - 1].push(i);
      });
      if (rows.length <= (line.words.length <= 8 ? 2 : 3)) break;
    }
    return { S, rows, items, gap100 };
  }

  kickAt(t) { return this.kickE[clamp(Math.floor(t * this.an.fps), 0, this.kickE.length - 1)]; }
  seqAt(t) { let k = 0; for (let i = 0; i < SEQ.length; i++) if (t >= SEQ[i][0]) k = i; return k; }
  curIdx(t) {
    let k = -1;
    for (let i = 0; i < this.lines.length; i++) if (this.lines[i].t - 0.2 <= t) k = i; else break;
    return k >= 0 && t <= this.lines[k].end + 0.5 ? k : -1;
  }
  chapterAt(t) { const i = this.chapters.findIndex((c) => t >= c.a && t < c.b); return { i, ch: this.chapters[i] }; }

  // ---------- main
  render(t) {
    const g = this.g, c = this.c;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.shadowBlur = 0;
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.shadowBlur = 0;
    const fr = Math.floor(t * 24), kick = this.kickAt(t), si = this.seqAt(t), [t0, kind, esc] = SEQ[si];
    this.sectionName = kind;
    c.fillStyle = rgba(BLK); c.fillRect(0, 0, W, SH);

    if (kind === 'reel') this.drawReel(c, t, fr, kick);
    else if (kind === 'chorus') this.drawChorus(c, t, kick, esc);
    else if (kind === 'verse1') this.drawVerse1(c, t, kick);
    else if (kind === 'pre') this.drawPre(c, t, kick, esc, t0);
    else if (kind === 'verse2') this.drawVerse2(c, t, kick);
    else if (kind === 'post') this.drawPost(c, t, kick);
    else if (kind === 'outro') this.drawOutro(c, t, kick);
    else if (kind === 'credits') this.drawCredits(c, t, fr);
    else this.drawFin(c, t, fr, t0);

    if (kind !== 'reel' && kind !== 'credits' && kind !== 'fin') this.drawLyrics(c, t, kind, esc, kick, fr);
    if (kind === 'reel') this.drawSubs(c, t);
    this.drawTitleCard(c, t);
    this.drawChapterCard(c, t);
    this.drawCuts(c, t, fr);
    // projector flicker + beat flash (soft, decaying: never a strobe)
    c.fillStyle = `rgba(0,0,0,${hash(fr * 1.7) * 0.07})`; c.fillRect(0, 0, W, SH);
    if (kind === 'chorus' || kind === 'post') {
      c.globalCompositeOperation = 'screen'; c.fillStyle = rgba(esc >= 1 ? RED : YEL, kick * kick * (0.10 + 0.04 * esc)); c.fillRect(0, 0, W, SH); c.globalCompositeOperation = 'source-over';
    }
    this.composite(t, fr, kick, kind);
  }

  composite(t, fr, kick, kind) {
    const g = this.g;
    g.fillStyle = rgba(BLK); g.fillRect(0, 0, W, H);
    // gate weave + occasional film slip (vertical roll)
    const slot = Math.floor(t * 4), slipOn = hash(slot * 7.3) > 0.975, slipP = t * 4 - slot;
    const jx = (hash(fr * 3.1) - 0.5) * 3 * (1 + kick), jy = (hash(fr * 5.7) - 0.5) * 3.4 * (1 + kick * 1.5);
    const roll = slipOn ? Math.sin(slipP * Math.PI) * SH * (0.06 + 0.12 * hash(slot)) : 0;
    g.save(); g.beginPath(); g.rect(0, TOP, W, SH); g.clip();
    g.drawImage(this.S, jx, TOP + jy + roll);
    if (roll) g.drawImage(this.S, jx, TOP + jy + roll - SH);
    // procedural 35mm grain (coarse luminance noise, new every film frame)
    const d = this.nzD.data;
    let a = Math.floor(hash(fr * 0.37 + 3) * 4294967296) >>> 0;
    for (let i = 0; i < d.length; i += 4) {
      a = (a + 0x6d2b79f5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      const v = ((x ^ (x >>> 14)) >>> 0) & 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
    this.nzG.putImageData(this.nzD, 0, 0);
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.34; g.imageSmoothingEnabled = true; g.drawImage(this.nzC, 0, TOP, W, SH);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    // dust, hairs and vertical scratches
    const bright = kind === 'fin' || kind === 'chorus' || kind === 'verse2';
    for (let i = 0; i < 16; i++) {
      const h1 = hash(fr * 11.3 + i * 4.1), h2 = hash(fr * 7.9 + i * 9.7), sz = 1 + hash(i + fr) * 3.2;
      g.fillStyle = (i % 3 === 0 || !bright) ? 'rgba(244,236,216,0.55)' : 'rgba(13,12,12,0.7)';
      g.beginPath(); g.arc(h1 * W, TOP + h2 * SH, sz, 0, 7); g.fill();
    }
    g.strokeStyle = bright ? 'rgba(13,12,12,0.5)' : 'rgba(244,236,216,0.5)'; g.lineWidth = 1.2;
    for (let i = 0; i < 2; i++) {
      const h = hash(Math.floor(fr / 2) * 3.3 + i * 17.1);
      if (h > 0.55) { const x = hash(h * 91) * W; g.globalAlpha = 0.25 + hash(h * 13) * 0.35; g.beginPath(); g.moveTo(x, TOP); g.lineTo(x + (hash(h * 5) - 0.5) * 6, TOP + SH); g.stroke(); }
    }
    for (let i = 0; i < 3; i++) {
      const h = hash(fr * 2.9 + i * 31.7);
      if (h > 0.6) { const x = hash(h * 51) * W, y = TOP + hash(h * 77) * SH; g.globalAlpha = 0.5; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 24, y - 16, x + 50, y + 18, x + 80, y - 4); g.stroke(); }
    }
    g.globalAlpha = 1;
    g.drawImage(this.vig, 0, TOP, W, SH);
    g.restore();
    // 2.39:1 letterbox + projection slate in the bars
    g.fillStyle = rgba(BLK); g.fillRect(0, 0, W, TOP); g.fillRect(0, TOP + SH, W, H - TOP - SH);
    const { i, ch } = this.chapterAt(t), tc = (s) => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(Math.floor(s) % 60).padStart(2, '0')}:${String(Math.floor((s % 1) * 24)).padStart(2, '0')}`;
    g.fillStyle = rgba(CRM, 0.5); g.font = `400 22px ${TYPE}`; g.textBaseline = 'middle'; g.letterSpacing = '3px';
    g.textAlign = 'left'; g.fillText('LISA // TARANTINO', 60, TOP - 46);
    g.textAlign = 'center'; g.fillStyle = rgba(YEL, 0.62); g.fillText(ch ? `${i > 0 && i < 7 ? `CHAPTER ${ROMAN[i]} · ` : ''}${ch.name}` : '', W / 2, TOP - 46);
    g.textAlign = 'right'; g.fillStyle = rgba(CRM, 0.5); g.fillText(tc(t), W - 60, TOP - 46);
    g.textAlign = 'left'; g.fillText('35MM · 2.39:1 · 24 FPS', 60, TOP + SH + 46);
    g.textAlign = 'right'; g.fillText('FAN-MADE · ALL CODE', W - 60, TOP + SH + 46);
    g.letterSpacing = '0px';
    g.fillStyle = rgba(RED, 0.9); g.fillRect(0, TOP + SH + 92, W * clamp(t / this.an.duration), 4);
    if (t > this.an.duration - 0.8) { g.fillStyle = `rgba(0,0,0,${clamp((t - (this.an.duration - 0.8)) / 0.8)})`; g.fillRect(0, 0, W, H); }
  }

  // ---------- text helpers
  txt(c, s, x, y, size, font, fill, o = {}) {
    c.save(); c.translate(x, y); if (o.rot) c.rotate(o.rot); if (o.sc) c.scale(o.sc, o.sc);
    c.font = `400 ${size}px ${font}`; c.textAlign = o.align || 'center'; c.textBaseline = 'middle';
    c.letterSpacing = o.letter || '0px';
    if (o.ext) { c.fillStyle = rgba(o.extCol || BLK); for (let i = o.ext; i >= 1; i--) c.fillText(s, i * 0.9, i * 0.9); }
    if (o.glow) { c.shadowColor = rgba(o.glow, 0.9); c.shadowBlur = o.glowB || 24; }
    if (o.stroke) { c.lineWidth = o.lw || 6; c.strokeStyle = o.stroke; c.lineJoin = 'round'; c.strokeText(s, 0, 0); }
    if (fill) { c.fillStyle = fill; c.fillText(s, 0, 0); }
    c.restore();
  }
  fit(s, font, maxW, maxS) { const c = this.tg; c.font = `400 100px ${font}`; return Math.min(maxS, (maxW / c.measureText(s).width) * 100); }

  // ---------- reusable pulp art
  rays(c, cx, cy, colA, colB, count, rot, reach = 2200) {
    c.fillStyle = rgba(colA); c.fillRect(cx - reach, cy - reach, reach * 2, reach * 2);
    c.fillStyle = rgba(colB); const da = Math.PI / count;
    for (let i = 0; i < count; i++) {
      const a = rot + i * da * 2;
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + reach * Math.cos(a), cy + reach * Math.sin(a)); c.lineTo(cx + reach * Math.cos(a + da), cy + reach * Math.sin(a + da)); c.closePath(); c.fill();
    }
  }
  lips(c, cx, cy, s, col = RED) {
    c.save(); c.translate(cx, cy); c.scale(s, s);
    c.fillStyle = rgba(col); c.beginPath();
    c.moveTo(-170, 0); c.bezierCurveTo(-120, -70, -45, -80, 0, -38); c.bezierCurveTo(45, -80, 120, -70, 170, 0);
    c.bezierCurveTo(110, 82, -110, 82, -170, 0); c.closePath(); c.fill();
    c.strokeStyle = rgba(BLK, 0.85); c.lineWidth = 7; c.beginPath(); c.moveTo(-170, 0); c.quadraticCurveTo(-40, 24, 0, 8); c.quadraticCurveTo(40, 24, 170, 0); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.28)'; c.beginPath(); c.ellipse(-52, -34, 46, 9, -0.25, 0, 7); c.fill();
    c.restore();
  }
  camino(c, x, y, s, body = BLK, hub = CRM, boot = true, t = 0) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.fillStyle = rgba(body);
    poly(c, [[0, 44], [128, 44], [150, 6], [250, 4], [304, 42], [404, 52], [420, 66], [420, 92], [0, 92]]); c.fill();
    c.strokeStyle = rgba(CRM, 0.75); c.lineWidth = 4; c.lineJoin = 'round'; c.stroke();
    c.fillStyle = rgba(mix(CRM, BLK, 0.15), 0.9); poly(c, [[158, 14], [246, 12], [286, 40], [150, 40]]); c.fill();
    if (boot) { // boots dangling out of the window
      c.save(); c.translate(238, 30); c.rotate(Math.sin(t * 5) * 0.08); c.fillStyle = rgba(body);
      poly(c, [[0, 0], [16, 0], [18, 44], [42, 52], [42, 64], [4, 64]]); c.fill();
      c.strokeStyle = rgba(YEL); c.lineWidth = 3; c.beginPath(); c.moveTo(2, 50); c.lineTo(40, 58); c.stroke(); c.restore();
    }
    for (const wx of [92, 330]) { c.fillStyle = rgba(BLK); c.beginPath(); c.arc(wx, 92, 30, 0, 7); c.fill(); c.fillStyle = rgba(hub); c.beginPath(); c.arc(wx, 92, 15, 0, 7); c.fill(); }
    c.restore();
  }
  palm(c, x, y, s, flip = 1) {
    c.save(); c.translate(x, y); c.scale(s * flip, s); c.strokeStyle = rgba(BLK); c.lineCap = 'round';
    c.lineWidth = 22; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(40, -170, 12, -330); c.stroke();
    c.lineWidth = 14;
    for (let i = 0; i < 7; i++) { // drooping fronds
      const a = -Math.PI * 0.97 + (i / 6) * Math.PI * 0.94, L = 170 + (i % 2) * 50;
      c.beginPath(); c.moveTo(12, -330); c.quadraticCurveTo(12 + Math.cos(a) * L * 0.55, -330 + Math.sin(a) * L * 0.85, 12 + Math.cos(a) * L, -330 + Math.sin(a) * L * 0.3 + 95); c.stroke();
    }
    c.restore();
  }
  sun(c, cx, cy, r, col) {
    c.save(); c.fillStyle = rgba(col);
    for (let k = 0; k < 11; k++) {
      const y0 = cy - r + k * (r * 2 / 11), h = (r * 2 / 11) * (k < 4 ? 1 : 1 - (k - 3) * 0.11);
      c.save(); c.beginPath(); c.rect(cx - r, y0, r * 2, h); c.clip(); c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill(); c.restore();
    }
    c.restore();
  }
  speedLines(c, x0, x1, t, col, n = 26) {
    c.strokeStyle = rgba(col, 0.5);
    for (let i = 0; i < n; i++) {
      const y = hash(i * 3.3) * SH, len = 140 + hash(i * 1.7) * 320, x = ((hash(i * 9.1) * (x1 - x0) + t * (900 + hash(i) * 600)) % (x1 - x0 + len)) + x0 - len;
      c.lineWidth = 2 + hash(i * 2.9) * 5; c.beginPath(); c.moveTo(x, y); c.lineTo(x + len, y); c.stroke();
    }
  }

  // ---------- split-screen panels (slanted, angular, punch apart on the kick)
  panels(c, t, kick, defs, sk = 170) {
    const n = defs.length, gap = 10 + kick * 18;
    defs.forEach((d, i) => {
      const xl = i === 0 ? -400 : (i * W) / n, xr = i === n - 1 ? W + 400 : ((i + 1) * W) / n, cx = (i * W) / n + W / n / 2;
      const oy = kick * 14 * (i % 2 ? 1 : -1);
      c.save(); poly(c, [[xl + sk / 2 + gap, -40], [xr + sk / 2 - gap, -40], [xr - sk / 2 - gap, SH + 40], [xl - sk / 2 + gap, SH + 40]]); c.clip();
      c.translate(0, oy);
      this.panelArt(c, d, cx, W / n, t, kick, i);
      c.restore();
    });
  }
  panelArt(c, d, cx, pw, t, kick, i) {
    const dir = i % 2 ? -1 : 1;
    if (d.k === 'rays') {
      this.rays(c, cx, SH * 0.52, d.bg, mix(d.bg, BLK, 0.14), 14, t * 0.14 * dir);
      c.strokeStyle = rgba(BLK, 0.9); c.lineWidth = 16 + kick * 22; c.beginPath(); c.arc(cx, SH * 0.52, 250 + kick * 30, 0, 7); c.stroke();
    } else if (d.k === 'road') {
      c.fillStyle = rgba(d.bg); c.fillRect(cx - 1200, 0, 2400, SH);
      this.speedLines(c, cx - pw, cx + pw, t * dir, mix(d.bg, BLK, 0.5), 18);
      const hy = SH * 0.52; c.fillStyle = rgba(mix(BLK, CRM, 0.13)); poly(c, [[cx - 40, hy], [cx + 40, hy], [cx + 900, SH + 20], [cx - 900, SH + 20]]); c.fill();
      c.strokeStyle = rgba(YEL); c.lineWidth = 12; c.setLineDash([60, 70]); c.lineDashOffset = -t * 500; c.beginPath(); c.moveTo(cx, hy); c.lineTo(cx, SH + 20); c.stroke(); c.setLineDash([]);
      this.camino(c, cx - 260, SH * 0.5 + 40 - kick * 16, 1.25, BLK, CRM, true, t);
    } else if (d.k === 'lips') {
      c.fillStyle = rgba(d.bg); c.fillRect(cx - 1200, 0, 2400, SH);
      c.fillStyle = this.dots; c.globalAlpha = 0.22; c.fillRect(cx - 1200, 0, 2400, SH); c.globalAlpha = 1;
      this.lips(c, cx, SH * 0.5, 2.1 + kick * 0.25, d.fg || RED);
    } else if (d.k === 'stripes') {
      c.fillStyle = rgba(d.bg); c.fillRect(cx - 1200, 0, 2400, SH);
      c.fillStyle = rgba(BLK);
      for (let k = -4; k < 8; k++) { const x = cx - 900 + k * 260 + ((t * 120 * dir) % 260); poly(c, [[x, -20], [x + 110 + kick * 40, -20], [x - 300 + 110 + kick * 40, SH + 20], [x - 300, SH + 20]]); c.fill(); }
    } else { // type
      c.fillStyle = rgba(d.bg); c.fillRect(cx - 1200, 0, 2400, SH);
      for (let k = 0; k < 6; k++) this.txt(c, 'TARANTINO', cx + ((t * 160 * (k % 2 ? 1 : -1)) % 900), 80 + k * 140, 150, SLAB, rgba(d.fg || BLK, 0.5));
    }
  }

  // ---------- reel one: film leader + cinematic subtitles
  drawReel(c, t, fr, kick) {
    c.fillStyle = '#1b1916'; c.fillRect(0, 0, W, SH);
    const cx = W / 2, cy = SH / 2 - 10, n = Math.max(1, 8 - Math.floor(t / 3.6875)), fr4 = (t % 3.6875) / 3.6875;
    c.strokeStyle = rgba(CRM, 0.85); c.lineWidth = 8; c.beginPath(); c.arc(cx, cy, 280, 0, 7); c.stroke();
    c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, 210, 0, 7); c.stroke();
    c.lineWidth = 2; c.beginPath(); c.moveTo(0, cy); c.lineTo(W, cy); c.moveTo(cx, 0); c.lineTo(cx, SH); c.stroke();
    c.fillStyle = rgba(CRM, 0.16); c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, 280, -Math.PI / 2, -Math.PI / 2 + fr4 * Math.PI * 2); c.closePath(); c.fill();
    const jit = (hash(fr * 2.3) - 0.5) * 5;
    this.txt(c, String(n), cx + jit, cy + 10, 360, SLAB, rgba(CRM, 0.92), { ext: 8, extCol: RED });
    this.txt(c, 'A GRINDHOUSE FEATURE PRESENTATION', cx, 64, 30, TYPE, rgba(CRM, 0.8), { letter: '6px' });
    this.txt(c, 'REEL 1 · PICTURE START', 130, SH - 190, 22, TYPE, rgba(CRM, 0.5), { align: 'left', letter: '3px' });
    c.save(); c.strokeStyle = rgba(CRM, 0.7); c.lineWidth = 4; c.strokeRect(W - 340, 40, 270, 62); c.restore();
    this.txt(c, 'RESTRICTED', W - 205, 72, 30, TYPE, rgba(CRM, 0.85), { letter: '4px' });
    // "TARANTINO?" stamp slams in on the line "what about Tarantino?"
    if (t >= 9.1 && t < 14.5) {
      const k = easeOut((t - 9.1) / 0.18), out = clamp((14.5 - t) / 0.5);
      c.save(); c.globalAlpha = out; this.txt(c, 'TARANTINO?', cx, 150, 150, SLAB, rgba(RED), { rot: -0.07, sc: 3 - 2 * k, stroke: rgba(CRM), lw: 9, ext: 7, extCol: BLK }); c.restore();
    }
    if (t >= 24.4) { const p = clamp((t - 24.4) / 1.2); this.txt(c, 'FLIGHT AT 8:00', cx, SH - 210, 40, TYPE, rgba(YEL, p * (0.55 + 0.45 * Math.sin(t * 9) ** 2)), { letter: '8px' }); }
  }
  drawSubs(c, t) {
    const L = this.skit.lines.find((l) => t >= l.t - 0.04 && t < l.end + 0.12);
    if (!L) return;
    const k = easeOut((t - L.t) / 0.1), col = L.who === 'a' ? YEL : CRM;
    c.save(); c.globalAlpha = clamp(k) * clamp((L.end + 0.12 - t) / 0.12);
    this.txt(c, L.text, W / 2, SH - 92 + (1 - k) * 8, 56, SUB, rgba(col), { stroke: 'rgba(0,0,0,0.95)', lw: 10, letter: '1px' });
    c.restore();
  }

  // ---------- chorus (Kill Bill yellow title cards, one notch bigger per repeat)
  drawChorus(c, t, kick, esc) {
    const defs = [[{ k: 'rays', bg: YEL }],
      [{ k: 'rays', bg: YEL }, { k: 'road', bg: RED }],
      [{ k: 'rays', bg: YEL }, { k: 'lips', bg: RED, fg: BLK }, { k: 'road', bg: CRM }]][esc];
    this.panels(c, t, kick, defs, esc ? 190 : 120);
    // Kill Bill suit stripes at the edges
    c.fillStyle = rgba(BLK);
    const sw = 56 + kick * 30;
    poly(c, [[0, 0], [sw, 0], [sw - 260, SH], [0, SH]]); c.fill(); poly(c, [[W, 0], [W - sw, 0], [W - sw + 260, SH], [W, SH]]); c.fill();
    if (esc >= 1) { c.fillStyle = this.dots; c.globalAlpha = 0.14 + 0.05 * esc; c.fillRect(0, 0, W, SH); c.globalAlpha = 1; }
  }
  drawVerse1(c, t, kick) {
    c.fillStyle = rgba(BLK); c.fillRect(0, 0, W, SH);
    const o = (t * 40) % 340;
    c.fillStyle = rgba(YEL, 0.12); for (let k = -2; k < 8; k++) { const x = k * 340 + o * 2 - 300; poly(c, [[x + 260, -10], [x + 360, -10], [x + 60, SH + 10], [x - 40, SH + 10]]); c.fill(); }
    c.fillStyle = rgba(RED); poly(c, [[0, SH - 150], [W, SH - 190], [W, SH - 176], [0, SH - 136]]); c.fill();
    // road + headlights (line 2: "pullin' up to the motel")
    const lp = easeOut((t - 64.4) / 3.2), hy = SH - 150;
    if (lp > 0) { c.save(); c.globalCompositeOperation = 'screen'; c.fillStyle = rgba(YEL, 0.2 * (1 - 0.3 * lp)); poly(c, [[-40 + lp * 150, hy + 40], [900 * lp + 200, hy - 70], [900 * lp + 200, hy + 150]]); c.fill(); c.restore(); }
    // MOTEL neon, flickers
    const fl = hash(Math.floor(t * 12)) > 0.9 ? 0.35 : 1, sx = 0, sy = 40;
    c.save(); c.translate(W - 340, 24); c.scale(0.72, 0.72);
    c.fillStyle = rgba(mix(BLK, CRM, 0.12)); c.fillRect(sx + 188, sy + 120, 24, SH);
    c.fillStyle = rgba(BLK); c.fillRect(sx, sy - 30, 400, 220); c.strokeStyle = rgba(CRM, 0.7); c.lineWidth = 6; c.strokeRect(sx + 4, sy - 26, 392, 212);
    this.txt(c, 'MOTEL', sx + 200, sy + 38, 104, WEST, rgba(RED, fl), { glow: RED, glowB: 30 * fl });
    this.txt(c, 'VACANCY', sx + 200, sy + 134, 62, SLAB, rgba(YEL, (0.55 + 0.45 * kick) * fl), { glow: YEL, glowB: 22 });
    c.restore();
    // mustard splats on the sneakers (word "mustard" lands)
    const ms = (this.cue.mustard || [999])[0], mp = easeOut((t - ms) / 0.25);
    if (mp > 0) { c.fillStyle = rgba(YEL); for (let k = 0; k < 9; k++) { const a = hash(k * 4.7) * 6.28, d = (60 + hash(k) * 220) * mp; c.beginPath(); c.arc(250 + Math.cos(a) * d * 1.6, SH - 70 + Math.sin(a) * d * 0.25, (8 + hash(k * 3) * 26) * mp, 0, 7); c.fill(); } }
  }
  drawPre(c, t, kick, esc) {
    const defs = esc ? [{ k: 'road', bg: RED }, { k: 'stripes', bg: YEL }, { k: 'road', bg: CRM }, { k: 'type', bg: BLK, fg: YEL }]
      : [{ k: 'road', bg: RED }, { k: 'stripes', bg: YEL }, { k: 'road', bg: CRM }];
    const crash = (this.cue.stunts || []).reduce((m, s) => Math.max(m, t >= s ? easeOut(1 - (t - s) / 0.35) : 0), 0);
    this.panels(c, t, Math.min(1, kick + crash), defs, 230);
    c.fillStyle = this.dots; c.globalAlpha = 0.12; c.fillRect(0, 0, W, SH); c.globalAlpha = 1;
  }
  drawVerse2(c, t, kick) {
    const g = c.createLinearGradient(0, 0, 0, SH); g.addColorStop(0, rgba(CRM)); g.addColorStop(0.62, rgba(mix(CRM, YEL, 0.7))); g.addColorStop(1, rgba(YEL));
    c.fillStyle = g; c.fillRect(0, 0, W, SH);
    this.sun(c, 1380, 300 - kick * 6, 215 + kick * 8, RED);
    c.fillStyle = rgba(SAND); poly(c, [[0, SH * 0.78], [380, SH * 0.7], [820, SH * 0.8], [1300, SH * 0.72], [1920, SH * 0.8], [1920, SH], [0, SH]]); c.fill();
    c.fillStyle = rgba(DUNE); poly(c, [[0, SH * 0.9], [600, SH * 0.84], [1200, SH * 0.92], [1920, SH * 0.86], [1920, SH], [0, SH]]); c.fill();
    this.palm(c, 150, SH * 0.88, 1.15, 1); this.palm(c, W - 130, SH * 0.9, 1.25, -1);
    // katana / chop slashes on the key words
    const hits = [...(this.cue.katana || []).map((s) => [s, 0, 1]), ...(this.cue['chop-chop'] || []).map((s) => [s, 1, 0.7]), ...(this.cue.chopper || []).map((s) => [s, 2, 0.8])];
    for (const [s, v, sc] of hits) {
      const p = (t - s) / 0.42; if (p < 0 || p > 1) continue;
      const a = [-0.5, 0.45, -0.2][v], len = 2400 * sc, e = easeOut(p * 2.2), x0 = W / 2 - Math.cos(a) * len / 2, y0 = SH / 2 - Math.sin(a) * len / 2;
      c.save(); c.lineCap = 'round'; c.globalAlpha = 1 - p * p;
      c.strokeStyle = rgba(CRM); c.lineWidth = 26 * (1 - p); c.shadowColor = rgba(YEL); c.shadowBlur = 36; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + Math.cos(a) * len * e, y0 + Math.sin(a) * len * e); c.stroke();
      c.strokeStyle = rgba(RED); c.lineWidth = 8 * (1 - p); c.beginPath(); c.moveTo(x0, y0 + 20); c.lineTo(x0 + Math.cos(a) * len * e, y0 + 20 + Math.sin(a) * len * e); c.stroke(); c.restore();
    }
  }
  drawPost(c, t, kick) {
    c.fillStyle = rgba(BLK); c.fillRect(0, 0, W, SH);
    c.save(); c.globalCompositeOperation = 'screen';
    for (let i = 0; i < 4; i++) {
      const bx = i % 2 ? W * 0.82 : W * 0.18, a = -Math.PI / 2 + Math.sin(t * 0.9 + i * 1.7) * 0.7 * (i % 2 ? -1 : 1), L = 1400, w = 0.16 + kick * 0.06;
      c.fillStyle = rgba(i < 2 ? YEL : CRM, 0.17); poly(c, [[bx, SH + 20], [bx + Math.cos(a - w) * L, SH + Math.sin(a - w) * L], [bx + Math.cos(a + w) * L, SH + Math.sin(a + w) * L]]); c.fill();
    }
    c.restore();
    for (let k = 0; k < 4; k++) this.txt(c, 'TARANTINO', W / 2 + ((t * 120 * (k % 2 ? 1 : -1)) % 700), 90 + k * 210, 190, SLAB, rgba(RED, 0.16 + kick * 0.14));
  }
  drawOutro(c, t, kick) {
    const g = c.createLinearGradient(0, 0, 0, SH); g.addColorStop(0, rgba(BLK)); g.addColorStop(0.55, rgba(mix(RED, BLK, 0.35))); g.addColorStop(0.82, rgba(RED)); g.addColorStop(1, rgba(YEL));
    c.fillStyle = g; c.fillRect(0, 0, W, SH);
    c.save(); c.globalCompositeOperation = 'screen';
    for (let i = 0; i < 3; i++) { const bx = W * (0.2 + i * 0.3), a = -Math.PI / 2 + Math.sin(t * 0.7 + i * 2.1) * 0.5, L = 1300; c.fillStyle = rgba(CRM, 0.11); poly(c, [[bx, SH], [bx + Math.cos(a - 0.1) * L, SH + Math.sin(a - 0.1) * L], [bx + Math.cos(a + 0.1) * L, SH + Math.sin(a + 0.1) * L]]); c.fill(); }
    c.restore();
    c.fillStyle = rgba(BLK); poly(c, [[0, SH], [0, SH * 0.3], [400, SH * 0.27], [900, SH * 0.25], [1300, SH * 0.23], [1920, SH * 0.3], [1920, SH]]); c.fill();
    c.save(); c.translate(W / 2, SH * 0.14); c.transform(1, 0, -0.12, 1, 0, 0);
    this.txt(c, 'HOLLYWOOD', 0, 0, 96, SLAB, rgba(CRM, 0.92), { letter: '12px', ext: 5, extCol: mix(BLK, RED, 0.3) });
    c.fillStyle = rgba(CRM, 0.3 + 0.3 * kick); c.fillRect(-360, 62, 720, 4); c.restore();
  }

  // ---------- end credits + FIN
  drawCredits(c, t) {
    c.fillStyle = rgba(BLK); c.fillRect(0, 0, W, SH);
    const HT = { big: 220, small: 48, gap: 54, role: 46, name: 54 }, lines = this.credits.lines, total = lines.reduce((s, l) => s + HT[l.k], 0);
    const p = clamp((t - this.credits.a) / (this.credits.scrollEnd - this.credits.a)), y0 = SH + 20 - p * (total + SH + 60);
    let y = y0;
    for (const l of lines) {
      const h = HT[l.k], cy = y + h / 2; y += h;
      if (cy < -120 || cy > SH + 120) continue;
      if (l.k === 'big') this.txt(c, l.text, W / 2, cy, 170, SCRIPT, rgba(YEL), { ext: 8, extCol: RED });
      else if (l.k === 'small') this.txt(c, l.text, W / 2, cy, 24, TYPE, rgba(CRM, 0.7), { letter: '4px' });
      else if (l.k === 'role') this.txt(c, l.text, W / 2, cy, 38, SCRIPT, rgba(YEL), { letter: '2px' });
      else if (l.k === 'name') this.txt(c, l.text, W / 2, cy, 34, TYPE, rgba(CRM), { letter: '3px' });
    }
    c.fillStyle = rgba(RED); c.fillRect(150, 0, 6, SH); c.fillRect(W - 156, 0, 6, SH);
    c.fillStyle = rgba(CRM, 0.18);
    for (let i = 0; i < 12; i++) { const yy = ((i * 130 + t * 60) % (SH + 130)) - 40; c.fillRect(80, yy, 36, 60); c.fillRect(W - 116, yy, 36, 60); } // sprocket holes
  }
  drawFin(c, t, fr, t0) {
    const p = easeOut((t - t0) / 0.7);
    c.fillStyle = rgba(BLK); c.fillRect(0, 0, W, SH);
    c.save(); c.beginPath(); c.arc(W / 2, SH / 2, 1500 * p, 0, 7); c.clip();
    c.fillStyle = rgba(CRM); c.fillRect(0, 0, W, SH);
    c.strokeStyle = rgba(RED); c.lineWidth = 12; c.strokeRect(90, 60, W - 180, SH - 120); c.lineWidth = 3; c.strokeRect(116, 86, W - 232, SH - 172);
    this.txt(c, 'FIN', W / 2, SH / 2 - 30, 430, WEST, rgba(RED), { ext: 10, extCol: BLK });
    this.txt(c, 'LISA  ·  TARANTINO', W / 2, SH - 160, 34, TYPE, rgba(BLK), { letter: '10px' });
    c.restore();
  }

  // ---------- lyrics (title plate + karaoke words)
  drawLyrics(c, t, kind, esc, kick, fr) {
    const k = this.curIdx(t); if (k < 0) return;
    const l = this.lines[k], lay = this.lay[k];
    const cy = (t >= 31 && t < 33.8 ? SH * 0.76 : kind === 'verse1' ? SH * 0.6 : SH * 0.56), left = kind === 'verse1';
    const inK = easeBack((t - (l.t - 0.2)) / 0.28), outA = clamp((l.end + 0.5 - t) / 0.22), isTar = /^tarantino/i.test(l.text);
    const rowH = lay.S * 1.1, th = lay.rows.length * rowH;
    const pulse = 1 + (0.025 + 0.02 * esc) * kick + (isTar ? 0.07 * kick : 0), tilt = kind === 'chorus' ? Math.sin(t * 2.4) * 0.01 * esc : kind === 'pre' ? -0.015 : 0;
    const shake = isTar ? (hash(fr * 2.1) - 0.5) * 6 * (1 + esc) : 0, sc = pulse * (0.9 + 0.1 * clamp(inK, 0, 1.2));
    c.save(); c.globalAlpha = outA * clamp(inK + 0.2);
    c.translate(left ? 160 : W / 2, cy); c.rotate(tilt); c.scale(sc, sc); c.translate(shake, shake * 0.6);
    const pa = PLATE[kind] || 0;
    if (pa) {
      const hh = th / 2 + 34, x0 = left ? -60 : -W / 2 + 150, x1 = left ? W - 280 : W / 2 - 150, sk = 44;
      c.fillStyle = rgba(BLK, pa); poly(c, [[x0 + sk, -hh], [x1 + sk, -hh], [x1 - sk, hh], [x0 - sk, hh]]); c.fill();
      c.strokeStyle = rgba(YEL); c.lineWidth = 5; c.beginPath(); c.moveTo(x0 + sk, -hh); c.lineTo(x1 + sk, -hh); c.stroke();
      c.strokeStyle = rgba(RED); c.lineWidth = 9; c.beginPath(); c.moveTo(x0 - sk, hh); c.lineTo(x1 - sk, hh); c.stroke();
    }
    lay.rows.forEach((row, ri) => {
      const S = lay.S, ws = row.map((i) => lay.items[i].w100 * S / 100), gp = lay.gap100 * S / 100, rw = ws.reduce((a, b) => a + b, 0) + gp * (row.length - 1);
      let x = left ? 0 : -rw / 2; const y = -th / 2 + rowH * (ri + 0.5);
      row.forEach((wi, j) => {
        const it = lay.items[wi], w = l.words[wi], sung = t >= w.s, act = t >= w.s && t < w.e + 0.14, cx = x + ws[j] / 2;
        const pop = 1 + 0.07 * (1 - easeOut((t - w.s) / 0.22)) * (sung ? 1 : 0);
        c.save(); c.translate(cx, y); c.scale(pop, pop);
        const size = it.echo ? S * 0.5 : S, font = it.echo ? SCRIPT : SLAB;
        if (!sung) this.txt(c, it.s, 0, 0, size, font, rgba(CRM, 0.36));
        else if (it.echo) this.txt(c, it.s, 0, 0, size, font, rgba(act ? YEL : CRM, 0.92), { ext: 3, extCol: RED });
        else if (it.key) this.txt(c, it.s, 0, 0, size, font, rgba(act ? CRM : YEL), { ext: 9, extCol: RED, stroke: rgba(BLK), lw: 6 });
        else this.txt(c, it.s, 0, 0, size, font, rgba(act || kind === 'verse1' ? YEL : CRM), { ext: 5, extCol: RED });
        c.restore();
        x += ws[j] + gp;
      });
    });
    c.restore();
  }

  // ---------- cards, cuts
  drawTitleCard(c, t) {
    const a = 29.65, b = 36.0; if (t < a || t > b) return;
    const k = easeOut((t - a) / 0.3), out = clamp((b - t) / 0.5);
    c.save(); c.globalAlpha = out; this.txt(c, 'LISA', W / 2, 150, 34, TYPE, rgba(CRM), { letter: '24px', stroke: rgba(BLK), lw: 10 });
    this.txt(c, 'Tarantino', W / 2, 310, 270, SCRIPT, rgba(RED), { rot: -0.04, sc: 2.4 - 1.4 * k, stroke: rgba(CRM), lw: 14, ext: 12, extCol: BLK }); c.restore();
  }
  drawChapterCard(c, t) {
    const { i, ch } = this.chapterAt(t); if (i < 2 || i > 6) return;
    const age = t - ch.a, dur = 2.6; if (age < 0.25 || age > dur) return;
    const k = easeBack((age - 0.25) / 0.35), out = clamp((dur - age) / 0.4);
    c.save(); c.globalAlpha = out; c.translate(70 - (1 - k) * 700, 76); c.rotate(-0.025);
    c.fillStyle = rgba(YEL); poly(c, [[0, 0], [760, -6], [780, 150], [-6, 156]]); c.fill();
    c.fillStyle = rgba(RED); c.fillRect(-6, 140, 790, 16);
    this.txt(c, `CHAPTER ${ROMAN[i]}`, 28, 30, 26, TYPE, rgba(BLK), { align: 'left', letter: '8px' });
    this.txt(c, ch.name, 28, 88, this.fit(ch.name, SCRIPT, 720, 74), SCRIPT, rgba(BLK), { align: 'left', ext: 3, extCol: RED });
    c.restore();
  }
  drawCuts(c, t) {
    SEQ.forEach(([s], i) => {
      if (i === 0) return;
      const age = t - s;
      if (age > -1.15 && age < -0.8) { c.strokeStyle = rgba(CRM, 0.9); c.lineWidth = 6; c.beginPath(); c.arc(W - 90, 70, 24, 0, 7); c.stroke(); } // projectionist cue mark
      if (age >= 0 && age < 0.3) { // angular yellow wedge wipes the old frame off to the right
        const e = (age / 0.3) * (W + 520) - 260;
        c.fillStyle = rgba(YEL); poly(c, [[e + 260, 0], [W + 300, 0], [W + 300, SH], [e - 260, SH]]); c.fill();
        c.fillStyle = rgba(RED); poly(c, [[e + 260, 0], [e + 330, 0], [e - 190, SH], [e - 260, SH]]); c.fill();
      }
      if (age >= 0 && age < 0.55) { // film burn at the splice
        const p = age / 0.55, bx = hash(i * 9.1) * W, by = i % 2 ? 0 : SH, g = c.createRadialGradient(bx, by, 10, bx, by, 560);
        g.addColorStop(0, rgba([255, 220, 120], (1 - p) ** 2)); g.addColorStop(0.35, rgba([255, 110, 0], 0.65 * (1 - p) ** 2)); g.addColorStop(1, 'rgba(208,0,0,0)');
        c.save(); c.globalCompositeOperation = 'screen'; c.fillStyle = g; c.fillRect(0, 0, W, SH); c.restore();
      }
      if (age >= 0 && age < 0.09) { c.save(); c.globalCompositeOperation = 'difference'; c.fillStyle = rgba(CRM); c.fillRect(0, 0, W, SH); c.restore(); } // negative flash
    });
  }
}
