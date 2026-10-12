// GO HARD - archive/collage kinetic poster engine (Canvas2D, deterministic render(t)).
// Rules (see memory code-mv-archive-collage-method): found-footage plates cut into frames and stepped on twos, type is the action,
// ink / bone / paper + ONE accent (caution yellow), negative flashes on hits, six visual chapters, each chorus pass one notch bigger.

const W = 1920, H = 1080;
export const INK = '#0b0b0c', BONE = '#ede8dc', PAPER = '#b8b3a7', ACC = '#ffc400';
const LAT = "'Anton','Impact','Arial Narrow',sans-serif";
const KR = "'Noto Sans KR','Malgun Gothic','Apple SD Gothic Neo',sans-serif";
const MONO = "'Space Mono','Consolas',monospace";
const HAN = /([ᄀ-ᇿ㄰-㆏가-힯]+)/;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, x) => a + (b - a) * x;
const sstep = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const eout = (x) => 1 - Math.pow(1 - clamp(x), 3);
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const pad = (n, l) => String(Math.floor(n)).padStart(l, '0');
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

// chapter breakdown (seconds)
export const CHAPTERS = [
  { a: 0, b: 22, name: 'EXPOSURE', sub: 'SLOW MOTION' },
  { a: 22, b: 48, name: 'PRESS', sub: 'FALL HARD' },
  { a: 48, b: 69, name: 'SMASH', sub: 'HEAVY METAL SMASHING' },
  { a: 69, b: 112, name: 'COPY', sub: 'MULTIPLY' },
  { a: 112, b: 138, name: 'OVERLOAD', sub: 'GO HARD x3' },
  { a: 138, b: 1e9, name: 'AFTERMATH', sub: 'NEVER LOOK BACK' },
].map((c, i) => ({ ...c, i }));

const EXTRA_STAMP_BEATS = [128, 136.6]; // third chorus: whisper only caught a few HARDs, fill the rest on the beat grid

export class Scene {
  constructor(canvas, an, lines, words, archive) {
    this.canvas = canvas; this.g0 = canvas.getContext('2d');
    this.B = document.createElement('canvas'); this.B.width = W; this.B.height = H; this.g = this.B.getContext('2d');
    this.an = an; this.A = archive; this.chapter = 'I';
    this.setLines(lines);
    this.noise = this.makeNoise();
    // kick envelope (fast attack, exp decay) from analyzer
    const n = an.kick.length, kd = Math.exp(-6 / an.fps);
    this.kickE = new Float32Array(n);
    for (let i = 1; i < n; i++) this.kickE[i] = Math.max(this.kickE[i - 1] * kd, an.kick[i] > 0.5 ? an.kick[i] : 0);
    // HARD stamps: every "hard" word start from whisper, plus beat-grid fill in the last chorus
    const st = words.filter((w) => /^hard/i.test(w.w.replace(/^[^\p{L}]+/u, ''))).map((w) => w.s);
    const bd = an.beatDur;
    for (let b = Math.ceil((EXTRA_STAMP_BEATS[0] - an.offset) / bd); an.offset + b * bd <= EXTRA_STAMP_BEATS[1]; b++) st.push(an.offset + b * bd);
    this.stamps = [...new Set(st.map((s) => +s.toFixed(3)))].sort((a, b) => a - b);
  }

  setLines(lines) { this.lines = lines; }

  makeNoise() {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const x = c.getContext('2d'), id = x.createImageData(512, 512);
    for (let i = 0; i < 512 * 512; i++) { const v = 128 + (hash(i * 0.37) - 0.5) * 255; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
    x.putImageData(id, 0, 0);
    return c;
  }

  // ---------- state
  state(t) {
    const an = this.an;
    const ch = CHAPTERS.find((c) => t >= c.a && t < c.b) || CHAPTERS[5];
    const k = this.kickE[Math.min(this.kickE.length - 1, Math.max(0, Math.floor(t * an.fps)))];
    let si = -1;
    for (let lo = 0, hi = this.stamps.length - 1; lo <= hi;) { const m = (lo + hi) >> 1; if (this.stamps[m] <= t) { si = m; lo = m + 1; } else hi = m - 1; }
    const sdt = si >= 0 ? t - this.stamps[si] : 99;
    const beatPos = (((t - an.offset) / an.beatDur) % 1 + 1) % 1;
    let inv = 0;
    if (sdt < 0.075 && ch.i >= 1 && ch.i <= 4) inv = 1;
    if (ch.i > 0 && t - ch.a < 0.09) inv = 1;                                        // hard cut between chapters
    if (t >= 125.5 && t < 137 && (beatPos < 0.1 || beatPos > 0.98)) inv = 1;         // last chorus: negative on every beat
    const shake = ch.i >= 1 && ch.i <= 4 && sdt < 0.4 ? (ch.i === 4 ? 30 : 22) * Math.exp(-sdt * 14) : 0;
    const line = this.lineAt(t);
    return { t, ts: Math.floor(t * 12) / 12, ch, k, si, sdt, beatPos, inv, shake, line, lt: line ? t - line.t : 0 };
  }

  lineAt(t) {
    let best = null;
    for (const l of this.lines) { if (l.t <= t && t < l.end) best = l; if (l.t > t) break; }
    return best;
  }

  // ---------- text helpers (Latin = Anton caps, Hangul = Noto Sans KR Black)
  measure(g, s, size) {
    let w = 0;
    for (const r of s.split(HAN).filter(Boolean)) {
      if (HAN.test(r)) { g.font = `900 ${size * 0.9}px ${KR}`; } else { g.font = `400 ${size}px ${LAT}`; }
      w += g.measureText(r).width;
    }
    return w;
  }

  drawWord(g, s, x, cy, size, fill, stroke, sw) {
    const base = cy + size * 0.36;
    g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    for (const r of s.split(HAN).filter(Boolean)) {
      const kr = HAN.test(r);
      g.font = kr ? `900 ${size * 0.9}px ${KR}` : `400 ${size}px ${LAT}`;
      if (stroke) { g.lineJoin = 'round'; g.lineWidth = sw || size * 0.07; g.strokeStyle = stroke; g.strokeText(r, x, base); }
      g.fillStyle = fill; g.fillText(r, x, base);
      x += g.measureText(r).width;
    }
  }

  // fit a multi-row phrase in a box; per-word reveal, HARD words pick up the accent colour
  poster(g, text, box, o = {}) {
    const rows = text.split('\n').map((r) => r.toUpperCase());
    const lhK = o.lh ?? 1.0;
    const wmax = Math.max(...rows.map((r) => this.measure(g, r, 100)));
    const size = Math.floor(Math.min(o.max ?? 320, (box.w / wmax) * 100, box.h / (rows.length * lhK)));
    const lh = size * lhK, total = lh * rows.length, y0 = box.y + (box.h - total) / 2 + lh / 2;
    const align = o.align || 'center', nW = rows.reduce((a, r) => a + r.split(' ').length, 0);
    const sp = this.measure(g, ' ', size);
    let wi = 0;
    rows.forEach((r, ri) => {
      const rw = this.measure(g, r, size);
      let x = align === 'left' ? box.x : align === 'right' ? box.x + box.w - rw : box.x + (box.w - rw) / 2;
      const cy = y0 + ri * lh;
      for (const w of r.split(' ')) {
        const idx = o.reverse ? nW - 1 - wi : wi;
        const a = o.reveal == null ? 1 : clamp(o.reveal * nW - idx);
        if (a > 0) {
          const dy = (1 - a) * size * 0.35 * (o.rise ?? 1);
          g.save(); g.globalAlpha *= a;
          this.drawWord(g, w, x, cy + dy, size, /HARD/.test(w) && !o.noAccent ? ACC : (o.fill || BONE), o.stroke, o.sw);
          g.restore();
        }
        x += this.measure(g, w, size) + sp; wi++;
      }
    });
    return { size, total, y0 };
  }

  frame(set, n) { const a = this.A.sets[set]; return a[((Math.floor(n) % a.length) + a.length) % a.length]; }

  card(g, img, x, y, w, h, o = {}) {
    const iw = img.width, ih = img.height, s = Math.max(w / iw, h / ih) * (o.zoom || 1), sw = w / s, sh = h / s;
    const sx = (iw - sw) / 2 + (o.px || 0) * (iw - sw) / 2, sy = (ih - sh) / 2 + (o.py || 0) * (ih - sh) / 2;
    g.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    if (o.border !== false) { g.strokeStyle = o.bc || BONE; g.lineWidth = o.bw || 4; g.strokeRect(x, y, w, h); }
  }

  hazard(g, x, y, w, h, phase = 0) {
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.fillStyle = ACC; g.fillRect(x, y, w, h); g.fillStyle = INK;
    const s = h, per = s * 2, ph = ((phase % per) + per) % per;
    for (let i = -2; i < w / per + 3; i++) {
      const x0 = x + i * per + ph;
      g.beginPath(); g.moveTo(x0, y + h); g.lineTo(x0 + s, y + h); g.lineTo(x0 + s + h, y); g.lineTo(x0 + h, y); g.closePath(); g.fill();
    }
    g.restore();
  }

  hud(g, S, fg) {
    const t = S.t;
    g.save(); g.globalAlpha = 0.85; g.fillStyle = fg; g.textBaseline = 'top'; g.font = `700 20px ${MONO}`;
    g.textAlign = 'left'; g.fillText('MEOVV / GO HARD', 40, 30);
    g.textAlign = 'right'; g.fillText(`CH.${ROMAN[S.ch.i]}  ${S.ch.name}`, W - 40, 30);
    g.textAlign = 'left'; g.fillText(`FRM ${pad(t * 24, 5)}`, 40, H - 52);
    g.textAlign = 'right'; g.fillText(`${pad(t / 60, 2)}:${pad(t % 60, 2)}:${pad((t % 1) * 24, 2)}`, W - 40, H - 52);
    g.fillRect(0, H - 8, W * (t / this.an.duration), 8);
    g.restore();
  }

  chapterCard(g, S) {
    const ch = S.ch, dt = S.t - ch.a - (ch.i === 0 ? 1.3 : 0);
    if (dt < 0 || dt > 1.2) return;
    const x = dt < 0.1 ? lerp(-W, 0, eout(dt / 0.1)) : dt > 1.0 ? lerp(0, W, sstep((dt - 1.0) / 0.2)) : 0;
    g.save(); g.translate(x, 0);
    g.fillStyle = ACC; g.fillRect(0, 70, W, 170);
    g.fillStyle = INK; this.drawWord(g, `${ROMAN[ch.i]}. ${ch.name}`, 70, 150, 150, INK);
    g.font = `700 24px ${MONO}`; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(`CHAPTER ${ROMAN[ch.i]} / VI  ·  ${ch.sub}`, W - 70, 150);
    g.restore();
  }

  // ---------- chapters
  ch1(g, S) { // EXPOSURE: paper, one figure on twos in slow motion, contact strip develops frame by frame
    const t = S.t;
    g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
    const n = Math.floor(t * 3);                                             // 0.25x slow motion (3 fps vs the 12 fps "on twos")
    const bx = 1030, by = 105, bw = 640, bh = 740;
    this.card(g, this.frame('run', n), bx, by, bw, bh, { bc: INK, bw: 8 });
    g.strokeStyle = INK; g.lineWidth = 6;                                    // viewfinder corners
    for (const [cx, cy, dx, dy] of [[bx - 30, by - 30, 1, 1], [bx + bw + 30, by - 30, -1, 1], [bx - 30, by + bh + 30, 1, -1], [bx + bw + 30, by + bh + 30, -1, -1]]) {
      g.beginPath(); g.moveTo(cx, cy + dy * 70); g.lineTo(cx, cy); g.lineTo(cx + dx * 70, cy); g.stroke();
    }
    g.fillStyle = INK; g.font = `700 22px ${MONO}`; g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText(`SLOW 0.25x   f/${(1.4 + (n % 7) * 0.4).toFixed(1)}   1/${[500, 250, 125, 1000][n % 4]}s`, bx, by + bh + 42);
    // contact strip: frames are exposed one by one (flash + develop)
    const sw = 161, sh = 100, gap = 14, sy = 915;
    for (let i = 0; i < 10; i++) {
      const x = 90 + i * (sw + gap), te = 1.8 + i * 2.0, d = t - te;
      if (d >= 0) {
        g.globalAlpha = clamp(d / 0.5); this.card(g, this.frame('run', i), x, sy, sw, sh, { bc: INK, bw: 3 }); g.globalAlpha = 1;
        if (d < 0.18) { g.fillStyle = BONE; g.globalAlpha = 1 - d / 0.18; g.fillRect(x, sy, sw, sh); g.globalAlpha = 1; }
      } else { g.fillStyle = INK; g.fillRect(x, sy, sw, sh); g.fillStyle = PAPER; g.font = `700 22px ${MONO}`; g.textAlign = 'center'; g.fillText(pad(i + 1, 2), x + sw / 2, sy + sh / 2 - 10); }
      if (i === n % 10) { g.fillStyle = ACC; g.fillRect(x, sy - 16, sw, 9); }
    }
    if (S.line) this.poster(g, S.line.text, { x: 90, y: 120, w: 900, h: 700 }, { align: 'left', fill: INK, noAccent: true, max: 260, reveal: clamp(S.lt / Math.min(1.8, (S.line.end - S.line.t) * 0.7)) });
    // aperture opening from black
    if (t < 2.4) {
      const r = lerp(30, 1300, sstep(t / 2.3));
      g.save(); g.fillStyle = INK; g.beginPath(); g.rect(0, 0, W, H); g.arc(W / 2, H / 2, r, 0, Math.PI * 2, true); g.fill('evenodd'); g.restore();
    }
  }

  ch2(g, S) { // PRESS: slabs close in, everything gets squashed; "fall in love" x3 multiplies windows; "fall hard" drops the layout
    const t = S.t, u = sstep((t - 22) / 26);
    g.fillStyle = INK; g.fillRect(0, 0, W, H);
    const free = Math.max(230, lerp(1080, 300, u) - S.k * 22), top = (H - free) / 2, sy = free / H;
    g.save(); g.beginPath(); g.rect(0, top, W, free); g.clip();
    g.translate(0, H / 2); g.scale(1, sy); g.translate(0, -H / 2);
    const wN = t >= 34.2 ? 3 : t >= 33.3 ? 2 : 1, cw = W / wN;
    for (let j = 0; j < wN; j++) this.card(g, this.frame('hurdle', S.ts * 12 + j * 3), j * cw + 3, 0, cw - 6, H, { bc: BONE, bw: 6, py: -0.2 });
    g.fillStyle = 'rgba(11,11,12,.38)'; g.fillRect(0, 0, W, H);
    let drop = 0;                                                            // "fall": text falls to the floor of the band, lands on HARD
    if (t >= 35.3 && t < 38.6) drop = t < 36.12 ? 190 * Math.pow((t - 35.3) / 0.82, 2) : 190 - 26 * Math.exp(-(t - 36.12) * 7) * Math.abs(Math.cos((t - 36.12) * 15));
    if (S.line) this.poster(g, S.line.text, { x: 120, y: 190 + drop, w: 1680, h: 700 }, { stroke: INK, fill: BONE, max: 330, reveal: clamp(S.lt / 0.5) });
    g.restore();
    this.hazard(g, 0, top - 40, W, 40, -t * 60); g.fillStyle = BONE; g.fillRect(0, 0, W, top - 40);
    this.hazard(g, 0, top + free, W, 40, t * 60); g.fillStyle = BONE; g.fillRect(0, top + free + 40, W, H);
    g.fillStyle = INK; g.font = `700 22px ${MONO}`; g.textAlign = 'left'; g.textBaseline = 'middle';
    if (top > 60) { g.fillText(`PRESSURE ${pad(u * 100, 3)}%  ·  CLEARANCE ${pad(free, 4)}mm`, 40, top / 2 + 14); }
  }

  ch3(g, S) { // SMASH: every HARD is a die hitting the plate, the steel jumps, impressions pile up
    const t = S.t;
    g.fillStyle = INK; g.fillRect(0, 0, W, H);
    const hit = S.si >= 0 ? S.sdt : 99, jump = hit < 0.5 ? 46 * Math.exp(-hit * 16) : 0;
    this.card(g, this.A.plates.hammer_santafe, 330, 70 + jump, 1260, 968, { bc: BONE, bw: 6 });
    g.fillStyle = 'rgba(11,11,12,.25)'; g.fillRect(330, 70, 1260, 968);
    const idxs = []; for (let i = S.si; i >= 0 && idxs.length < 6; i--) if (this.stamps[i] >= 48 - 0.01 && this.stamps[i] < 69.9) idxs.push(i);
    for (const i of idxs.reverse()) {
      const dt = t - this.stamps[i], h = hash(i * 7.3), a = i === S.si ? 1 : clamp(0.55 - (S.si - i) * 0.11);
      const sc = i === S.si ? lerp(1.5, 1, eout(dt / 0.1)) : 1;
      const cx = [W * 0.34, W * 0.66, W * 0.5][i % 3] + (h - 0.5) * 160, cy = [370, 640, 520][(i * 2) % 3] + (hash(i) - 0.5) * 120;
      g.save(); g.translate(cx, cy); g.rotate((h - 0.5) * 0.14); g.scale(sc, sc); g.globalAlpha = a;
      this.poster(g, 'HARD', { x: -800, y: -300, w: 1600, h: 600 }, { fill: BONE, stroke: INK, sw: 26, max: 640, noAccent: i !== S.si });
      g.restore();
    }
    const hardsSoFar = this.stamps.filter((s) => s >= 48 && s <= t && s < 69.9).length;
    g.fillStyle = BONE; g.font = `700 30px ${MONO}`; g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText(`HARD x${pad(hardsSoFar, 2)}`, 60, 110);
    if (S.line && S.line.kind === 'hook' && !/^HARD/i.test(S.line.text)) this.poster(g, S.line.text.replace('\n', ' '), { x: 60, y: 930, w: 1800, h: 90 }, { align: 'left', fill: BONE, stroke: INK, sw: 8, max: 76, noAccent: true });
    if (t >= 68.9) {                                                          // last HARD: the whole frame is the stamp
      const d = t - 68.9;
      g.fillStyle = ACC; g.globalAlpha = d < 0.7 ? 1 : clamp(1 - (d - 0.7) / 0.4); g.fillRect(0, 0, W, H);
      this.poster(g, 'HARD', { x: 60, y: 100, w: 1800, h: 880 }, { fill: INK, max: 900, noAccent: true }); g.globalAlpha = 1;
    }
  }

  ch4(g, S) { // COPY: silence = ghosts multiply; verse 2 = windows multiply on every line
    const t = S.t;
    g.fillStyle = INK; g.fillRect(0, 0, W, H);
    if (t < 85.2) {
      g.globalAlpha = 0.3; this.card(g, this.A.plates.billet, 0, 0, W, H, { border: false, zoom: 1 + (t - 69) * 0.01 }); g.globalAlpha = 1;
      const nG = Math.min(16, 1 + Math.floor((t - 69) * 1.0));
      for (let i = 0; i < nG; i++) {
        const x = ((t - 69) * 160 + i * (W / nG)) % (W + 300) - 150, h = 300 - (i % 4) * 28;
        const img = this.frame(i % 2 ? 'jump2' : 'jump', S.ts * 12 + i * 2);
        this.card(g, img, x, 560 - h / 2 + (i % 3) * 20, h * 0.74, h, { bc: BONE, bw: 3 });
      }
      g.fillStyle = BONE; g.font = `400 330px ${LAT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.globalAlpha = 0.92;
      g.fillText(pad(S.ts * 24 + (t - 69) * 12, 4), W / 2, 330); g.globalAlpha = 1;
      g.strokeStyle = ACC; g.lineWidth = 5; g.beginPath();                    // pulse line
      for (let x = 0; x <= W; x += 8) { const a = Math.sin(x * 0.03 + t * 8) * 6 + (hash(x + Math.floor(t * 24)) - 0.5) * S.k * 160; g.lineTo(x, 900 + a); }
      g.stroke();
      return;
    }
    const PLAN = [[85, 1, 1], [88.2, 2, 1], [90.8, 2, 2], [93, 3, 2], [95.4, 3, 3], [98.2, 4, 3], [101.1, 5, 3], [104.7, 5, 4], [106.4, 6, 4], [109.3, 6, 5], [111.2, 8, 5]];
    let pi = 0; while (pi + 1 < PLAN.length && PLAN[pi + 1][0] <= t) pi++;
    const [pt, cols, rows] = PLAN[pi], gap = 10, bar = 26, SETS = ['horse', 'hurdle', 'jump', 'run', 'horse2', 'jump2'];
    const cw = (W - 80 - gap * (cols - 1)) / cols, chh = (H - 140 - gap * (rows - 1)) / rows;
    const pop = eout((t - pt) / 0.25);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c, x = 40 + c * (cw + gap), y = 70 + r * (chh + gap), fresh = i >= (pi ? PLAN[pi - 1][1] * PLAN[pi - 1][2] : 0);
      const s = fresh ? pop : 1;
      g.save(); g.translate(x + cw / 2, y + chh / 2); g.scale(s, s); g.translate(-cw / 2, -chh / 2);
      g.fillStyle = BONE; g.fillRect(0, 0, cw, bar); g.fillStyle = INK; g.font = `700 16px ${MONO}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(`WIN ${pad(i + 1, 2)}`, 8, bar / 2 + 1);
      g.save(); g.beginPath(); g.rect(0, bar, cw, chh - bar); g.clip();
      this.card(g, this.frame(SETS[(i * 5) % 6], S.ts * 12 + i * 2), 0, bar, cw, chh - bar, { bc: BONE, bw: 3, py: -0.3 });
      g.restore(); g.restore();
    }
    if (S.line) {
      g.fillStyle = 'rgba(11,11,12,.5)'; g.fillRect(0, 300, W, 480);
      this.poster(g, S.line.text, { x: 100, y: 330, w: 1720, h: 420 }, { stroke: INK, sw: 16, max: 280, reveal: clamp(S.lt / 0.45) });
    }
  }

  ch5(g, S) { // OVERLOAD: the same hook three times, each pass a bigger grid, faster steps, fuller meter
    const t = S.t, pass = t >= 125.5 ? 2 : t >= 119.9 ? 1 : 0;
    const [cols, rows] = [[2, 2], [3, 3], [5, 4]][pass], rate = [12, 18, 24][pass], level = [0.45, 0.75, 1][pass];
    g.fillStyle = INK; g.fillRect(0, 0, W, H);
    const SETS = ['horse', 'jump', 'hurdle', 'run', 'horse2', 'jump2'], gap = pass === 2 ? 6 : 10, mw = 90;
    const cw = (W - mw - 60 - gap * (cols - 1)) / cols, chh = (H - 150 - gap * (rows - 1)) / rows;
    const hitCell = S.sdt < 0.22 ? (S.si * 7) % (cols * rows) : -1;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c, x = 30 + c * (cw + gap), y = 60 + r * (chh + gap);
      const jx = pass >= 1 ? (hash(i + Math.floor(t * rate)) - 0.5) * 10 * S.k : 0;
      if (i === hitCell) { g.fillStyle = ACC; g.fillRect(x, y, cw, chh); this.poster(g, 'HARD', { x: x + 6, y: y + 6, w: cw - 12, h: chh - 12 }, { fill: INK, max: 500, noAccent: true }); continue; }
      this.card(g, this.frame(SETS[(i * 5) % 6], Math.floor(t * rate) + i * 2), x + jx, y, cw, chh, { bc: BONE, bw: 3, py: -0.3 });
    }
    // meter
    const segs = 28, mx = W - mw + 10, lit = pass === 2 ? segs - (hash(Math.floor(t * 24)) > 0.7 ? 1 : 0) : Math.round(segs * clamp(level * (0.72 + 0.35 * S.k)));
    for (let i = 0; i < segs; i++) { const on = i < lit, y = H - 70 - (i + 1) * 30; g.fillStyle = on ? (i >= segs - 5 ? ACC : BONE) : 'rgba(237,232,220,.14)'; g.fillRect(mx, y, 56, 24); }
    if (S.line) {
      g.fillStyle = 'rgba(11,11,12,.55)'; g.fillRect(0, 380, W - mw, 320);
      this.poster(g, S.line.text.replace(/\n/g, ' '), { x: 60, y: 400, w: W - mw - 120, h: 280 }, { stroke: INK, sw: 14, max: 250, reveal: pass === 2 ? 1 : clamp(S.lt / 0.3) });
    }
    g.fillStyle = BONE; g.font = `700 22px ${MONO}`; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(`PASS ${pass + 1}/3  ·  ${rate}fps  ·  LOAD ${pad(level * 100, 3)}%`, 40, 1000);
    if (t > 136.6) { g.fillStyle = INK; g.globalAlpha = clamp((t - 136.6) / 0.3); g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  }

  ch6(g, S) { // AFTERMATH: the grid drains, engraving fades in over the counter, the last lines run backwards, end card
    const t = S.t;
    g.fillStyle = INK; g.fillRect(0, 0, W, H);
    if (t >= 141.2 && t < 172) {
      const a = sstep((t - 141.2) / 3) * (1 - sstep((t - 160) / 9));
      g.globalAlpha = a; this.card(g, this.A.plates.hammer_full, 280, 100, 1360, 880, { bc: BONE, bw: 4, zoom: 1 + (t - 141) * 0.004 }); g.globalAlpha = 1;
      g.fillStyle = BONE; g.font = `400 150px ${LAT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.globalAlpha = 0.9;
      g.fillText(pad(Math.max(0, 3400 - (t - 141) * 24), 5), W / 2, 540); g.globalAlpha = 1;
      g.fillStyle = ACC; g.beginPath(); g.arc(W / 2, 800, 10 + S.k * 14, 0, Math.PI * 2); g.fill();
    }
    if (S.line) {
      const l = S.line, rev = l.t > 170, d = l.end - l.t;
      const o = { max: 300, fill: BONE, noAccent: t < 179, reveal: clamp(S.lt / Math.min(2.2, d * 0.6)), reverse: rev, stroke: INK, sw: 14 };
      this.poster(g, l.text, { x: 100, y: 190, w: 1720, h: 700 }, o);
      if (l.t >= 178 && t >= 179.32) { const dd = t - 179.32; g.fillStyle = ACC; g.globalAlpha = clamp(1 - dd / 0.5) * 0.9; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    }
    if (t >= 185.4) {
      const a = sstep((t - 185.4) / 0.8);
      g.globalAlpha = a; g.fillStyle = INK; g.fillRect(0, 0, W, H);
      this.poster(g, 'GO HARD', { x: 100, y: 230, w: 1720, h: 560 }, { fill: BONE, max: 640, noAccent: true });
      g.fillStyle = ACC; g.fillRect(100, 800, 1720, 14);
      g.fillStyle = BONE; g.font = `700 26px ${MONO}`; g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillText('MEOVV  ·  FAN-MADE CODE LYRICS VIDEO  ·  NOT AFFILIATED', 100, 836);
      g.font = `700 18px ${MONO}`; g.globalAlpha = a * 0.7;
      g.fillText('ARCHIVE: MUYBRIDGE ANIMAL LOCOMOTION (1887)  ·  LIBRARY OF CONGRESS  ·  BOSTON PUBLIC LIBRARY  ·  WIKIMEDIA COMMONS (PUBLIC DOMAIN)', 100, 888);
      g.globalAlpha = 1;
    }
    if (t > 190.6) { g.fillStyle = INK; g.globalAlpha = clamp((t - 190.6) / 1.2); g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  }

  // ---------- frame
  render(t) {
    const g = this.g, c = this.g0, S = this.state(t);
    this.chapter = ROMAN[S.ch.i];
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
    g.save();
    if (S.shake > 0.5) { const f = Math.floor(t * 30); g.translate((hash(f) - 0.5) * 2 * S.shake, (hash(f + 5) - 0.5) * 2 * S.shake); }
    [this.ch1, this.ch2, this.ch3, this.ch4, this.ch5, this.ch6][S.ch.i].call(this, g, S);
    g.restore();
    this.hud(g, S, S.ch.i === 0 ? INK : BONE);
    this.chapterCard(g, S);

    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.fillStyle = INK; c.fillRect(0, 0, W, H);
    c.filter = S.inv ? 'invert(1) hue-rotate(180deg)' : 'none';
    c.drawImage(this.B, 0, 0);
    c.filter = 'none';
    this.post(c, S);
  }

  post(c, S) {
    const t = S.t, gi = Math.floor(t * 24), ox = hash(gi) * 512, oy = hash(gi + 99) * 512;
    c.save();
    c.globalCompositeOperation = 'overlay'; c.globalAlpha = S.ch.i === 0 ? 0.3 : 0.2;
    for (let x = -ox; x < W; x += 512) for (let y = -oy; y < H; y += 512) c.drawImage(this.noise, x, y);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    // dust + scratches (new set every 24th of a second)
    c.fillStyle = 'rgba(237,232,220,.55)';
    for (let i = 0; i < 7; i++) { const h1 = hash(gi * 13 + i), h2 = hash(gi * 17 + i * 3); if (h1 > 0.45) c.fillRect(h1 * W, h2 * H, 2 + h2 * 3, 2 + h1 * 3); }
    if (hash(gi * 5.1) > 0.8) { c.fillStyle = 'rgba(237,232,220,.28)'; c.fillRect(hash(gi * 7.7) * W, 0, 2, H); }
    // shutter flicker + vignette
    c.fillStyle = INK; c.globalAlpha = 0.05 * hash(gi * 3.3); c.fillRect(0, 0, W, H); c.globalAlpha = 1;
    const v = c.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.05);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.42)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
    c.restore();
  }
}
