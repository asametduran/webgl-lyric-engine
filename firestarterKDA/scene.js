// K/DA - FIRESTARTER: Line Distribution HUD + karaoke visualizer. Canvas2D, deterministic render(t) (seek / frame-capture safe).
// Palette: obsidian #08080C, magenta #FF0055 (Ahri/Miyeon), acid #00FF88 (Akali/Soyeon), violet #9D00FF (Evelynn/Sophie Powers),
// cobalt #00D4FF (Kai'Sa/Mimi Webb), gold #FFD700 + white (duets), ember #FF5500 (kick sparks).
// Layers: reactive neon smoke -> beat grid + scope -> embers -> glitch-sliced karaoke text -> live HUD -> CRT scanlines -> negative flash.
// Outro: cumulative "Final Line Distribution" ranking table.

const W = 1920, H = 1080;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const lift = (c, k = 0.4) => [c[0] + (255 - c[0]) * k, c[1] + (255 - c[1]) * k, c[2] + (255 - c[2]) * k]; // readable text tint (violet is dark on obsidian)
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const easeOut = (x) => 1 - (1 - clamp(x)) ** 3;
const SANS = '"Chakra Petch", "Segoe UI", Arial, sans-serif';
const MONO = '"Share Tech Mono", Consolas, monospace';

const BG = hex('#08080C'), GOLD = hex('#FFD700'), EMBER = hex('#FF5500'), VIOLET0 = hex('#7B00FF');
const SING = ['ahri', 'akali', 'evelynn', 'kaisa'];
const INFO = {
  ahri: { col: hex('#FF0055'), real: 'MIYEON', char: 'AHRI' },
  akali: { col: hex('#00FF88'), real: 'SOYEON', char: 'AKALI' },
  evelynn: { col: hex('#9D00FF'), real: 'SOPHIE POWERS', char: 'EVELYNN' },
  kaisa: { col: hex('#00D4FF'), real: 'MIMI WEBB', char: "KAI'SA" },
};
const KO = /[가-힯]/;

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export class Scene {
  constructor(canvas, an, lines, meta) {
    this.canvas = canvas; this.g = canvas.getContext('2d');
    this.T = document.createElement('canvas'); this.T.width = W; this.T.height = H; this.tg = this.T.getContext('2d');
    this.sw = 240; this.sh = 135;
    this.smokeC = document.createElement('canvas'); this.smokeC.width = this.sw; this.smokeC.height = this.sh;
    this.smokeG = this.smokeC.getContext('2d'); this.smokeD = this.smokeG.createImageData(this.sw, this.sh);
    this.an = an; this.meta = meta; this.sectionName = '';
    const n = an.kick.length, kd = Math.exp(-6 / an.fps);
    this.kickE = new Float32Array(n);
    for (let i = 1; i < n; i++) this.kickE[i] = Math.max(this.kickE[i - 1] * kd, an.kick[i] > 0.5 ? an.kick[i] : 0);
    this.kicks = [];
    for (let i = 2, last = -9; i < n - 2; i++) {
      const k = an.kick[i];
      if (k > 0.5 && k >= an.kick[i - 1] && k > an.kick[i + 1] && i / an.fps - last > 0.16) { this.kicks.push({ t: i / an.fps, s: k }); last = i / an.fps; }
    }
    this.scan = this.makeScan(); this.vig = this.makeVignette();
    this.setLines(lines);
  }

  makeScan() {
    const c = document.createElement('canvas'); c.width = 4; c.height = 4;
    const g = c.getContext('2d'); g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(0, 2, 4, 2);
    return this.g.createPattern(c, 'repeat');
  }
  makeVignette() {
    const c = document.createElement('canvas'); c.width = W / 4; c.height = H / 4;
    const g = c.getContext('2d'), r = g.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.35, c.width / 2, c.height / 2, c.height * 1.0);
    r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(0,0,0,0.78)');
    g.fillStyle = r; g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  // ---------- lines: layout, per-singer intervals, totals
  setLines(lines) {
    this.lines = [...lines].sort((a, b) => a.t - b.t);
    this.lay = this.lines.map((l) => this.layout(l));
    this.iv = Object.fromEntries(SING.map((s) => [s, []]));
    this.tot = Object.fromEntries(SING.map((s) => [s, { sec: 0, lines: 0 }]));
    for (const l of this.lines) {
      const w = 1 / l.singers.length;
      for (const s of l.singers) {
        this.iv[s].push({ a: l.t, b: l.end, w });
        this.tot[s].sec += (l.end - l.t) * w; this.tot[s].lines += w;
      }
    }
    this.maxSec = Math.max(...SING.map((s) => this.tot[s].sec));
    this.sumSec = SING.reduce((a, s) => a + this.tot[s].sec, 0);
    this.rank = [...SING].sort((a, b) => this.tot[b].sec - this.tot[a].sec);
    this.secs = this.meta.sections.map((s, i) => {
      const ls = this.lines.filter((l) => l.sec === i);
      return { id: s.id, label: s.label, a: Math.min(...ls.map((l) => l.t)), b: Math.max(...ls.map((l) => l.end)) };
    }).sort((a, b) => a.a - b.a);
    this.firstT = this.lines[0].t;
    this.outT = this.lines[this.lines.length - 1].end + 0.7;
  }

  sung(s, t) { let v = 0; for (const x of this.iv[s]) v += x.w * clamp(t - x.a, 0, x.b - x.a); return v; }
  glow(s, t) {
    let g = 0;
    for (const x of this.iv[s]) {
      if (t >= x.a - 0.04 && t <= x.b) g = 1;
      else if (t > x.b) g = Math.max(g, Math.exp(-(t - x.b) / 0.45));
    }
    return g;
  }
  kickAt(t) { return this.kickE[clamp(Math.floor(t * this.an.fps), 0, this.kickE.length - 1)]; }
  tint(t) {
    let r = 0, gg = 0, b = 0, sum = 0;
    for (const s of SING) { const w = this.glow(s, t); r += INFO[s].col[0] * w; gg += INFO[s].col[1] * w; b += INFO[s].col[2] * w; sum += w; }
    if (sum < 0.05) return { c: VIOLET0, k: 0.35 };
    return { c: [r / sum, gg / sum, b / sum], k: clamp(sum, 0, 1.4) };
  }

  layout(line) {
    const c = this.tg, ko = KO.test(line.text);
    const fam = ko ? `"Black Han Sans", ${SANS}` : SANS, wt = ko ? 400 : 700;
    const words = line.words.map((w) => w.w.toUpperCase());
    c.font = `${wt} 100px ${fam}`; c.letterSpacing = '0px';
    const w100 = words.map((x) => c.measureText(x).width), sp100 = c.measureText(' ').width * 0.9 + 6;
    const build = (S, limit) => {
      const k = S / 100, rows = [[]]; let cur = 0;
      words.forEach((_, i) => {
        const w = w100[i] * k, add = (rows[rows.length - 1].length ? sp100 * k : 0) + w;
        if (cur + add > limit && rows[rows.length - 1].length) { rows.push([]); cur = 0; }
        cur += (rows[rows.length - 1].length ? sp100 * k : 0) + w; rows[rows.length - 1].push(i);
      });
      return rows;
    };
    const MAXW = 1700;
    let S = 118, rows = build(S, MAXW);
    while ((rows.length > 2 && S > 66) || (rows.length > 3 && S > 52)) { S -= 2; rows = build(S, MAXW); }
    for (let L = MAXW; L > 300; L -= 10) { const r2 = build(S, L); if (r2.length <= rows.length) rows = r2; else break; }
    const k = S / 100, lh = S * 1.1;
    const outRows = rows.map((idx) => {
      const width = idx.reduce((a, i) => a + w100[i] * k, 0) + sp100 * k * (idx.length - 1);
      let x = (W - width) / 2;
      const ws = idx.map((i) => { const o = { i, x, w: w100[i] * k }; x += w100[i] * k + sp100 * k; return o; });
      return { ws, width };
    });
    let rom = null;
    if (line.rom) {
      let rs = clamp(S * 0.36, 26, 42); const txt = line.rom.toUpperCase();
      c.font = `500 ${rs}px ${SANS}`; c.letterSpacing = '3px';
      let rw = c.measureText(txt).width; if (rw > MAXW) { rs *= MAXW / rw; rw = MAXW; }
      rom = { txt, S: rs, w: rw, x: (W - rw) / 2 };
      c.letterSpacing = '0px';
    }
    const h = rows.length * lh + (rom ? rom.S * 1.9 : 0);
    return { S, fam, wt, rows: outRows, lh, rom, h, ko, words };
  }

  // ---------- main
  render(t) {
    const g = this.g, an = this.an;
    const sec = this.secs.find((s) => t >= s.a - 0.05 && t <= s.b + 0.6) || null;
    this.sectionName = sec ? sec.id : '';
    const tint = this.tint(t), kick = this.kickAt(t);
    const bp = (((t - an.offset) / an.beatDur) % 1 + 1) % 1;

    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.fillStyle = rgba(BG); g.fillRect(0, 0, W, H);
    this.drawSmoke(t, tint, kick);
    this.drawGrid(g, t, tint, kick, bp);
    this.drawScope(g, t, tint);
    this.drawEmbers(g, t);

    // text layer (glitch-sliced composite)
    const tg = this.tg; tg.setTransform(1, 0, 0, 1, 0, 0); tg.clearRect(0, 0, W, H);
    const cur = this.drawKaraoke(tg, t);
    this.drawTitle(tg, t);
    let gl = 0;
    if (cur) gl = Math.max(gl, clamp(1 - (t - cur.t) / 0.2) * 0.85);
    gl = Math.max(gl, clamp((kick - 0.78) * 3.2) * 0.55);
    if (t < 1.8) gl = Math.max(gl, 0.9 * (1 - t / 1.8));
    if (t > this.firstT - 1.1 && t < this.firstT) gl = Math.max(gl, clamp((t - (this.firstT - 1.1)) / 1.1));
    if (rng(Math.floor(t * 10) * 7919 + 13)() < 0.035) gl = Math.max(gl, 0.5);
    this.compose(g, t, gl);

    this.drawHUD(g, t, tint, sec);
    this.drawOutro(g, t);
    this.drawFrame(g, t, tint, kick, bp);

    // CRT: scanlines, rolling band, vignette
    g.fillStyle = this.scan; g.fillRect(0, 0, W, H);
    const by = ((t * 150) % (H + 500)) - 250, band = g.createLinearGradient(0, by - 120, 0, by + 120);
    band.addColorStop(0, 'rgba(255,255,255,0)'); band.addColorStop(0.5, 'rgba(255,255,255,0.045)'); band.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = band; g.fillRect(0, by - 120, W, 240);
    g.drawImage(this.vig, 0, 0, W, H);

    // negative flash on chorus / post-chorus entries
    for (const s of this.secs) {
      if (!/^(chorus|postchorus)/.test(s.id)) continue;
      const f = clamp(1 - (t - s.a) / 0.16);
      if (f > 0 && t >= s.a) { g.globalCompositeOperation = 'difference'; g.fillStyle = `rgba(255,255,255,${(f * 0.8).toFixed(3)})`; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
    }
  }

  drawSmoke(t, tint, kick) {
    const { sw, sh, smokeD: d } = this, c = tint.c, k = (0.2 + 0.42 * tint.k + 0.22 * kick), data = d.data;
    let p = 0;
    for (let y = 0; y < sh; y++) {
      const yy = y / sh, vf = 0.35 + 0.65 * yy;
      for (let x = 0; x < sw; x++, p += 4) {
        const v = Math.sin(x * 0.055 + t * 0.4 + Math.sin(y * 0.07 - t * 0.23) * 1.9)
          + Math.sin(y * 0.062 - t * 0.31 + Math.sin(x * 0.045 + t * 0.17) * 2.2)
          + Math.sin((x + y) * 0.035 + t * 0.21);
        let a = (v + 3) / 6; a = a * a * a * 1.7; a = clamp(a * k * vf, 0, 0.85);
        data[p] = BG[0] + (c[0] - BG[0]) * a; data[p + 1] = BG[1] + (c[1] - BG[1]) * a; data[p + 2] = BG[2] + (c[2] - BG[2]) * a; data[p + 3] = 255;
      }
    }
    this.smokeG.putImageData(d, 0, 0);
    const g = this.g; g.imageSmoothingEnabled = true; g.globalAlpha = 0.9; g.drawImage(this.smokeC, 0, 0, W, H); g.globalAlpha = 1;
  }

  drawGrid(g, t, tint, kick, bp) {
    const hy = 585, vx = W / 2, col = tint.c;
    g.save(); g.lineWidth = 1.5;
    for (let i = -16; i <= 16; i++) {
      g.strokeStyle = rgba(col, 0.1 + 0.08 * kick); g.beginPath(); g.moveTo(vx + i * 14, hy); g.lineTo(vx + i * 150, H); g.stroke();
    }
    for (let i = 0; i < 14; i++) {
      const z = (i + bp) / 14, y = hy + (H - hy) * z * z;
      g.strokeStyle = rgba(col, (0.06 + 0.16 * z) * (0.8 + 0.5 * kick)); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    }
    g.restore();
  }

  drawScope(g, t, tint) {
    const an = this.an, y0 = 372, col = tint.c;
    for (let pass = 0; pass < 2; pass++) {
      g.save(); g.lineWidth = pass ? 1.5 : 3; g.strokeStyle = rgba(col, pass ? 0.35 : 0.85);
      if (!pass) { g.shadowColor = rgba(col, 1); g.shadowBlur = 16; }
      g.beginPath();
      for (let x = 0; x <= W; x += 8) {
        const f = clamp(Math.floor((t + (x / W - 0.5) * 1.1) * an.fps), 0, an.mid.length - 1);
        const amp = an.mid[f] * 0.6 + an.high[f] * 0.3 + an.low[f] * 0.35, win = Math.sin(Math.PI * x / W);
        const y = y0 + (pass ? -1 : 1) * ((x / 8) % 2 ? -1 : 1) * amp * 62 * win;
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke(); g.restore();
    }
  }

  drawEmbers(g, t) {
    g.save(); g.globalCompositeOperation = 'lighter';
    this.kicks.forEach((e, ei) => {
      const age0 = t - e.t; if (age0 < 0 || age0 > 3.2) return;
      const r = rng(ei * 977 + 3), n = 10 + Math.floor(e.s * 16), tc = this.tint(e.t).c;
      for (let i = 0; i < n; i++) {
        const x0 = r() * W, vx = (r() - 0.5) * 140, vy = -(150 + r() * 420), life = 1.3 + r() * 1.7, size = 1.4 + r() * 3.4, pick = r(), ph = r() * 6.28;
        if (age0 > life) continue;
        const x = x0 + vx * age0 + Math.sin(age0 * 3 + ph) * 16, y = H + 20 + vy * age0 + 60 * age0 * age0;
        const a = (1 - age0 / life) ** 1.5 * (0.7 + 0.3 * Math.sin(age0 * 30 + ph));
        const col = pick < 0.55 ? EMBER : pick < 0.8 ? tc : GOLD;
        g.fillStyle = rgba(col, a * 0.18); g.beginPath(); g.arc(x, y, size * 3.2, 0, 6.283); g.fill();
        g.fillStyle = rgba(col, a); g.beginPath(); g.arc(x, y, size, 0, 6.283); g.fill();
      }
    });
    g.restore();
  }

  // ---------- karaoke text
  drawKaraoke(c, t) {
    let idx = -1;
    for (let i = 0; i < this.lines.length; i++) if (this.lines[i].t <= t) idx = i; else break;
    if (idx < 0) return null;
    const cur = this.lines[idx];
    if (t > cur.end + 1.6) return null;
    const e = easeOut((t - cur.t) / 0.16);
    const fade = t > cur.end + 0.9 ? 1 - (t - cur.end - 0.9) / 0.7 : 1;
    if (idx > 0 && t - cur.t < 0.32) {
      const prev = this.lines[idx - 1];
      if (cur.t - prev.end < 1.6) { const pe = easeOut((t - cur.t) / 0.32); this.drawLine(c, prev, this.lay[idx - 1], prev.end + 9, 1 - pe, -50 * pe, true); }
    }
    this.drawLine(c, cur, this.lay[idx], t, e * fade, (1 - e) * 36, false);
    const nxt = this.lines[idx + 1];
    if (nxt && nxt.t - t < 6) {
      c.save(); c.globalAlpha = 0.55 * fade; c.font = `500 30px ${SANS}`; c.letterSpacing = '5px'; c.textAlign = 'center';
      c.lineWidth = 1.2; c.strokeStyle = 'rgba(255,255,255,0.7)';
      c.strokeText('NEXT // ' + nxt.text.toUpperCase().slice(0, 64), W / 2, 985); c.restore();
    }
    return cur;
  }

  drawLine(c, line, L, t, alpha, dy, ghost) {
    if (alpha <= 0.01) return;
    const duet = line.singers.length > 1, col = duet ? GOLD : INFO[line.singers[0]].col;
    const top = 650 - L.h / 2 + dy;
    c.save(); c.globalAlpha = alpha; c.lineJoin = 'round'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.font = `${L.wt} ${L.S}px ${L.fam}`; c.letterSpacing = '0px';
    let adlib = false; const adl = L.words.map((w) => { if (w.startsWith('(')) adlib = true; const a = adlib; if (w.includes(')')) adlib = false; return a; });
    L.rows.forEach((row, ri) => {
      const y = top + ri * L.lh + L.S * 0.85;
      for (const wd of row.ws) {
        const wt = line.words[wd.i], p = ghost ? 1 : clamp((t - wt.s) / Math.max(0.05, wt.e - wt.s)), txt = L.words[wd.i];
        c.lineWidth = 2.4; c.strokeStyle = rgba(col, 0.6); c.strokeText(txt, wd.x, y);
        c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillText(txt, wd.x, y);
        if (p > 0) {
          const fc = adl[wd.i] ? [255, 255, 255] : col;
          c.save(); c.beginPath(); c.rect(wd.x - 8, y - L.S * 1.05, p >= 1 ? wd.w + 16 : wd.w * p + 8, L.S * 1.4); c.clip();
          c.shadowColor = rgba(fc, 1); c.shadowBlur = 30; c.fillStyle = rgba(fc, 1); c.fillText(txt, wd.x, y);
          c.shadowBlur = 0; c.fillStyle = 'rgba(255,255,255,0.32)'; c.fillText(txt, wd.x, y);
          c.restore();
          if (p < 1 && !ghost) { c.save(); c.shadowColor = '#fff'; c.shadowBlur = 22; c.fillStyle = '#fff'; c.fillRect(wd.x + wd.w * p - 2, y - L.S * 0.82, 4, L.S * 0.95); c.restore(); }
        }
      }
    });
    if (L.rom) {
      const y = top + L.rows.length * L.lh + L.rom.S * 1.05, pl = ghost ? 1 : clamp((t - line.t) / Math.max(0.1, line.end - line.t));
      c.font = `500 ${L.rom.S}px ${SANS}`; c.letterSpacing = '3px';
      c.fillStyle = 'rgba(255,255,255,0.28)'; c.fillText(L.rom.txt, L.rom.x, y);
      c.save(); c.beginPath(); c.rect(L.rom.x - 4, y - L.rom.S * 1.1, L.rom.w * pl + 6, L.rom.S * 1.6); c.clip();
      c.shadowColor = rgba(col, 1); c.shadowBlur = 14; c.fillStyle = rgba(col, 0.95); c.fillText(L.rom.txt, L.rom.x, y); c.restore();
      c.letterSpacing = '0px';
    }
    c.restore();
    if (!ghost) this.chip = { line, top, alpha };
  }

  drawTitle(c, t) {
    const a = 1 - clamp((t - (this.firstT - 1.2)) / 1.0);
    if (a <= 0.01) return;
    const rev = easeOut(t / 2.4);
    c.save(); c.globalAlpha = a; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.font = `700 120px ${SANS}`; c.letterSpacing = '40px'; c.fillStyle = '#fff';
    c.shadowColor = '#FF0055'; c.shadowBlur = 30; c.fillText('K/DA', W / 2 + 20, 520);
    c.save(); c.beginPath(); c.rect(0, 0, W * rev, H); c.clip();
    c.font = `700 250px ${SANS}`; c.letterSpacing = '10px'; c.shadowColor = '#00D4FF'; c.shadowBlur = 40; c.fillStyle = '#fff';
    c.fillText('FIRESTARTER', W / 2 + 5, 745); c.restore();
    c.shadowBlur = 0; c.font = `500 34px ${SANS}`; c.letterSpacing = '6px';
    const parts = [['ft.', '#fff'], ['MIYEON', '#FF0055'], ['SOYEON', '#00FF88'], ['SOPHIE POWERS', '#9D00FF'], ['MIMI WEBB', '#00D4FF']];
    const ws = parts.map((p) => c.measureText(p[0]).width), gap = 44, tot = ws.reduce((x, y) => x + y, 0) + gap * (parts.length - 1);
    let x = (W - tot) / 2; c.textAlign = 'left'; c.globalAlpha = a * clamp((t - 1.2) / 0.8);
    parts.forEach((p, i) => { c.fillStyle = p[1]; c.shadowColor = p[1]; c.shadowBlur = p[1] === '#fff' ? 0 : 14; c.fillText(p[0], x, 830); x += ws[i] + gap; });
    c.restore();
  }

  compose(g, t, gl) {
    const T = this.T;
    if (gl < 0.02) { g.drawImage(T, 0, 0); this.drawChip(g, t); return; }
    const r = rng(Math.floor(t * 24) * 104729 + 5), d = 9 * gl;
    g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.55;
    g.filter = 'sepia(1) saturate(9) hue-rotate(-52deg)'; g.drawImage(T, -d, 0);
    g.filter = 'sepia(1) saturate(9) hue-rotate(150deg)'; g.drawImage(T, d, 0);
    g.restore(); g.filter = 'none';
    let y = 0;
    while (y < H) {
      const h = 14 + Math.floor(r() * 70), hit = r() < 0.2 + 0.5 * gl, dx = hit ? (r() - 0.5) * 2 * 110 * gl : 0;
      g.drawImage(T, 0, y, W, h, dx, y, W, h); y += h;
    }
    this.drawChip(g, t);
  }

  drawChip(g) {
    const ch = this.chip; this.chip = null; if (!ch) return;
    const sg = ch.line.singers; g.save(); g.globalAlpha = ch.alpha; g.textBaseline = 'middle'; g.font = `700 24px ${SANS}`; g.letterSpacing = '5px';
    const labels = sg.map((s) => `${INFO[s].char} // ${INFO[s].real}`);
    const wid = labels.map((l) => g.measureText(l).width + 34), tot = wid.reduce((a, b) => a + b, 0) + 30 * (sg.length - 1);
    let x = (W - tot) / 2; const y = ch.top - 40;
    sg.forEach((s, i) => {
      const col = INFO[s].col; g.fillStyle = rgba(col, 1); g.shadowColor = rgba(col, 1); g.shadowBlur = 14;
      g.beginPath(); g.moveTo(x + 8, y - 13); g.lineTo(x + 24, y - 13); g.lineTo(x + 16, y + 13); g.lineTo(x, y + 13); g.closePath(); g.fill();
      g.shadowBlur = 0; g.fillStyle = '#fff'; g.fillText(labels[i], x + 34, y + 1); x += wid[i] + 30;
    });
    g.restore();
  }

  // ---------- HUD: live line distribution
  drawHUD(g, t, tint, sec) {
    const a = (1 - clamp((t - this.outT) / 1.0)) * clamp(t / 1.2);
    if (a <= 0.01) return;
    g.save(); g.globalAlpha = a; g.textBaseline = 'alphabetic';
    g.font = `500 20px ${SANS}`; g.letterSpacing = '8px'; g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillText('LIVE LINE DISTRIBUTION', 80, 50);
    g.textAlign = 'right'; g.fillText('K/DA // FIRESTARTER', W - 80, 50); g.textAlign = 'left';
    const sums = SING.map((s) => this.sung(s, t)), all = sums.reduce((x, y) => x + y, 0), X0 = 520, BW = 900;
    SING.forEach((s, i) => {
      const y = 74 + i * 50, col = INFO[s].col, gl = this.glow(s, t), pulse = gl * (0.75 + 0.25 * Math.sin(t * 16));
      const fillW = (sums[i] / this.maxSec) * BW;
      g.fillStyle = rgba(col, 0.2 + 0.8 * gl); g.fillRect(80, y + 4, 6, 28);
      g.font = `700 28px ${SANS}`; g.letterSpacing = '3px'; g.fillStyle = `rgba(255,255,255,${0.55 + 0.45 * gl})`; g.fillText(INFO[s].real, 100, y + 29);
      g.font = `500 17px ${SANS}`; g.letterSpacing = '4px'; g.fillStyle = rgba(lift(col), 0.9); g.fillText(INFO[s].char, 380, y + 28);
      g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(X0, y + 6, BW, 24);
      g.strokeStyle = 'rgba(255,255,255,0.14)'; g.lineWidth = 1; g.strokeRect(X0 + 0.5, y + 6.5, BW, 24);
      if (fillW > 0.5) {
        g.save(); g.shadowColor = rgba(col, 1); g.shadowBlur = 6 + 34 * pulse; g.fillStyle = rgba(col, 0.62 + 0.38 * gl);
        g.beginPath(); g.moveTo(X0, y + 6); g.lineTo(X0 + fillW, y + 6); g.lineTo(X0 + Math.max(0, fillW - 12), y + 30); g.lineTo(X0, y + 30); g.closePath(); g.fill();
        if (gl > 0.05) { g.fillStyle = `rgba(255,255,255,${0.9 * gl})`; g.fillRect(X0 + fillW - 4, y + 6, 4, 24); }
        g.restore();
      }
      g.textAlign = 'right'; g.letterSpacing = '1px'; g.font = `400 34px ${MONO}`; g.fillStyle = '#fff';
      g.fillText(`${sums[i].toFixed(1)}s`, 1640, y + 30);
      g.font = `700 34px ${SANS}`; g.fillStyle = rgba(lift(col), 1); g.shadowColor = rgba(col, 1); g.shadowBlur = 8 * gl;
      g.fillText(`${all > 0 ? ((sums[i] / all) * 100).toFixed(1) : '0.0'}%`, W - 80, y + 31); g.shadowBlur = 0; g.textAlign = 'left';
    });
    if (sec) {
      g.font = `500 22px ${SANS}`; g.letterSpacing = '7px'; g.fillStyle = rgba(tint.c, 0.95);
      g.fillText(sec.label.replace(/:\s*/, ' // ').toUpperCase(), 80, 300);
    }
    g.restore();
  }

  // ---------- frame furniture: brackets, ticks, time
  drawFrame(g, t, tint, kick, bp) {
    const col = tint.c, m = 44, L = 46 + 10 * kick;
    g.save(); g.strokeStyle = rgba(col, 0.75); g.lineWidth = 3; g.shadowColor = rgba(col, 1); g.shadowBlur = 10;
    [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy]) => {
      g.beginPath(); g.moveTo(x, y + sy * L); g.lineTo(x, y); g.lineTo(x + sx * L, y); g.stroke();
    });
    g.restore();
    g.save(); g.font = `400 20px ${MONO}`; g.letterSpacing = '2px'; g.fillStyle = 'rgba(255,255,255,0.65)'; g.textBaseline = 'alphabetic';
    const fm = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    g.fillText(`${fm(t)} / ${fm(this.an.duration)}   BPM ${this.an.bpm.toFixed(0)}`, 80, H - 30);
    g.textAlign = 'right'; g.fillText('FAN-MADE CODE MV // CANVAS2D', W - 80, H - 30); g.restore();
    g.fillStyle = rgba(col, 0.55); for (let i = 0; i < 16; i++) { const on = i / 16 <= bp; g.fillRect(W / 2 - 160 + i * 20, H - 36, 14, on ? 6 : 2); }
  }

  // ---------- outro: final line distribution table
  drawOutro(g, t) {
    const a = easeOut((t - this.outT - 0.2) / 0.8);
    if (a <= 0.01) return;
    const jit = rng(Math.floor(t * 20) + 3)() < 0.03 ? 6 : 0;
    g.save(); g.globalAlpha = a; g.translate(jit, 0); g.textBaseline = 'alphabetic';
    g.fillStyle = 'rgba(8,8,12,0.72)'; g.fillRect(0, 90, W, 880);
    g.textAlign = 'center'; g.font = `700 76px ${SANS}`; g.letterSpacing = '14px'; g.fillStyle = '#fff'; g.shadowColor = '#FFD700'; g.shadowBlur = 26;
    g.fillText('FINAL LINE DISTRIBUTION', W / 2, 200); g.shadowBlur = 0;
    g.font = `500 22px ${SANS}`; g.letterSpacing = '8px'; g.fillStyle = 'rgba(255,255,255,0.6)';
    g.fillText(`CUMULATIVE SINGING TIME // ${this.sumSec.toFixed(1)}s TOTAL`, W / 2, 245);
    g.textAlign = 'left';
    this.rank.forEach((s, i) => {
      const y = 300 + i * 150, col = INFO[s].col, p = easeOut((t - this.outT - 0.8 - i * 0.28) / 1.6), tt = this.tot[s];
      const sec = tt.sec * p, pct = (tt.sec / this.sumSec) * 100 * p, first = i === 0;
      g.fillStyle = rgba(col, first ? 0.14 : 0.07); g.fillRect(120, y, W - 240, 120);
      g.strokeStyle = rgba(first ? GOLD : col, first ? 0.95 : 0.5); g.lineWidth = first ? 3 : 1.5; g.strokeRect(120.5, y + 0.5, W - 240, 120);
      g.font = `700 92px ${SANS}`; g.letterSpacing = '0px'; g.fillStyle = first ? '#FFD700' : rgba(lift(col), 1); g.shadowColor = first ? '#FFD700' : rgba(col, 1); g.shadowBlur = first ? 24 : 10;
      g.fillText(String(i + 1).padStart(2, '0'), 150, y + 98); g.shadowBlur = 0;
      g.font = `700 44px ${SANS}`; g.letterSpacing = '4px'; g.fillStyle = '#fff'; g.fillText(INFO[s].real, 330, y + 62);
      g.font = `500 22px ${SANS}`; g.letterSpacing = '6px'; g.fillStyle = rgba(lift(col), 1); g.fillText(INFO[s].char, 332, y + 96);
      const X0 = 760, BW = 680, fw = (tt.sec / this.maxSec) * BW * p;
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(X0, y + 38, BW, 44);
      g.save(); g.shadowColor = rgba(col, 1); g.shadowBlur = 24; g.fillStyle = rgba(col, 0.9);
      g.beginPath(); g.moveTo(X0, y + 38); g.lineTo(X0 + fw, y + 38); g.lineTo(X0 + Math.max(0, fw - 16), y + 82); g.lineTo(X0, y + 82); g.closePath(); g.fill(); g.restore();
      g.textAlign = 'right'; g.font = `400 46px ${MONO}`; g.letterSpacing = '1px'; g.fillStyle = '#fff'; g.fillText(`${sec.toFixed(1)}s`, 1590, y + 64);
      g.font = `500 20px ${SANS}`; g.letterSpacing = '5px'; g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillText(`${(tt.lines * p).toFixed(1)} LINES`, 1590, y + 98);
      g.font = `700 50px ${SANS}`; g.letterSpacing = '0px'; g.fillStyle = rgba(lift(col), 1); g.shadowColor = rgba(col, 1); g.shadowBlur = 10;
      g.fillText(`${pct.toFixed(1)}%`, W - 150, y + 78); g.shadowBlur = 0; g.textAlign = 'left';
    });
    g.restore();
  }
}
