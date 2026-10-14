// KATSEYE - Unloveu: frosted-glass / prismatic editorial kinetic typography engine (Canvas2D, deterministic render(t)).
// Palette: night #0A1230, ice #BFE3FF, bone #F2EEE6, lilac #B9A6FF. Negative (difference) flashes on hits. Seven chapters; each chorus pass one notch bigger.
// Optional Higgsfield video layers (iceMelt in the intro, prism in the bridge) are composited with `screen` and never carry text.

const W = 1920, H = 1080;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const NIGHT = hex('#0A1230'), ICE = hex('#BFE3FF'), BONE = hex('#F2EEE6'), LILAC = hex('#B9A6FF');
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeOut = (x) => 1 - (1 - clamp(x)) ** 3;
const SERIF = '"Instrument Serif", Georgia, serif';
const SANS = '"Inter Tight", "Segoe UI", Arial, sans-serif';

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// chapter breakdown (seconds)
const CH = [
  { a: 0, b: 20, roman: 'I', name: 'INTRO' },
  { a: 20, b: 47, roman: 'II', name: 'VERSE' },
  { a: 47, b: 60, roman: 'III', name: 'PRE-CHORUS' },
  { a: 60, b: 105, roman: 'IV', name: 'CHORUS' },
  { a: 105, b: 118, roman: 'V', name: 'VERSE II' },
  { a: 118, b: 173, roman: 'VI', name: 'CHORUS / BRIDGE' },
  { a: 173, b: 1e9, roman: 'VII', name: 'FINAL / OUTRO' },
];
const BRIDGE = [158, 173];          // cracked-glass bridge (prism video layer)
const COLLAPSE = [212, 228];        // outro: prism collapses to a line
const SCALE = [1, 1, 1, 1, 1, 1.12, 1.26]; // chorus notch per chapter
const BEAMS = [6, 6, 6, 6, 6, 9, 12];

export class Scene {
  constructor(canvas, an, lines, words, layers = {}) {
    this.canvas = canvas; this.g0 = canvas.getContext('2d');
    this.B = document.createElement('canvas'); this.B.width = W; this.B.height = H; this.g = this.B.getContext('2d');
    this.bgC = document.createElement('canvas'); this.bgC.width = W / 2; this.bgC.height = H / 2; this.bg = this.bgC.getContext('2d');
    this.blurC = document.createElement('canvas'); this.blurC.width = W / 2; this.blurC.height = H / 2; this.bl = this.blurC.getContext('2d');
    this.an = an; this.words = words; this.layers = layers; this.chapter = 'I';
    // kick envelope (fast attack, exp decay) from analyzer
    const n = an.kick.length, kd = Math.exp(-6 / an.fps);
    this.kickE = new Float32Array(n);
    for (let i = 1; i < n; i++) this.kickE[i] = Math.max(this.kickE[i - 1] * kd, an.kick[i] > 0.5 ? an.kick[i] : 0);
    this.grain = this.makeGrain();
    this.makeCrack();
    this.setLines(lines);
  }

  makeGrain() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'), d = g.createImageData(256, 256), r = rng(7);
    for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
    return c;
  }

  // ---------- lyric lines: tokens + per-word times (whisper words when counts match, else spread evenly)
  setLines(lines) {
    this.lines = lines.map((l, i) => {
      const toks = l.text.split(/\s+/).filter(Boolean);
      const sh = l.shift || 0;
      const ws = this.words.filter((w) => w.s + sh >= l.t - 0.25 && w.s + sh < l.end - 0.05);
      let wt;
      if (ws.length === toks.length) wt = ws.map((w) => w.s + sh);
      else { const span = Math.max(0.4, (l.end - l.t) * 0.82); wt = toks.map((_, k) => l.t + (span * k) / Math.max(1, toks.length)); }
      return { ...l, i, toks, wt };
    });
  }

  activeAt(t) {
    let k = -1;
    for (let i = 0; i < this.lines.length; i++) { if (this.lines[i].t - 0.12 <= t) k = i; else break; }
    return k;
  }

  state(t) {
    const an = this.an, i = clamp(Math.floor(t * an.fps), 0, an.kick.length - 1);
    let ci = CH.findIndex((c) => t >= c.a && t < c.b); if (ci < 0) ci = CH.length - 1;
    const bt = (t - an.offset) / an.beatDur;
    return { t, i, ch: CH[ci], ci, k: this.kickE[i], lo: an.low[i] || 0, hi: an.high[i] || 0, beat: bt - Math.floor(bt), bar: Math.floor(bt / 4) };
  }

  // ---------- background (half-res) + frosted backdrop
  drawBg(t, S) {
    const g = this.bg; g.setTransform(0.5, 0, 0, 0.5, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, rgba(mix(NIGHT, [22, 38, 96], 0.55))); gr.addColorStop(1, rgba(mix(NIGHT, [3, 6, 20], 0.7)));
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const energy = [0.6, 0.7, 0.9, 1.1, 0.6, 1.2, 1.35][S.ci];
    g.globalCompositeOperation = 'lighter';
    const cols = [ICE, LILAC, ICE, BONE, LILAC];
    for (let n = 0; n < 5; n++) {
      const x = W * (0.5 + 0.42 * Math.sin(t * 0.06 * (n + 1) + n * 2.1)), y = H * (0.5 + 0.38 * Math.cos(t * 0.045 * (n + 2) + n * 1.3));
      const r = 520 + 110 * n + S.lo * 180, a = (0.05 + 0.055 * energy) * (n === 3 ? 0.6 : 1) * (cols[n] === LILAC ? 0.8 : 1) + S.k * 0.035;
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, rgba(cols[n], a)); rg.addColorStop(1, rgba(cols[n], 0));
      g.fillStyle = rg; g.fillRect(0, 0, W, H);
    }
    // thin light bars: sharp here, so they turn into soft smears behind the glass
    const r = rng(11);
    for (let n = 0; n < 9; n++) {
      const x = (r() * W * 1.4 + t * (14 + 22 * r())) % (W * 1.4) - W * 0.2, w = 2 + r() * 4, a = 0.07 + 0.1 * r() + S.k * 0.07;
      g.fillStyle = rgba(r() > 0.5 ? ICE : LILAC, a);
      g.save(); g.translate(x, 0); g.rotate(0.28); g.fillRect(-w / 2, -300, w, H + 600); g.restore();
    }
    g.globalCompositeOperation = 'source-over';
    // frosted copy
    const b = this.bl; b.setTransform(1, 0, 0, 1, 0, 0); b.fillStyle = rgba(NIGHT); b.fillRect(0, 0, W / 2, H / 2);
    b.filter = 'blur(16px)'; b.drawImage(this.bgC, 0, 0); b.filter = 'none';
  }

  // ---------- glass
  rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  poly(g, pts) { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); }

  // path: fn(g) building the shape; bb: bounding box for gradients; o: {a, tint, edge, sweep}
  glass(g, path, bb, o = {}) {
    const a = o.a ?? 1, tint = o.tint ?? 0.09, t = o.t ?? 0;
    g.save(); g.globalAlpha = a; path(g); g.clip();
    g.drawImage(this.blurC, 0, 0, W, H);
    g.fillStyle = rgba(BONE, tint); g.fillRect(bb.x, bb.y, bb.w, bb.h);
    const sh = g.createLinearGradient(bb.x, bb.y, bb.x + bb.w, bb.y + bb.h);
    sh.addColorStop(0, rgba(ICE, 0.26)); sh.addColorStop(0.45, rgba(ICE, 0.02)); sh.addColorStop(1, rgba(LILAC, 0.2));
    g.fillStyle = sh; g.fillRect(bb.x, bb.y, bb.w, bb.h);
    if (o.sweep !== false) { // specular sweep
      const sx = bb.x + (((t * 0.12 + (o.seed || 0)) % 1.6) - 0.3) * (bb.w + bb.h);
      const sw = g.createLinearGradient(sx - 90, 0, sx + 90, 0);
      sw.addColorStop(0, rgba(BONE, 0)); sw.addColorStop(0.5, rgba(BONE, 0.16)); sw.addColorStop(1, rgba(BONE, 0));
      g.save(); g.translate(bb.x + bb.w / 2, bb.y + bb.h / 2); g.rotate(0.35); g.translate(-(bb.x + bb.w / 2), -(bb.y + bb.h / 2));
      g.fillStyle = sw; g.fillRect(sx - 90, bb.y - bb.h, 180, bb.h * 3); g.restore();
    }
    g.restore();
    if (o.edge === false) return;
    g.save(); g.globalAlpha = a;
    const eg = g.createLinearGradient(bb.x, bb.y, bb.x + bb.w, bb.y + bb.h);
    eg.addColorStop(0, rgba(BONE, 0.85)); eg.addColorStop(0.5, rgba(ICE, 0.3)); eg.addColorStop(1, rgba(LILAC, 0.75));
    path(g); g.strokeStyle = eg; g.lineWidth = 2; g.stroke();
    g.globalCompositeOperation = 'lighter'; g.lineWidth = 1.5; // chromatic fringe
    g.save(); g.translate(2.2, 0); path(g); g.strokeStyle = rgba(ICE, 0.32); g.stroke(); g.restore();
    g.save(); g.translate(-2.2, 0); path(g); g.strokeStyle = rgba(LILAC, 0.32); g.stroke(); g.restore();
    g.restore();
  }

  // ---------- typography
  fit(g, toks, o) {
    const gap = (s) => { g.font = o.font(s); g.letterSpacing = `${o.ls || 0}px`; return g.measureText(' ').width + (o.ls || 0); };
    for (let size = o.max; size >= o.min; size -= 4) {
      g.font = o.font(size); g.letterSpacing = `${(o.ls || 0)}px`;
      const sp = gap(size), lh = size * (o.lh || 1.08);
      const wrap = (maxW) => { // greedy wrap
        const rows = []; let cur = { items: [], w: 0 };
        toks.forEach((tok, i) => {
          const txt = o.upper ? tok.toUpperCase() : tok, w = g.measureText(txt).width;
          if (cur.items.length && cur.w + sp + w > maxW) { rows.push(cur); cur = { items: [], w: 0 }; }
          cur.items.push({ i, txt, w, x: cur.w ? cur.w + sp : 0 }); cur.w += (cur.w ? sp : 0) + w;
        });
        rows.push(cur); return rows;
      };
      let rows = wrap(o.maxW); // avoid a single-word last row (widow) by narrowing the measure
      for (const f of [0.82, 0.7, 0.58]) { if (rows.length < 2 || rows[rows.length - 1].items.length > 1) break; rows = wrap(o.maxW * f); }
      if (rows.length * lh <= o.maxH || size - 4 < o.min) { g.letterSpacing = '0px'; return { size, rows, lh, w: Math.max(...rows.map((r) => r.w)), h: rows.length * lh, o }; }
    }
  }

  // draw a fitted block with per-word entry + sung-word lighting. (x,y) = top-left of the block, align within block width
  drawBlock(g, blk, line, t, x, y, alpha = 1, dy = 0) {
    const { o } = blk; g.save(); g.textBaseline = 'alphabetic'; g.font = o.font(blk.size); g.letterSpacing = `${o.ls || 0}px`;
    blk.rows.forEach((row, r) => {
      const off = o.align === 'center' ? (blk.w - row.w) / 2 : o.align === 'right' ? blk.w - row.w : 0;
      row.items.forEach((it) => {
        const wt = line.wt[it.i], nxt = line.wt[it.i + 1] ?? wt + 0.35;
        const e = smooth((t - (line.t - 0.12) - it.i * 0.035) / 0.3), lit = smooth((t - wt + 0.02) / 0.14);
        const cur = clamp(1 - (t - wt) / Math.max(0.25, nxt - wt)) * (t >= wt ? 1 : 0);
        const col = mix(mix(ICE, BONE, lit), LILAC, cur * 0.55);
        g.globalAlpha = alpha * e * (0.55 + 0.45 * lit);
        if (cur > 0.05) { g.shadowColor = rgba(LILAC, 0.8); g.shadowBlur = 26 * cur; }
        g.fillStyle = rgba(col, 1);
        g.fillText(it.txt, x + off + it.x, y + r * blk.lh + blk.size * 0.86 + (1 - e) * 26 + dy);
        g.shadowBlur = 0;
      });
    });
    g.restore();
  }

  // ---------- chapter content
  panelLine(g, S, line, alpha, o) { // glass panel hugging the text (verse / pre / bridge)
    const t = S.t, blk = this.fit(g, line.toks, o.fit), padX = o.padX ?? 60, padY = o.padY ?? 46;
    const pw = blk.w + padX * 2, ph = blk.h + padY * 2, e = easeOut((t - (line.t - 0.14)) / 0.5);
    const pos = o.pos(line, pw, ph, e);
    const x = pos.x, y = pos.y, a = alpha * e;
    this.glass(g, (c) => this.rr(c, x, y, pw, ph, o.r ?? 38), { x, y, w: pw, h: ph }, { a, t, seed: line.i * 0.37, tint: o.tint });
    this.drawBlock(g, blk, line, t, x + padX, y + padY, alpha);
    return { x, y, pw, ph };
  }

  prismShape(S, cx, cy, R, rot) {
    const pts = [];
    for (let k = 0; k < 6; k++) { const a = rot + (k * Math.PI) / 3, rr = R * (k % 2 ? 0.92 : 1); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.96]); }
    return pts;
  }

  prism(g, S, strength, sc) {
    const t = S.t, cx = W / 2, cy = H / 2 - 10, R = 400 * sc * (1 + S.k * 0.035) * strength;
    if (R < 4) return;
    const pts = this.prismShape(S, cx, cy, R, t * 0.06 + S.bar * 0.12);
    // spectral beams radiating from the prism
    const n = BEAMS[S.ci]; g.save(); g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < n; k++) {
      const a = t * 0.08 + (k * Math.PI * 2) / n + Math.sin(t * 0.3 + k) * 0.08, len = (900 + 520 * Math.sin(t * 0.5 + k * 1.7) ** 2) * strength + S.k * 160;
      const w = 0.04 + 0.025 * Math.sin(t + k), col = k % 3 === 0 ? BONE : k % 3 === 1 ? ICE : LILAC;
      const gr = g.createRadialGradient(cx, cy, R * 0.4, cx, cy, len);
      gr.addColorStop(0, rgba(col, 0.2 + S.k * 0.12)); gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a - w) * len, cy + Math.sin(a - w) * len); g.lineTo(cx + Math.cos(a + w) * len, cy + Math.sin(a + w) * len); g.closePath(); g.fill();
    }
    g.restore();
    const bb = { x: cx - R, y: cy - R, w: R * 2, h: R * 2 };
    this.glass(g, (c) => this.poly(c, pts), bb, { t, tint: 0.07, a: 0.95 * Math.min(1, strength * 1.4) });
    // inner facets
    g.save(); g.globalAlpha = 0.5 * Math.min(1, strength); g.strokeStyle = rgba(ICE, 0.35); g.lineWidth = 1;
    pts.forEach((p, k) => { g.beginPath(); g.moveTo(cx, cy); g.lineTo(p[0], p[1]); g.stroke(); if (k % 2) { g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(pts[(k + 2) % 6][0], pts[(k + 2) % 6][1]); g.stroke(); } });
    g.restore();
  }

  chorusLine(g, S, line, alpha, dy, sc, caps) {
    const short = line.toks.length <= 5;
    const blk = this.fit(g, line.toks, {
      font: (s) => `italic 400 ${s}px ${SERIF}`, max: (short ? 250 : 156) * sc, min: 54, maxW: 1440, maxH: 560, lh: 1.02, align: 'center', upper: caps, ls: 0,
    });
    const k = 1 + S.k * 0.022, cx = W / 2, cy = H / 2 + 6;
    this.g.save(); this.g.translate(cx, cy); this.g.scale(k, k); this.g.translate(-cx, -cy);
    this.drawBlock(g, blk, line, S.t, cx - blk.w / 2, cy - blk.h / 2, alpha, dy);
    this.g.restore();
  }

  makeCrack() {
    const r = rng(2026), C = [W * 0.5, H * 0.47], N = 11;
    this.crackC = C; const ang = [];
    for (let k = 0; k < N; k++) ang.push(((k + (r() - 0.5) * 0.5) / N) * Math.PI * 2);
    this.ang = ang;
    this.cracks = [];
    const walk = (x, y, a, segs, delay, depth) => {
      const pts = [[x, y]];
      for (let s = 0; s < segs; s++) {
        a += (r() - 0.5) * 0.5; const l = 60 + r() * 60; x += Math.cos(a) * l; y += Math.sin(a) * l; pts.push([x, y]);
        if (depth < 2 && s > 1 && r() < 0.28) walk(x, y, a + (r() > 0.5 ? 1 : -1) * (0.5 + r() * 0.5), 3 + ((r() * 4) | 0), delay + s * 0.04, depth + 1);
      }
      this.cracks.push({ pts, delay, width: depth === 0 ? 1 : 0.6 });
    };
    ang.forEach((a, k) => walk(C[0], C[1], a, 14, r() * 0.15, 0));
    // shard grid: rings of vertices sharing the ray angles, so the pieces tile the screen
    const rings = [0, 250, 600, 1500]; this.verts = rings.map((R, j) => ang.map((a) => {
      const jr = j === 0 ? 0 : R * (1 + (r() - 0.5) * 0.28), ja = a + (j ? (r() - 0.5) * 0.12 : 0);
      return [C[0] + Math.cos(ja) * jr, C[1] + Math.sin(ja) * jr];
    }));
    this.shardSeed = Array.from({ length: 3 * N }, () => r());
  }

  crack(g, S) {
    const t = S.t, p = clamp((t - BRIDGE[0]) / 9), out = 1 - smooth((t - BRIDGE[1] + 1.2) / 1.2), N = this.ang.length, C = this.crackC;
    const open = Math.pow(clamp((p - 0.45) / 0.55), 2);
    for (let j = 0; j < 3; j++) for (let k = 0; k < N; k++) {
      const v = this.verts, k2 = (k + 1) % N;
      const pts = j === 0 ? [v[0][k], v[1][k], v[1][k2]] : [v[j][k], v[j + 1][k], v[j + 1][k2], v[j][k2]];
      const mx = pts.reduce((s, q) => s + q[0], 0) / pts.length - C[0], my = pts.reduce((s, q) => s + q[1], 0) / pts.length - C[1], ml = Math.hypot(mx, my) || 1;
      const sd = this.shardSeed[j * N + k], d = (open * (5 + sd * 16) + S.k * 5 * p) * out;
      const q = pts.map((a) => [a[0] + (mx / ml) * d, a[1] + (my / ml) * d]);
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; q.forEach((a) => { x0 = Math.min(x0, a[0]); y0 = Math.min(y0, a[1]); x1 = Math.max(x1, a[0]); y1 = Math.max(y1, a[1]); });
      this.glass(g, (c) => this.poly(c, q), { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, { a: smooth(p * 3) * out * 0.42, t, seed: sd, tint: 0.02 + sd * 0.03, sweep: sd > 0.6 });
    }
    // fracture lines
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    for (const c of this.cracks) {
      const prog = clamp((p * 1.25 - c.delay) / 0.7); if (prog <= 0) continue;
      const total = c.pts.length - 1, upto = prog * total; g.beginPath(); g.moveTo(c.pts[0][0], c.pts[0][1]);
      for (let s = 1; s <= Math.ceil(upto); s++) { const f = Math.min(1, upto - (s - 1)), a = c.pts[s - 1], b = c.pts[s]; g.lineTo(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f); }
      g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba(ICE, 0.16 * out); g.lineWidth = 9 * c.width; g.stroke();
      g.globalCompositeOperation = 'source-over'; g.strokeStyle = rgba(BONE, 0.9 * out); g.lineWidth = 1.7 * c.width; g.stroke();
    }
    g.restore();
  }

  necklace(g, S) { // verse II: a chrome chain sagging across the top, lit bead by bead as the verse plays
    const t = S.t, prog = clamp((t - 105) / 12), n = 46;
    for (let k = 0; k <= n; k++) {
      const u = k / n, x = 160 + u * 1600, sag = 250 * Math.sin(Math.PI * u) ** 0.9 + Math.sin(t * 0.6 + u * 5) * 6;
      const y = 150 + sag, lit = smooth((prog * 1.2 - u) / 0.15), e = easeOut((t - 105 - u * 1.2) / 0.6);
      g.save(); g.globalAlpha = e * (0.35 + 0.65 * lit);
      const r = 7 + 4 * Math.sin(Math.PI * u), gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
      gr.addColorStop(0, rgba(BONE)); gr.addColorStop(0.6, rgba(ICE)); gr.addColorStop(1, rgba(LILAC, 0.9));
      g.fillStyle = gr; g.shadowColor = rgba(ICE, 0.7); g.shadowBlur = 12 * lit; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.restore();
    }
  }

  furniture(g, S) {
    const t = S.t, vis = easeOut((t - 3) / 1.5) * (1 - smooth((t - 232) / 4));
    if (vis <= 0) return;
    g.save(); g.globalAlpha = vis; g.fillStyle = rgba(ICE, 0.95); g.textBaseline = 'alphabetic';
    g.font = `500 17px ${SANS}`; g.letterSpacing = '6px';
    g.fillText('KATSEYE  —  UNLOVEU', 64, 74);
    g.textAlign = 'right'; g.fillText(`${S.ch.roman}  ${S.ch.name}`, W - 64, 74);
    g.textAlign = 'left'; g.letterSpacing = '0px';
    // timeline hairline with chapter ticks
    const y = 1030, x0 = 64, x1 = W - 64, d = this.an.duration;
    g.fillStyle = rgba(ICE, 0.2); g.fillRect(x0, y, x1 - x0, 1.5);
    g.fillStyle = rgba(BONE, 0.9); g.fillRect(x0, y - 0.5, (x1 - x0) * clamp(t / d), 2.5);
    CH.forEach((c) => { g.fillStyle = rgba(ICE, 0.55); g.fillRect(x0 + (x1 - x0) * (c.a / d), y - 6, 1.5, 13); });
    g.restore();
  }

  chrome(g, S, alpha) { // intro slab + title
    const t = S.t, e = easeOut(t / 6), out = smooth((t - 17.5) / 2.4);
    const w = 1240 * (0.9 + 0.1 * e), h = 640 * (0.9 + 0.1 * e), x = W / 2 - w / 2 - out * W * 0.9, y = H / 2 - h / 2;
    this.glass(g, (c) => this.rr(c, x, y, w, h, 56), { x, y, w, h }, { a: alpha * e * (1 - out), t, tint: 0.1 });
    const a = alpha * (1 - out);
    g.save(); g.textBaseline = 'alphabetic';
    const kt = smooth((t - 2.4) / 1.4) * (1 - smooth((t - 7.4) / 0.8));
    g.globalAlpha = a * kt; g.fillStyle = rgba(ICE); g.font = `500 26px ${SANS}`; g.letterSpacing = '14px'; g.textAlign = 'center';
    g.fillText('KATSEYE', W / 2 - out * W * 0.9 + 7, H / 2 + 8); g.letterSpacing = '0px';
    g.font = `italic 400 320px ${SERIF}`; g.textAlign = 'left';
    const title = 'Unloveu', tw = g.measureText(title).width; let px = W / 2 - tw / 2 - out * W * 0.9;
    for (let i = 0; i < title.length; i++) {
      const p = smooth((t - 8.2 - i * 0.075) / 0.6), ch = title[i], cw = g.measureText(ch).width;
      g.globalAlpha = a * p; g.fillStyle = rgba(mix(ICE, BONE, p)); if (p < 1) { g.shadowColor = rgba(LILAC, 0.9); g.shadowBlur = 40 * (1 - p); }
      g.fillText(ch, px, H / 2 + 100 + (1 - p) * 40); g.shadowBlur = 0; px += cw;
    }
    g.restore();
  }

  // ---------- frame
  render(t) {
    const S = this.state(t), g = this.g, ci = S.ci; this.chapter = S.ch.roman;
    this.drawBg(t, S);
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.letterSpacing = '0px';
    g.drawImage(this.bgC, 0, 0, W, H);

    // optional Higgsfield layers (screen blend, 1s fades; carry no text)
    for (const [name, L] of Object.entries(this.layers)) {
      const fa = Math.min(smooth((t - L.a) / 1.2), 1 - smooth((t - L.b + 1.2) / 1.2));
      if (fa > 0 && L.video.readyState >= 2) { g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = fa * (name === 'prism' ? 0.62 : 0.5); g.drawImage(L.video, 0, 0, W, H); g.restore(); }
    }

    const cur = this.activeAt(t), L = cur >= 0 ? this.lines[cur] : null, P = cur > 0 ? this.lines[cur - 1] : null;
    const fadeIn = L ? smooth((t - (L.t - 0.12)) / 0.25) : 1; // previous line leaves as the current one arrives
    const hold = (l) => (l ? 1 - smooth((t - (l.end + 0.5)) / 0.5) : 0);
    const inBridge = t >= BRIDGE[0] && t < BRIDGE[1] + 0.5;
    let flash = 0;

    if (ci === 0) {
      this.chrome(g, S, 1);
      g.save(); g.globalAlpha = 0.5 * (1 - smooth((t - 6) / 1)) * smooth((t - 2) / 1); g.fillStyle = rgba(ICE); g.font = `500 15px ${SANS}`; g.letterSpacing = '4px'; g.textAlign = 'center';
      g.fillText('FAN-MADE LYRIC VISUAL  ·  NOT AFFILIATED  ·  CODE', W / 2, H - 150); g.restore();
    } else if (ci === 1) { // verse: alternating left/right glass panels
      const verse = (l, al, dy) => {
        const left = l.i % 2 === 0;
        this.panelLine(g, S, l, al, {
          fit: { font: (s) => `italic 400 ${s}px ${SERIF}`, max: 124, min: 56, maxW: 1000, maxH: 440, lh: 1.04, align: 'left' },
          pos: (ln, pw, ph, e) => ({ x: (left ? 140 : W - 140 - pw) + (left ? -1 : 1) * (1 - e) * 130, y: H / 2 - ph / 2 + (left ? -50 : 40) + Math.sin(t * 0.4 + l.i) * 9 + dy }),
        });
      };
      if (P && fadeIn < 1 && P.t >= CH[1].a - 1) verse(P, (1 - fadeIn) * hold(P), -40 * fadeIn);
      if (L && L.t >= CH[1].a - 1) verse(L, hold(L), 0);
      // slim ghost pane: parallax counter
      const px = (L && L.i % 2 === 0) ? W - 330 : 150, py = 250 + S.k * 6;
      this.glass(g, (c) => this.rr(c, px, py, 180, 580, 90), { x: px, y: py, w: 180, h: 580 }, { a: 0.7, t, seed: 0.3, tint: 0.05 });
      g.save(); g.globalAlpha = 0.55; g.fillStyle = rgba(ICE); g.font = `italic 400 76px ${SERIF}`; g.textAlign = 'center';
      g.fillText(String(Math.max(1, (L ? L.i : 1))).padStart(2, '0'), px + 90, py + 330); g.restore();
    } else if (ci === 2 || inBridge) { // pre-chorus + bridge: caps strips, hard cuts, negative flashes
      const rows = [250, 470, 690];
      const strip = (l, al) => {
        this.panelLine(g, S, l, al, {
          fit: { font: (s) => `700 ${s}px ${SANS}`, max: 92, min: 46, maxW: 1480, maxH: 260, lh: 1.08, align: 'left', upper: true, ls: 5 }, r: 26, tint: 0.07,
          pos: (ln, pw, ph) => ({ x: (ln.i % 2 ? 120 : W - 120 - pw), y: rows[ln.i % 3] - ph / 2 }),
        });
      };
      if (inBridge) this.crack(g, S);
      if (L && L.t >= CH[2].a - 1) strip(L, hold(L));
      if (L) flash = Math.max(flash, clamp(1 - (t - (L.t - 0.1)) / 0.14) * 0.85);
      if (inBridge) flash = Math.max(flash, clamp((S.k - 0.75) * 2.4) * 0.55);
    } else if (ci === 3 || ci === 5 || ci === 6) { // choruses: prism + centered serif
      const sc = SCALE[ci], collapse = ci === 6 ? 1 - smooth((t - COLLAPSE[0]) / (COLLAPSE[1] - COLLAPSE[0])) : 1;
      const born = easeOut((t - CH[ci].a) / 1.4);
      this.prism(g, S, born * collapse, sc);
      const outro = ci === 6 && t >= COLLAPSE[0] - 1;
      const draw = (l, al, dy) => this.chorusLine(g, S, l, al, dy, outro ? 0.38 : sc, outro);
      if (P && fadeIn < 1) draw(P, (1 - fadeIn) * hold(P), -34 * fadeIn);
      if (L && L.t >= CH[ci].a - 1) draw(L, hold(L), 0);
      if (ci >= 5 && L && S.beat < 0.12 && S.k > 0.8) flash = Math.max(flash, 0.12 * ci / 6);
    } else if (ci === 4) { // verse II: necklace + low panel
      this.necklace(g, S);
      const v2 = (l, al) => this.panelLine(g, S, l, al, {
        fit: { font: (s) => `italic 400 ${s}px ${SERIF}`, max: 98, min: 54, maxW: 980, maxH: 300, lh: 1.04, align: 'left' },
        pos: (ln, pw, ph, e) => ({ x: 160 + (1 - e) * 80, y: 640 - ph / 2 + Math.sin(t * 0.5) * 8 }),
      });
      if (P && fadeIn < 1 && P.t >= CH[4].a - 1) v2(P, (1 - fadeIn) * hold(P));
      if (L && L.t >= CH[4].a - 1) v2(L, hold(L));
    }

    // chapter cut: hard negative on the first frames of each new chapter
    if (S.ci > 0 && t - S.ch.a < 0.1 && S.ch.a > 0) flash = Math.max(flash, 0.9);

    this.furniture(g, S);
    // outro: closing mark, then fade to night
    if (t > 230) {
      const e = smooth((t - 232) / 3) * (1 - smooth((t - 242) / 2));
      g.save(); g.globalAlpha = e; g.fillStyle = rgba(BONE); g.font = `italic 400 76px ${SERIF}`; g.textAlign = 'center'; g.fillText('Unloveu', W / 2, H / 2 + 24);
      g.globalAlpha = e * 0.5; g.fillStyle = rgba(ICE); g.font = `500 15px ${SANS}`; g.letterSpacing = '4px'; g.fillText('FAN-MADE LYRIC VISUAL  ·  CODE', W / 2, H / 2 + 78); g.restore();
    }
    const fadeOut = smooth((t - 240) / 4), fadeIn0 = 1 - smooth(t / 2.5);
    // vignette + grain
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, rgba(NIGHT, 0)); vg.addColorStop(1, rgba(NIGHT, 0.6)); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    g.save(); g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.16; const f = Math.floor(t * 24), r = rng(f + 1);
    g.translate(-r() * 256, -r() * 256); g.fillStyle = g.createPattern(this.grain, 'repeat'); g.fillRect(0, 0, W + 256, H + 256); g.restore();
    if (flash > 0.01) { g.save(); g.globalCompositeOperation = 'difference'; g.globalAlpha = clamp(flash); g.fillStyle = rgba(BONE); g.fillRect(0, 0, W, H); g.restore(); }
    const dark = Math.max(fadeOut, fadeIn0);
    if (dark > 0) { g.fillStyle = rgba(NIGHT, dark); g.fillRect(0, 0, W, H); }
    g.setTransform(1, 0, 0, 1, 0, 0);
    this.g0.drawImage(this.B, 0, 0);
  }
}
