// Olivia Rodrigo ft. Chappell Roan - expectations: "The Big Expectations Show". Canvas2D, deterministic render(t) (seek / frame-capture safe).
// Concept: 1970s/80s TV game show x Y2K riot-grrrl zine. Palette: CRT studio black #0F0F14, Olivia purple #8A2BE2/#5B18A7,
// Chappell pink #FF1493/#E6005C, prize gold #FFD700, cyan accent #00F5FF (+ paper white for zine text).
// Song mode: sunburst set -> bulb marquee -> LED scoreboard -> game-show karaoke (keyword stickers, strike/ding buzzers) -> chyron -> CRT.
// Skit mode: SMPTE bars + analog static + host chyrons / contestant cards / survey board. No external video, 100% procedural.

const W = 1920, H = 1080;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const lift = (c, k = 0.4) => [c[0] + (255 - c[0]) * k, c[1] + (255 - c[1]) * k, c[2] + (255 - c[2]) * k];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const easeOut = (x) => 1 - (1 - clamp(x)) ** 3;
const easeBack = (x) => { x = clamp(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; };
const DISP = '"Bungee", Impact, sans-serif', MONO = '"Rubik Mono One", "Arial Black", sans-serif';
const LED = '"VT323", Consolas, monospace', HAND = '"Permanent Marker", "Comic Sans MS", cursive';

const BG = hex('#0F0F14'), GOLD = hex('#FFD700'), CYAN = hex('#00F5FF'), PAPER = [244, 239, 230];
const SING = ['olivia', 'chappell'];
const INFO = {
  olivia: { col: hex('#8A2BE2'), dark: hex('#5B18A7'), name: 'OLIVIA', full: 'OLIVIA RODRIGO', num: 1 },
  chappell: { col: hex('#FF1493'), dark: hex('#E6005C'), name: 'CHAPPELL', full: 'CHAPPELL ROAN', num: 2 },
};
const KEYS = new Set(['fake', 'job', 'passive', 'expectations', 'unattractive', 'stipulations']);
// first-word triggers for the buzzers: strike = wrong answer X, ding = survey says
const BUZZ = {
  fake: { text: 'FAKE JOB', kind: 'x', pts: 100 }, passive: { text: 'PASSIVE', kind: 'x', pts: 100 },
  unattractive: { text: 'UNATTRACTIVE', kind: 'x', pts: 100 }, stipulations: { text: 'ZERO STIPULATIONS', kind: 'ok', pts: 100 },
  expectations: { text: 'EXPECTATIONS', kind: 'ok', pts: 250 },
};
const ESC = { verse1: 0, pre1: 0.3, chorus1: 1, verse2: 0.3, pre2: 0.6, chorus2: 1.6, bridge: 2.2, chorus3: 3 };
const NOTES = {
  verse1: ['red flag #1', 130, 270, -4], pre1: ['growth era!!', 1300, 270, 3], chorus1: ['no more fake jobs', 120, 270, -3],
  verse2: ['classic L.A.', 1350, 270, 4], pre2: ['adored x5', 130, 270, -3], chorus2: ['not settling', 1330, 270, 3],
  bridge: ['BIG!!', 1450, 300, 6], chorus3: ['these days...', 120, 270, -4],
};

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export class Scene {
  constructor(canvas, an, lines, meta) {
    this.canvas = canvas; this.g = canvas.getContext('2d');
    this.T = document.createElement('canvas'); this.T.width = 16; this.T.height = 16; this.tg = this.T.getContext('2d');
    this.nw = 240; this.nh = 135;
    this.nzC = document.createElement('canvas'); this.nzC.width = this.nw; this.nzC.height = this.nh;
    this.nzG = this.nzC.getContext('2d'); this.nzD = this.nzG.createImageData(this.nw, this.nh);
    this.an = an; this.meta = meta; this.sectionName = '';
    const n = an.kick.length, kd = Math.exp(-6 / an.fps);
    this.kickE = new Float32Array(n);
    for (let i = 1; i < n; i++) this.kickE[i] = Math.max(this.kickE[i - 1] * kd, an.kick[i] > 0.5 ? an.kick[i] : 0);
    this.scan = this.makeScan(); this.vig = this.makeVignette(); this.halftone = this.makeHalftone();
    this.barsC = this.makeBars(); this.bulbs = this.makeBulbs();
    this.skits = meta.skits || []; this.chapters = meta.chapters || [];
    this.cuts = this.skits.flatMap((s) => [s.a, s.b]).filter((x) => x > 1 && x < an.duration - 1);
    this.setLines(lines);
  }

  // ---------- static resources
  makeScan() {
    const c = document.createElement('canvas'); c.width = 4; c.height = 4;
    const g = c.getContext('2d'); g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(0, 2, 4, 2);
    return this.g.createPattern(c, 'repeat');
  }
  makeVignette() {
    const c = document.createElement('canvas'); c.width = W / 4; c.height = H / 4;
    const g = c.getContext('2d'), r = g.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.35, c.width / 2, c.height / 2, c.height * 1.0);
    r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(0,0,0,0.8)');
    g.fillStyle = r; g.fillRect(0, 0, c.width, c.height);
    return c;
  }
  makeHalftone() {
    const c = document.createElement('canvas'); c.width = 16; c.height = 16;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.beginPath(); g.arc(4, 4, 2.2, 0, 7); g.arc(12, 12, 2.2, 0, 7); g.fill();
    return this.g.createPattern(c, 'repeat');
  }
  makeBars() {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), top = H * 0.67, mid = H * 0.08;
    ['#C0C0C0', '#C0C000', '#00C0C0', '#00C000', '#C000C0', '#C00000', '#0000C0'].forEach((col, i) => { g.fillStyle = col; g.fillRect(Math.round(i * W / 7), 0, Math.ceil(W / 7), top); });
    ['#0000C0', '#131313', '#C000C0', '#131313', '#00C0C0', '#131313', '#C0C0C0'].forEach((col, i) => { g.fillStyle = col; g.fillRect(Math.round(i * W / 7), top, Math.ceil(W / 7), mid); });
    const by = top + mid, bh = H - by;
    [[0, 0.18, '#00214c'], [0.18, 0.36, '#ffffff'], [0.36, 0.54, '#32006a'], [0.54, 0.72, '#131313'], [0.72, 0.78, '#090909'], [0.78, 0.84, '#131313'], [0.84, 0.9, '#1d1d1d'], [0.9, 1, '#131313']]
      .forEach(([a, b, col]) => { g.fillStyle = col; g.fillRect(a * W, by, (b - a) * W + 1, bh); });
    return c;
  }
  makeBulbs() {
    const pts = [], x0 = 44, y0 = 44, x1 = W - 44, y1 = H - 44, step = 58;
    for (let x = x0; x < x1; x += step) pts.push([x, y0]);
    for (let y = y0; y < y1; y += step) pts.push([x1, y]);
    for (let x = x1; x > x0; x -= step) pts.push([x, y1]);
    for (let y = y1; y > y0; y -= step) pts.push([x0, y]);
    return pts;
  }

  // ---------- lines: layout, tallies, buzzers
  setLines(lines) {
    this.lines = [...lines].sort((a, b) => a.t - b.t);
    this.lay = this.lines.map((l) => this.layout(l));
    this.iv = { olivia: [], chappell: [] };
    for (const l of this.lines) { const w = 1 / l.singers.length; for (const s of l.singers) this.iv[s].push({ a: l.t, b: l.end, w }); }
    this.secs = this.meta.sections.map((s, i) => {
      const ls = this.lines.filter((l) => l.sec === i);
      return { id: s.id, label: s.label, a: Math.min(...ls.map((l) => l.t)), b: Math.max(...ls.map((l) => l.end)), singers: [...new Set(ls.flatMap((l) => l.singers))], n: ls.length };
    }).sort((a, b) => a.a - b.a);
    this.buzz = [];
    let lastFlash = -9;
    this.lines.forEach((l, li) => {
      l.words.forEach((w) => {
        const k = BUZZ[w.w.toLowerCase().replace(/[^a-z']/g, '')];
        if (!k) return;
        const flash = w.s - lastFlash >= 0.9; if (flash) lastFlash = w.s;
        this.buzz.push({ t: w.s, ...k, who: l.singers, flash, li });
      });
    });
    this.buzz.sort((a, b) => a.t - b.t);
  }
  layout(line) {
    const c = this.tg; c.font = `400 100px ${DISP}`;
    let inE = false;
    const items = line.words.map((w) => {
      let s = w.w; const echo = inE || s.startsWith('(');
      if (s.startsWith('(')) inE = true;
      if (s.endsWith(')')) inE = false;
      s = s.replace(/[()]/g, '').toUpperCase();
      return { s, echo, w100: c.measureText(s).width * (echo ? 0.55 : 1) };
    });
    const gap100 = c.measureText(' ').width * 0.7 + 8, MAXW = 1560;
    let S = 132, rows;
    for (; S >= 52; S -= 4) {
      rows = [[]]; let cur = 0;
      items.forEach((it, i) => {
        const add = (rows[rows.length - 1].length ? gap100 : 0) * S / 100 + it.w100 * S / 100;
        if (cur + add > MAXW && rows[rows.length - 1].length) { rows.push([]); cur = 0; }
        cur += (rows[rows.length - 1].length ? gap100 : 0) * S / 100 + it.w100 * S / 100; rows[rows.length - 1].push(i);
      });
      if (rows.length <= 3) break;
    }
    return { S, rows, items, gap100 };
  }

  sung(s, t) { let v = 0; for (const x of this.iv[s]) v += x.w * clamp(t - x.a, 0, x.b - x.a); return v; }
  score(s, t) {
    let b = 0;
    for (const z of this.buzz) if (z.who.includes(s) && t >= z.t) b += z.pts * easeOut((t - z.t) / 0.3);
    return Math.round(this.sung(s, t) * 40 + b);
  }
  kickAt(t) { return this.kickE[clamp(Math.floor(t * this.an.fps), 0, this.kickE.length - 1)]; }
  midAt(t) { return this.an.mid[clamp(Math.floor(t * this.an.fps), 0, this.an.mid.length - 1)]; }
  skitAt(t) { return this.skits.find((s) => t >= s.a && t < s.b) || null; }
  curIdx(t) {
    let k = -1;
    for (let i = 0; i < this.lines.length; i++) if (this.lines[i].t - 0.35 <= t) k = i; else break;
    return k >= 0 && t <= this.lines[k].end + 0.9 ? k : -1;
  }
  chapterAt(t) {
    const i = this.chapters.findIndex((c) => t >= c.a && t < c.b), name = i < 0 ? '' : this.chapters[i].name;
    return { i, name, label: i <= 0 || name === 'SIGN-OFF' ? name : `ROUND ${i} · ${name}` };
  }
  secAt(t) { return this.secs.find((s) => t >= s.a - 0.35 && t <= s.b + 0.9) || null; }

  // ---------- main
  render(t) {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.shadowBlur = 0;
    const kick = this.kickAt(t), sk = this.skitAt(t);
    g.fillStyle = rgba(BG); g.fillRect(0, 0, W, H);
    this.sectionName = sk ? sk.id : (this.secAt(t) || { id: '-' }).id;
    let flash = null;
    if (sk) this.drawSkit(g, t, sk, kick); else flash = this.drawSong(g, t, kick);
    this.drawCuts(g, t);
    if (flash) this.drawFlash(g, flash);
    this.drawCRT(g, t, kick, !!sk);
    if (t > this.an.duration - 0.8) { g.fillStyle = `rgba(0,0,0,${clamp((t - (this.an.duration - 0.8)) / 0.8)})`; g.fillRect(0, 0, W, H); }
  }

  // ---------- text helpers
  txt(c, s, x, y, size, font, fill, o = {}) {
    c.save(); c.translate(x, y); if (o.rot) c.rotate(o.rot); if (o.sc) c.scale(o.sc, o.sc);
    c.font = `400 ${size}px ${font}`; c.textAlign = o.align || 'center'; c.textBaseline = 'middle';
    if (o.letter) c.letterSpacing = o.letter;
    if (o.ext) { c.fillStyle = rgba(o.extCol || BG); for (let i = o.ext; i >= 1; i--) c.fillText(s, i * 0.8, i * 0.9); }
    if (o.shadow) { c.fillStyle = rgba(o.shadow, 0.9); c.fillText(s, o.sx || 5, o.sy || 5); }
    if (o.glow) { c.shadowColor = rgba(o.glow, 0.9); c.shadowBlur = o.glowB || 24; }
    if (o.stroke) { c.lineWidth = o.lw || 3; c.strokeStyle = o.stroke; c.lineJoin = 'round'; c.strokeText(s, 0, 0); }
    if (fill) { c.fillStyle = fill; c.fillText(s, 0, 0); }
    c.restore();
  }
  fitSize(s, font, maxW, maxS) { const c = this.tg; c.font = `400 100px ${font}`; return Math.min(maxS, (maxW / c.measureText(s).width) * 100); }
  plate(g, x, y, w, h, border, fill = BG, bw = 6) {
    g.fillStyle = rgba(fill); g.fillRect(x, y, w, h);
    g.lineWidth = bw; g.strokeStyle = rgba(border); g.strokeRect(x + bw / 2, y + bw / 2, w - bw, h - bw);
  }

  // ---------- backdrop
  rays(g, t, col, alpha, count, rot, cx = 960, cy = 590) {
    const gr = g.createRadialGradient(cx, cy, 60, cx, cy, 1500);
    gr.addColorStop(0, rgba(col, alpha)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; const da = Math.PI / count;
    for (let i = 0; i < count; i++) {
      const a = rot + i * da * 2;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 1900 * Math.cos(a), cy + 1900 * Math.sin(a)); g.lineTo(cx + 1900 * Math.cos(a + da), cy + 1900 * Math.sin(a + da)); g.closePath(); g.fill();
    }
  }
  marquee(g, t, speed, lit, col = GOLD) {
    const n = this.bulbs.length, ph = Math.floor(t * speed);
    for (let i = 0; i < n; i++) {
      const on = lit || (((i + ph) % 3) === 0);
      const [x, y] = this.bulbs[i];
      if (on) { g.fillStyle = rgba(col, 0.28); g.beginPath(); g.arc(x, y, 17, 0, 7); g.fill(); g.fillStyle = rgba(lift(col, 0.55)); }
      else g.fillStyle = rgba(col, 0.16);
      g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill();
    }
  }
  noise(g, a, seed, scale = 1) {
    const d = this.nzD.data, r = rng(seed * 7919 + 13);
    for (let i = 0; i < d.length; i += 4) { const v = (r() * 255) | 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    this.nzG.putImageData(this.nzD, 0, 0);
    g.save(); g.globalAlpha = clamp(a); g.imageSmoothingEnabled = false; g.drawImage(this.nzC, 0, 0, W, H * scale); g.restore();
  }

  // ---------- scoreboard
  board(g, t, o) {
    const act = o.active || [];
    const side = (s, x, label) => {
      const inf = INFO[s], on = act.includes(s), pulse = on ? 1 + 0.02 * Math.sin(t * 20) : 1;
      g.save(); g.translate(x + 265, 128); g.scale(pulse, pulse); g.translate(-265, -62);
      g.fillStyle = rgba(BG); g.fillRect(0, 0, 530, 124);
      g.fillStyle = rgba(on ? inf.col : inf.dark, on ? 0.95 : 0.7); g.fillRect(0, 0, 530, 44);
      this.txt(g, label || inf.name, 18, 24, 32, DISP, '#fff', { align: 'left' });
      this.txt(g, on ? 'ON AIR' : 'WAITING', 512, 24, 22, MONO, rgba(on ? GOLD : [200, 200, 210], on ? 1 : 0.6), { align: 'right' });
      g.lineWidth = 6; g.strokeStyle = rgba(on ? lift(inf.col, 0.35) : inf.dark); g.strokeRect(3, 3, 524, 118);
      const v = String(this.score(s, t)).padStart(5, '0');
      g.font = `400 84px ${LED}`; g.textAlign = 'right'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(255,215,0,0.09)'; g.fillText('88888', 506, 88);
      g.shadowColor = rgba(GOLD, 0.9); g.shadowBlur = on ? 22 : 8; g.fillStyle = rgba(GOLD); g.fillText(v, 506, 88);
      g.restore();
    };
    side('olivia', 80, o.left); side('chappell', 1310, o.right);
    const title = o.title || 'THE BIG EXPECTATIONS SHOW';
    g.fillStyle = rgba(BG); g.fillRect(640, 66, 640, 124);
    g.lineWidth = 6; g.strokeStyle = rgba(GOLD); g.strokeRect(643, 69, 634, 118);
    this.txt(g, title, 960, 100, this.fitSize(title, MONO, 580, 28), MONO, rgba(GOLD));
    this.txt(g, o.sub || '', 960, 152, 40, LED, rgba(CYAN), { letter: '4px', glow: CYAN, glowB: 10 });
  }
  lowerThird(g, t, a, b, title, sub, col, tag) {
    if (t < a || t > b) return;
    const k = easeBack((t - a) / 0.5) * easeOut((b - t) / 0.4), x = -820 + 820 * k + 70, fs = this.fitSize(title, DISP, 760, 60);
    g.save(); g.translate(x, 850);
    g.fillStyle = rgba(col); g.fillRect(-10, 8, 18, 150); g.fillStyle = rgba(BG, 0.94); g.fillRect(8, 8, 800, 150);
    g.fillStyle = rgba(GOLD); g.fillRect(8, 8, 800, 6);
    this.txt(g, tag || 'NOW PLAYING', 28, 36, 20, MONO, rgba(CYAN), { align: 'left', letter: '3px' });
    this.txt(g, title, 28, 88, fs, DISP, '#fff', { align: 'left', shadow: col, sx: 4, sy: 4 });
    this.txt(g, sub || '', 28, 136, 22, MONO, rgba(lift(col, 0.55)), { align: 'left', letter: '2px' });
    g.restore();
  }

  // ---------- song mode
  drawSong(g, t, kick) {
    const sec = this.secAt(t), ci = this.curIdx(t), L = ci >= 0 ? this.lines[ci] : null;
    const who = L ? L.singers : [];
    const base = sec ? ESC[sec.id] ?? 0 : 0;
    const bridge = !!sec && sec.id === 'bridge';
    const mix = who.length === 2 ? GOLD : who.length ? INFO[who[0]].col : [180, 120, 255];
    // set: sunburst + split for the bridge
    if (bridge) {
      const bp = clamp((t - sec.a) / (sec.b - sec.a));
      g.fillStyle = rgba(INFO.olivia.dark, 0.5); g.beginPath(); g.moveTo(0, 0); g.lineTo(1000 + bp * 60, 0); g.lineTo(840 - bp * 60, H); g.lineTo(0, H); g.fill();
      g.fillStyle = rgba(INFO.chappell.dark, 0.45); g.beginPath(); g.moveTo(1000 + bp * 60, 0); g.lineTo(W, 0); g.lineTo(W, H); g.lineTo(840 - bp * 60, H); g.fill();
      this.rays(g, t, INFO.olivia.col, 0.22 + kick * 0.1, 14, t * 0.12, 700, 590);
      this.rays(g, t, INFO.chappell.col, 0.22 + kick * 0.1, 14, -t * 0.12, 1220, 590);
      g.strokeStyle = rgba(GOLD, 0.9); g.lineWidth = 6; g.beginPath(); g.moveTo(1000 + bp * 60, 0); g.lineTo(840 - bp * 60, H); g.stroke();
    } else {
      this.rays(g, t, mix, 0.10 + base * 0.035 + kick * 0.07, 12 + Math.floor(base * 4), t * (0.05 + base * 0.03));
    }
    g.fillStyle = this.halftone; g.globalAlpha = 0.05 + kick * 0.03; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
    // buzzer state
    const hit = this.buzz.filter((z) => t >= z.t && t - z.t < 1.0).pop();
    const speed = 5 + base * 4 + (L && t > L.t ? 2 : 0);
    this.marquee(g, t, speed, hit ? t - hit.t < 0.22 : false, hit && hit.kind === 'x' ? INFO.chappell.col : GOLD);
    // scoreboard
    const ch = this.chapterAt(t);
    let count = '';
    if (bridge && L) count = `EXPECTATIONS x${this.lines.filter((l) => l.sec === L.sec && l.t <= t).length}`;
    this.board(g, t, { active: who, sub: count || ch.label });
    // zine scrawl per section
    const note = sec && NOTES[sec.id];
    if (note && t > sec.a + 0.6 && t < sec.b + 0.4) {
      const p = clamp((t - sec.a - 0.6) / 0.7), nw = this.measureHand(note[0]);
      g.save(); g.beginPath(); g.rect(note[1] - 40, note[2] - 90, (nw + 120) * p, 180); g.clip();
      g.fillStyle = rgba(GOLD, 0.92); g.save(); g.translate(note[1] - 10, note[2]); g.rotate(note[3] * Math.PI / 180); g.fillRect(-14, -44, nw + 40, 78); g.restore();
      this.txt(g, note[0], note[1] + 10, note[2] - 4, 54, HAND, rgba(BG), { rot: note[3] * Math.PI / 180, align: 'left' });
      g.restore();
    }
    if (hit) this.drawBuzz(g, t, hit);
    if (L) this.drawLine(g, t, ci, sec, bridge);
    this.drawNext(g, t, ci);
    if (sec) {
      const names = sec.singers.length === 2 ? 'OLIVIA & CHAPPELL' : INFO[sec.singers[0]].full;
      this.lowerThird(g, t, sec.a - 0.05, sec.a + 3.6, names, `${sec.label.toUpperCase()} · ${ch.name}`, sec.singers.length === 2 ? GOLD : INFO[sec.singers[0]].col,
        sec.singers.length === 2 ? 'DUET ROUND' : `CONTESTANT #${INFO[sec.singers[0]].num}`);
    }
    return hit && hit.flash && t - hit.t < 0.28 ? { t: t - hit.t, big: base >= 1, col: hit.kind === 'x' ? INFO.chappell.col : GOLD } : null;
  }
  measureHand(s) { const c = this.tg; c.font = `400 54px ${HAND}`; return c.measureText(s).width; }

  drawBuzz(g, t, z) {
    const dt = t - z.t, a = clamp(1 - dt / 1.0), pop = easeBack(dt / 0.25);
    g.save(); g.translate(960, 600); g.globalAlpha = a * 0.9;
    if (z.kind === 'x') {
      g.rotate(0.05); g.scale(pop, pop); g.lineCap = 'square';
      g.strokeStyle = rgba(INFO.chappell.col); g.lineWidth = 78;
      g.beginPath(); g.moveTo(-250, -250); g.lineTo(250, 250); g.moveTo(250, -250); g.lineTo(-250, 250); g.stroke();
      g.strokeStyle = rgba(BG, 0.6); g.lineWidth = 20; g.beginPath(); g.moveTo(-250, -250); g.lineTo(250, 250); g.moveTo(250, -250); g.lineTo(-250, 250); g.stroke();
    } else {
      g.scale(pop, pop); g.fillStyle = rgba(GOLD); g.beginPath();
      for (let i = 0; i < 24; i++) { const r = i % 2 ? 250 : 430, an = (i / 24) * Math.PI * 2 + dt * 0.6; g.lineTo(r * Math.cos(an), r * Math.sin(an)); }
      g.closePath(); g.fill();
    }
    g.restore();
    const tag = z.kind === 'x' ? 'BZZT!  STRIKE' : 'DING!  SURVEY SAYS';
    g.save(); g.translate(960, 300); g.rotate(-0.05); g.scale(pop, pop); g.globalAlpha = clamp(a * 3);
    g.fillStyle = rgba(z.kind === 'x' ? INFO.chappell.col : GOLD); g.fillRect(-350, -46, 700, 92);
    g.strokeStyle = rgba(BG); g.lineWidth = 6; g.strokeRect(-340, -36, 680, 72);
    this.txt(g, tag, 0, 2, 44, DISP, z.kind === 'x' ? '#fff' : rgba(BG));
    g.restore();
  }
  drawFlash(g, f) {
    const a = clamp(1 - f.t / 0.28) * (f.big ? 0.62 : 0.4);
    g.fillStyle = rgba(f.col, a * 0.8); g.fillRect(0, 0, W, H);
    if (f.big && f.t < 0.14) { g.globalCompositeOperation = 'difference'; g.fillStyle = `rgba(255,255,255,${(1 - f.t / 0.14) * 0.55})`; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
  }

  drawLine(g, t, ci, sec, bridge) {
    const L = this.lines[ci], Y = this.lay[ci], c = g, kick = this.kickAt(t);
    const a = easeOut((t - (L.t - 0.35)) / 0.3), out = t > L.end + 0.3 ? clamp(1 - (t - L.end - 0.3) / 0.6) : 1;
    const base = ESC[sec.id] ?? 0, cy = bridge ? 650 : 620 + (1 - a) * 46;
    const shake = base >= 1 ? kick * (2 + base) : 0, r = rng(Math.floor(t * 30) + 5);
    if (bridge) { // every repeat pushes the previous lines up as a growing stack
      const idx = this.lines.filter((l) => l.sec === L.sec), me = idx.indexOf(L);
      for (let k = 1; k <= Math.min(4, me); k++) {
        const pl = idx[me - k], who = pl.text.startsWith('She') ? 'chappell' : 'olivia';
        this.txt(c, pl.text.toUpperCase(), 960, 460 - (k - 1) * 58, 46, DISP, rgba(lift(INFO[who].col, 0.3), 0.85 - k * 0.15), { ext: 3, extCol: BG });
      }
    }
    const cnt = L.words.filter((w) => /^(more|adored)/i.test(w.w) && t >= w.s).length; // ghost counters for "more x5" / "adored x5"
    if (cnt > 0) {
      g.save(); g.globalAlpha = 0.14 * out; this.txt(g, String(cnt), 960, 600, 760, DISP, rgba(GOLD)); g.restore();
      this.txt(g, `x${cnt}`, 1560, 290, 90, DISP, rgba(GOLD), { rot: 0.1, ext: 6, extCol: INFO[L.singers[0]].dark });
    }
    c.save(); c.globalAlpha = a * out; c.translate(shake * (r() - 0.5) * 2, shake * (r() - 0.5) * 2);
    const rows = Y.rows, rh = Y.S * 1.2, scale = bridge ? 1 + 0.03 * (L.t - sec.a) / 3.6 : 1;
    rows.forEach((row, ri) => {
      const wpx = row.map((i) => Y.items[i].w100 * Y.S * scale / 100), gap = Y.gap100 * Y.S * scale / 100;
      const rw = wpx.reduce((p, q) => p + q, 0) + gap * (row.length - 1);
      let x = 960 - rw / 2; const y = cy + (ri - (rows.length - 1) / 2) * rh;
      row.forEach((i, ki) => {
        const it = Y.items[i], w = L.words[i], size = Y.S * (it.echo ? 0.55 : 1) * scale, cx = x + wpx[ki] / 2;
        x += wpx[ki] + gap;
        const started = t >= w.s, since = t - w.s;
        const sc = started ? 1 + 0.15 * Math.exp(-since * 9) : 1;
        const rot = started ? Math.sin(i * 12.9 + L.t) * 0.03 * (1 + Math.exp(-since * 6)) : 0;
        let col;
        if (bridge) col = INFO[L.text.startsWith('She') ? 'chappell' : 'olivia'];
        else if (L.singers.length === 2) col = INFO[SING[i % 2]];
        else col = INFO[L.singers[0]];
        const key = KEYS.has(w.w.toLowerCase().replace(/[^a-z']/g, '')) && !it.echo;
        if (!started) { this.txt(c, it.s, cx, y, size, DISP, null, { stroke: rgba(PAPER, 0.5), lw: 3, rot }); return; }
        if (key) {
          const pw = wpx[ki] + 26;
          c.save(); c.translate(cx, y); c.rotate(rot * 2 + (i % 2 ? 0.035 : -0.03)); c.scale(sc, sc);
          c.fillStyle = rgba(CYAN, 0.9); c.fillRect(-pw / 2 + 9, -size * 0.52 + 9, pw, size * 1.04);
          c.fillStyle = rgba(GOLD); c.fillRect(-pw / 2, -size * 0.52, pw, size * 1.04);
          this.txt(c, it.s, 0, 0, size, DISP, rgba(BG));
          c.restore();
        } else if (it.echo) {
          this.txt(c, it.s, cx, y + 6, size, DISP, rgba(CYAN), { ext: 3, extCol: BG, rot, sc });
        } else {
          const active = since < 0.35 && t < w.e + 0.25;
          this.txt(c, it.s, cx, y, size, DISP, rgba(lift(col.col, active ? 0.65 : 0.38)), { ext: Math.round(size * 0.07), extCol: col.dark, stroke: rgba(BG), lw: 4, rot, sc, glow: active ? col.col : null, glowB: 30 });
        }
      });
    });
    c.restore();
  }
  drawNext(g, t, ci) {
    const cur = ci >= 0 ? this.lines[ci] : null, n = this.lines[ci + 1];
    if (!cur || !n || n.sec !== cur.sec || t > n.t - 0.35) return;
    const s = n.text.toUpperCase().replace(/[()]/g, '');
    this.txt(g, s, 960, 905, this.fitSize(s, MONO, 1500, 34), MONO, rgba(PAPER, 0.28), { letter: '3px' });
  }

  // ---------- skit mode
  bars(g, dim, seed, glitch) {
    g.save(); g.drawImage(this.barsC, 0, 0);
    if (glitch > 0) {
      const r = rng(seed * 31 + 1);
      for (let i = 0; i < 9; i++) { const y = r() * H, h = 12 + r() * 60, dx = (r() - 0.5) * 220 * glitch; g.drawImage(this.barsC, 0, y, W, h, dx, y, W, h); }
    }
    g.fillStyle = `rgba(15,15,20,${dim})`; g.fillRect(0, 0, W, H); g.restore();
  }
  drawSkit(g, t, sk) {
    const frame = Math.floor(t * 30), mid = this.midAt(t);
    const ev = sk.events.filter((e) => t >= e.t && t < e.end);
    const hasPlate = ev.some((e) => ['title', 'shout', 'card', 'survey'].includes(e.type));
    const intro = sk.mode === 'intro', standby = ev.some((e) => e.type === 'standby'), sign = sk.mode === 'outro';
    const ph = (t * 0.37) % 1, roll = ph > 0.93 ? (ph - 0.93) / 0.07 : 0;
    const glitch = standby || sign ? 0.7 : 0.15 + mid * 0.5;
    g.save(); if (roll > 0) g.translate(0, roll * H * 0.5);
    this.bars(g, hasPlate ? 0.62 : standby ? 0.35 : 0.18, frame, glitch);
    if (roll > 0) { g.translate(0, -H); this.bars(g, 0.18, frame, 0); }
    g.restore();
    this.noise(g, (standby ? 0.5 : sign ? 0.25 + clamp((t - sk.a) / 6) * 0.35 : 0.14) + mid * 0.18, frame);
    this.txt(g, 'CH 03', 140, 96, 56, LED, rgba([255, 255, 255], 0.85), { align: 'left', glow: [255, 255, 255], glowB: 8 });
    this.txt(g, (frame % 40 < 28 ? '● ' : '  ') + 'REC', 1780, 96, 56, LED, rgba([255, 60, 90], 0.9), { align: 'right' });
    const ch = this.chapterAt(t), sq = sk.id === 'squabble';
    if (!intro || t >= 4.8) {
      this.board(g, t, { title: sq ? 'SISTER SQUABBLE' : undefined, sub: ch.label, left: sq ? 'RODRIGOS' : undefined, right: sq ? 'ROANS' : undefined, active: [] });
      this.marquee(g, t, 4 + mid * 6, false);
    }
    for (const e of ev) {
      const p = t - e.t, q = e.end - t;
      if (e.type === 'shout') this.drawShout(g, p, q, e);
      else if (e.type === 'title') this.drawTitle(g, t, p, q, e);
      else if (e.type === 'card') this.drawCard(g, p, q, e);
      else if (e.type === 'survey') this.drawSurvey(g, t, p, e);
      else if (e.type === 'standby') this.drawStandby(g, t, e, frame);
      else if (e.type === 'signoff') this.drawSignoff(g, t, p, e, sk);
      else if (e.type === 'chyron') this.lowerThird(g, t, e.t, e.end, e.text, e.sub, GOLD, 'LIVE FROM STUDIO 7');
    }
  }
  drawShout(g, p, q, e) {
    const k = easeBack(p / 0.22) * easeOut(q / 0.2);
    g.save(); g.translate(960, 600); g.rotate(-0.025); g.scale(1, Math.max(0.01, k));
    g.fillStyle = rgba(BG, 0.92); g.fillRect(-960, -130, 1920, 260);
    g.fillStyle = rgba(GOLD); g.fillRect(-960, -130, 1920, 10); g.fillRect(-960, 120, 1920, 10);
    const s = this.fitSize(e.text, DISP, 1600, 140);
    this.txt(g, e.text, 0, 6, s, DISP, '#fff', { shadow: INFO.chappell.col, sx: 8, sy: 8 });
    g.restore();
  }
  drawTitle(g, t, p, q, e) {
    const k = easeBack(p / 0.4) * easeOut(q / 0.25), main = e.text === 'THE BIG EXPECTATIONS SHOW';
    g.save(); g.translate(960, 600); g.scale(k, k);
    this.rays(g, t, p % 0.6 < 0.3 ? INFO.chappell.col : INFO.olivia.col, 0.5, 18, t * 0.4, 0, 0);
    this.plate(g, -780, -250, 1560, 500, GOLD, BG, 10);
    for (let i = 0; i < 26; i++) { const x = -760 + i * 60; g.fillStyle = rgba(GOLD, ((i + Math.floor(t * 8)) % 2) ? 1 : 0.3); g.beginPath(); g.arc(x, -250, 7, 0, 7); g.arc(x, 250, 7, 0, 7); g.fill(); }
    if (main) {
      this.txt(g, 'THE BIG', 0, -170, 70, MONO, rgba(CYAN), { letter: '10px' });
      const word = 'EXPECTATIONS', s = this.fitSize(word, DISP, 1420, 190); g.font = `400 ${s}px ${DISP}`;
      let x = -g.measureText(word).width / 2;
      for (let i = 0; i < word.length; i++) {
        const ch = word[i], w = g.measureText(ch).width, col = i % 2 ? INFO.chappell : INFO.olivia, bob = Math.sin(t * 6 + i) * 5;
        this.txt(g, ch, x + w / 2, -20 + bob, s, DISP, rgba(lift(col.col, 0.3)), { ext: 10, extCol: GOLD, stroke: rgba(BG), lw: 6 });
        x += w;
      }
      this.txt(g, 'SHOW', 0, 140, 110, DISP, rgba(GOLD), { ext: 8, extCol: INFO.chappell.dark, letter: '20px' });
    } else {
      const s = this.fitSize(e.text, DISP, 1420, 190);
      this.txt(g, e.text, 0, -30, s, DISP, '#fff', { ext: 10, extCol: INFO.chappell.dark, stroke: rgba(BG), lw: 6 });
      if (e.sub) this.txt(g, e.sub, 0, 150, this.fitSize(e.sub, MONO, 1400, 36), MONO, rgba(CYAN), { letter: '3px' });
    }
    g.restore();
  }
  drawCard(g, p, q, e) {
    const k = easeBack(p / 0.3) * easeOut(q / 0.3), n = e.num, x = [480, 960, 1440][n - 1], rot = [-0.06, 0.01, 0.06][n - 1];
    g.save(); g.translate(x, 600 - (1 - k) * 600); g.rotate(rot); g.scale(k, k);
    g.fillStyle = rgba(BG, 0.7); g.fillRect(-205, -235, 430, 520);
    g.fillStyle = rgba(PAPER); g.fillRect(-215, -250, 430, 520);
    g.fillStyle = rgba(INFO.olivia.col); g.fillRect(-215, -250, 430, 84);
    this.txt(g, `CONTESTANT #${n}`, 0, -207, 34, DISP, '#fff');
    g.fillStyle = rgba(INFO.olivia.dark); g.fillRect(-160, -140, 320, 270);
    g.fillStyle = rgba(INFO.olivia.col); g.beginPath(); g.arc(0, -30, 62, 0, 7); g.fill(); g.beginPath(); g.ellipse(0, 130, 130, 105, 0, Math.PI, 0); g.fill();
    g.fillStyle = rgba(CYAN, 0.9); g.fillRect(-205, 142, 410, 6);
    this.txt(g, 'OLIVIA', 0, 188, 56, DISP, rgba(BG)); this.txt(g, 'RODRIGO', 0, 238, 56, DISP, rgba(INFO.chappell.dark));
    g.save(); g.translate(0, -255); g.rotate(-0.08); g.fillStyle = rgba(GOLD, 0.9); g.fillRect(-70, -18, 140, 36); g.restore();
    g.restore();
  }
  drawSurvey(g, t, p, e) {
    const k = easeBack(p / 0.4), q = t >= e.q;
    g.save(); g.translate(960, 640); g.scale(k, k);
    this.plate(g, -700, -300, 1400, 600, GOLD, BG, 10);
    this.txt(g, 'SURVEY SAYS', 0, -245, 70, DISP, rgba(GOLD), { ext: 6, extCol: INFO.chappell.dark });
    this.txt(g, String(Math.round(100 * easeOut(p / 3.2))).padStart(3, '0'), -520, -240, 110, LED, rgba(CYAN), { glow: CYAN, glowB: 16 });
    this.txt(g, 'SURVEYED', 520, -240, 40, MONO, rgba(CYAN));
    const head = q ? e.sub : e.text;
    this.txt(g, head, 0, -140, this.fitSize(head, DISP, 1300, 56), DISP, '#fff');
    for (let i = 0; i < 5; i++) {
      const y = -70 + i * 70, r = rng(Math.floor(t * 8) + i * 17);
      g.fillStyle = rgba(i % 2 ? INFO.olivia.dark : INFO.chappell.dark, 0.85); g.fillRect(-620, y - 28, 1240, 56);
      this.txt(g, String(i + 1), -580, y, 40, LED, rgba(GOLD), { align: 'left' });
      if (q) this.txt(g, '? ? ? ? ? ? ?', -480, y, 36, MONO, rgba(PAPER, 0.5), { align: 'left' });
      this.txt(g, q ? String(Math.floor(r() * 60 + 5)).padStart(2, '0') : '--', 580, y, 44, LED, rgba(GOLD), { align: 'right' });
    }
    g.restore();
  }
  drawStandby(g, t, e, frame) {
    g.save(); g.translate(960, 560);
    g.fillStyle = rgba(BG, 0.92); g.fillRect(-760, -180, 1520, 360); g.strokeStyle = '#fff'; g.lineWidth = 8; g.strokeRect(-756, -176, 1512, 352);
    if (frame % 50 < 38) this.txt(g, e.text, 0, -50, this.fitSize(e.text, DISP, 1400, 170), DISP, '#fff', { shadow: INFO.olivia.col, sx: 8, sy: 8 });
    this.txt(g, e.sub, 0, 90, this.fitSize(e.sub, MONO, 1400, 34), MONO, rgba(CYAN), { letter: '3px' });
    g.restore();
    this.txt(g, `00:${String(Math.floor(t - e.t)).padStart(2, '0')}`, 960, 880, 72, LED, rgba([255, 255, 255], 0.8), { glow: [255, 255, 255], glowB: 8 });
  }
  drawSignoff(g, t, p, e, sk) {
    const k = easeBack(p / 0.4), fade = clamp((sk.b - t) / 1.2);
    g.save(); g.globalAlpha = fade; g.translate(960, 600); g.rotate(-0.02); g.scale(k, k);
    g.fillStyle = rgba(BG, 0.9); g.fillRect(-900, -190, 1800, 380); g.fillStyle = rgba(GOLD); g.fillRect(-900, -190, 1800, 10); g.fillRect(-900, 180, 1800, 10);
    this.txt(g, e.text, 0, -40, this.fitSize(e.text, DISP, 1700, 120), DISP, '#fff', { shadow: INFO.chappell.col, sx: 7, sy: 7 });
    this.txt(g, e.sub, 0, 90, 56, HAND, rgba(CYAN), { rot: -0.03 });
    g.restore();
  }

  // ---------- transitions + CRT
  drawCuts(g, t) {
    let near = 9; for (const c of this.cuts) near = Math.min(near, Math.abs(t - c));
    const b = near < 0.35 ? 1 - near / 0.35 : t < 0.5 ? 1 - t / 0.5 : 0;
    if (b <= 0) return;
    this.noise(g, b * 0.95, Math.floor(t * 30) + 99);
    const r = rng(Math.floor(t * 30) * 3 + 7); g.fillStyle = `rgba(255,255,255,${0.35 * b})`;
    for (let i = 0; i < 5; i++) g.fillRect(0, r() * H, W, 3 + r() * 12);
  }
  drawCRT(g, t, kick, skit) {
    g.drawImage(this.vig, 0, 0, W, H);
    g.fillStyle = this.scan; g.fillRect(0, 0, W, H);
    const bandY = ((t * 0.09) % 1.3 - 0.15) * H, gr = g.createLinearGradient(0, bandY - 120, 0, bandY + 120);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,255,255,${skit ? 0.06 : 0.035})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, bandY - 120, W, 240);
    const r = rng(Math.floor(t * 30) + 1); g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.04})`; g.fillRect(0, 0, W, H);
  }
}
