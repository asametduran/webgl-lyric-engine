// BABYMONSTER - DESERVE: line distribution dashboard + messenger bubble lyrics. Canvas2D, deterministic render(t) (seek / frame-capture safe).
// Palette: ink #0E0F14, paper #F2F2F7 + the six member pastels (rora/chiquita/ahyeon/pharita/ruka/asa) as the only accents.
// Layout 1920x1080: left HUD (line distribution) | centre messenger chat | right (now playing, MV window, vocalist spotlight).
// Outro: centred "FINAL LINE DISTRIBUTION" summary card.

const W = 1920, H = 1080;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const easeOut = (x) => 1 - (1 - clamp(x)) ** 3;
const easeInOut = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const FONT = '"Segoe UI", "Malgun Gothic", "Apple SD Gothic Neo", Arial, sans-serif';
const INK = hex('#0E0F14'), PAPER = hex('#F2F2F7'), TXT = '#15161D';

// HUD order requested by the brief
const ORDER = ['ruka', 'pharita', 'asa', 'ahyeon', 'rora', 'chiquita'];
const NAME = { ruka: 'RUKA', pharita: 'PHARITA', asa: 'ASA', ahyeon: 'AHYEON', rora: 'RORA', chiquita: 'CHIQUITA' };
// photo crop focus per member: [avatar cx, cy, crop height as a fraction of the image, spotlight cx, cy, crop height]
const FOCUS = {
  ahyeon: [0.33, 0.30, 0.40, 0.45, 0.5, 1.0], chiquita: [0.40, 0.45, 0.60, 0.42, 0.45, 0.95], pharita: [0.57, 0.15, 0.30, 0.57, 0.25, 0.5],
  asa: [0.52, 0.27, 0.34, 0.5, 0.42, 0.85], rora: [0.26, 0.27, 0.30, 0.30, 0.5, 1.0], ruka: [0.38, 0.33, 0.45, 0.42, 0.5, 1.0],
};
const ESC = { chorus1: 1.0, chorus2: 1.07, chorus3: 1.14, post1: 1.0, post2: 1.04 };

// layout rectangles
const LP = { x: 40, y: 40, w: 420, h: 1000 };
const CX = 500, CW = 780;
const NP = { x: 1320, y: 40, w: 560, h: 120 };
const MV = { x: 1320, y: 180, w: 560, h: 238 };
const SP = { x: 1320, y: 440, w: 560, h: 600 };
const CHAT_TOP = 190, CHAT_BOTTOM = 1000;

function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function rrCorners(g, x, y, w, h, tl, tr, br, bl) { g.beginPath(); g.roundRect(x, y, w, h, [tl, tr, br, bl]); }

// crop an image around a focus point into a fresh canvas (cover fit)
function cropTo(img, cx, cy, hFrac, aw, ah) {
  const c = document.createElement('canvas'); c.width = aw; c.height = ah;
  const g = c.getContext('2d');
  let sh = img.height * hFrac, sw = sh * aw / ah;
  if (sw > img.width) { sw = img.width; sh = sw * ah / aw; }
  const sx = clamp(cx * img.width - sw / 2, 0, img.width - sw), sy = clamp(cy * img.height - sh / 2, 0, img.height - sh);
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, sx, sy, sw, sh, 0, 0, aw, ah);
  return c;
}

export class Scene {
  constructor(canvas, an, lines, meta, assets = {}) {
    this.canvas = canvas; this.g = canvas.getContext('2d');
    this.an = an; this.meta = meta; this.sectionName = '';
    this.video = assets.video || null;
    this.col = {}; for (const k of ORDER) this.col[k] = hex(meta.colors[k]);
    this.DUR = meta.duration;
    // pre-cropped photo canvases (avatar 256px square, spotlight 560x600); Asa / missing files fall back to a procedural silhouette
    this.av = {}; this.sp = {};
    for (const k of ORDER) {
      const im = assets.imgs && assets.imgs[k], f = FOCUS[k];
      if (im && f) { this.av[k] = cropTo(im, f[0], f[1], f[2], 256, 256); this.sp[k] = cropTo(im, f[3], f[4], f[5], SP.w, SP.h); }
      else { this.av[k] = this.silhouette(k, 256, 256, true); this.sp[k] = this.silhouette(k, SP.w, SP.h, false); }
    }
    const n = an.kick.length, kd = Math.exp(-7 / an.fps);
    this.kickE = new Float32Array(n);
    for (let i = 1; i < n; i++) this.kickE[i] = Math.max(this.kickE[i - 1] * kd, an.kick[i] > 0.5 ? an.kick[i] : 0);
    this.setLines(lines);
  }

  // original procedural avatar: tinted gradient, head + shoulders, no real likeness
  silhouette(k, w, h, round) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), col = this.col[k];
    const bg = g.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, rgba(mix(col, INK, 0.55))); bg.addColorStop(1, rgba(mix(col, INK, 0.85)));
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const s = Math.min(w, h), cx = w / 2, fill = rgba(mix(col, PAPER, 0.15), 0.9);
    g.fillStyle = fill;
    g.beginPath(); g.ellipse(cx, h * (round ? 0.4 : 0.38), s * 0.19, s * 0.22, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(cx, h * 1.02, s * 0.42, s * 0.36, 0, Math.PI, 0); g.fill();
    if (!round) { g.font = `800 ${s * 0.5}px ${FONT}`; g.textAlign = 'center'; g.fillStyle = rgba(col, 0.16); g.fillText(NAME[k][0], cx, h * 0.92); }
    return c;
  }

  setLines(lines) {
    this.lines = lines.slice().sort((a, b) => a.t - b.t);
    const g = this.g;
    this.lines.forEach((l, i) => {
      const prev = this.lines[i - 1];
      l.first = !prev || prev.singers.join() !== l.singers.join() || l.t - prev.end > 6;
      l.esc = ESC[l.secId] || 1;
      const fs = 38 * l.esc, fs2 = 23 * l.esc;
      l.fs = fs; l.fs2 = fs2;
      g.font = `600 ${fs}px ${FONT}`;
      l.wrap = this.wrap(l.text, 600 * Math.min(1.1, l.esc));
      const w1 = Math.max(...l.wrap.map((s) => g.measureText(s).width));
      g.font = `500 ${fs2}px ${FONT}`;
      l.rwrap = l.rom ? this.wrap(l.rom, 600 * Math.min(1.1, l.esc)) : [];
      const w2 = l.rwrap.length ? Math.max(...l.rwrap.map((s) => g.measureText(s).width)) : 0;
      l.bw = Math.max(w1, w2) + 60;
      l.bh = 40 + l.wrap.length * fs * 1.25 + (l.rwrap.length ? 8 + l.rwrap.length * fs2 * 1.2 : 0);
      l.slot = l.bh + (l.first ? 30 : 0);
    });
    // cumulative vocal-time accounting: every singer on a line gets an equal share of its duration
    this.byMember = Object.fromEntries(ORDER.map((m) => [m, this.lines.filter((l) => l.singers.includes(m))]));
    this.total = Object.fromEntries(ORDER.map((m) => [m, this.byMember[m].reduce((s, l) => s + (l.end - l.t) / l.singers.length, 0)]));
  }

  wrap(text, maxW) {
    const g = this.g, words = text.split(' '), out = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (cur && g.measureText(t).width > maxW) { out.push(cur); cur = w; } else cur = t;
    }
    if (cur) out.push(cur);
    return out;
  }

  kickAt(t) { return this.kickE[clamp(Math.floor(t * this.an.fps), 0, this.kickE.length - 1)] || 0; }
  energy(t, arr) { return this.an[arr][clamp(Math.floor(t * this.an.fps), 0, this.an[arr].length - 1)] || 0; }

  acc(m, now) {
    let s = 0;
    for (const l of this.byMember[m]) { if (l.t >= now) break; s += (Math.min(now, l.end) - l.t) / l.singers.length; }
    return s;
  }

  activeWeights(now) { // soft per-member activity (0..1) for glow / colour blending
    const w = Object.fromEntries(ORDER.map((m) => [m, 0]));
    for (const l of this.lines) {
      const a = easeOut((now - l.t + 0.1) / 0.25) * (1 - easeOut((now - l.end) / 0.35));
      if (a > 0) for (const m of l.singers) w[m] = Math.max(w[m], a);
    }
    return w;
  }

  drawAvatar(g, m, cx, cy, r, alpha = 1, ring = 0) {
    g.save(); g.globalAlpha *= alpha;
    if (ring > 0) { g.beginPath(); g.arc(cx, cy, r + 4, 0, Math.PI * 2); g.fillStyle = rgba(this.col[m], clamp(ring)); g.fill(); }
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
    g.drawImage(this.av[m], cx - r, cy - r, r * 2, r * 2);
    g.restore();
  }

  render(t) {
    const g = this.g;
    this.sectionName = (this.meta.chapters.find((c) => t >= c.a && t < c.b) || {}).name || '';
    const act = this.activeWeights(t), kick = this.kickAt(t);
    // blended accent of whoever is singing
    let acc = [150, 150, 170], wsum = 0.0001, ar = 0, ag = 0, ab = 0;
    for (const m of ORDER) { ar += this.col[m][0] * act[m]; ag += this.col[m][1] * act[m]; ab += this.col[m][2] * act[m]; wsum += act[m]; }
    if (wsum > 0.05) acc = [ar / wsum, ag / wsum, ab / wsum];
    const accA = clamp(wsum, 0, 1);

    // ---- background
    g.globalAlpha = 1;
    g.fillStyle = rgba(INK); g.fillRect(0, 0, W, H);
    const rad = g.createRadialGradient(900, 600, 50, 900, 600, 1100);
    rad.addColorStop(0, rgba(acc, 0.09 * accA + 0.02 + 0.03 * kick)); rad.addColorStop(1, rgba(INK, 0));
    g.fillStyle = rad; g.fillRect(0, 0, W, H);
    this.drawGrid(g, t);

    // intro choreography (HUD + now playing glide in), outro dims the chat / right column
    const iL = easeOut((t - 0.6) / 1.2), iN = easeOut((t - 1.4) / 1.0), iM = easeOut((t - 2.0) / 1.2), iS = easeOut((t - 2.8) / 1.2), iC = easeOut((t - 3.4) / 1.0);
    const out = easeInOut((t - 194.0) / 1.0);
    const dimOut = 1 - 0.55 * out;

    g.save(); g.globalAlpha = iL; g.translate(-90 * (1 - iL), 0); this.drawHud(g, t, act, kick); g.restore();
    g.save(); g.globalAlpha = iC * (1 - out); this.drawChat(g, t, act, kick); g.restore();
    g.save(); g.globalAlpha = iN * dimOut; g.translate(0, -80 * (1 - iN)); this.drawNowPlaying(g, t, acc); g.restore();
    g.save(); g.globalAlpha = iM * dimOut; g.translate(90 * (1 - iM), 0); this.drawMv(g, t, acc, kick); g.restore();
    g.save(); g.globalAlpha = iS * dimOut; g.translate(0, 90 * (1 - iS)); this.drawSpot(g, t, acc, kick); g.restore();

    // chorus entrance: brief paper flash (single short pulse, not a strobe)
    const seen = new Set();
    for (const l of this.lines) {
      if (!l.secId.startsWith('chorus') || seen.has(l.secId)) continue;
      seen.add(l.secId);
      const d = t - l.t;
      if (d >= 0 && d < 0.16) { g.fillStyle = rgba(PAPER, 0.13 * (1 - d / 0.16) * (l.esc > 1.1 ? 1.4 : 1)); g.fillRect(0, 0, W, H); }
    }
    if (t >= 194.6) this.drawSummary(g, t);
  }

  drawGrid(g, t) {
    g.save(); g.strokeStyle = 'rgba(242,242,247,0.025)'; g.lineWidth = 1;
    const o = (t * 6) % 60;
    g.beginPath();
    for (let x = -o; x < W; x += 60) { g.moveTo(x, 0); g.lineTo(x, H); }
    for (let y = 0; y < H; y += 60) { g.moveTo(0, y); g.lineTo(W, y); }
    g.stroke(); g.restore();
  }

  card(g, x, y, w, h, r = 40, fill = 'rgba(255,255,255,0.045)', stroke = 'rgba(255,255,255,0.07)') {
    rr(g, x, y, w, h, r); g.fillStyle = fill; g.fill(); g.lineWidth = 1.5; g.strokeStyle = stroke; g.stroke();
  }

  // ---------------------------------------------------------------- left: line distribution HUD
  drawHud(g, t, act, kick) {
    this.card(g, LP.x, LP.y, LP.w, LP.h);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = rgba(PAPER); g.font = `800 30px ${FONT}`; g.fillText('LINE DISTRIBUTION', LP.x + 36, LP.y + 62);
    g.fillStyle = 'rgba(242,242,247,0.45)'; g.font = `500 17px ${FONT}`;
    g.fillText('live vocal time · full bar = 25% of the song', LP.x + 36, LP.y + 92);
    ORDER.forEach((m, i) => {
      const ry = LP.y + 125 + i * 138, ax = LP.x + 36 + 42, ay = ry + 58, a = act[m];
      const pulse = a * (0.55 + 0.25 * Math.sin(t * 10) + 0.4 * kick);
      const s = this.acc(m, t), pct = (s / this.DUR) * 100, col = this.col[m];
      // active row plate
      if (a > 0.01) {
        rr(g, LP.x + 14, ry, LP.w - 28, 120, 30); g.fillStyle = rgba(col, 0.10 * a); g.fill();
        g.strokeStyle = rgba(col, 0.5 * a); g.lineWidth = 2; g.stroke();
      }
      this.drawAvatar(g, m, ax, ay, 42, 1, 0.9 * a);
      g.textAlign = 'left';
      g.fillStyle = rgba(mix(PAPER, col, 0.35 * a + 0.1)); g.font = `800 27px ${FONT}`; g.fillText(NAME[m], LP.x + 36 + 100, ry + 42);
      // pill bar
      const bx = LP.x + 36 + 100, by = ry + 56, bw = 240, bh = 22;
      rr(g, bx, by, bw, bh, bh / 2); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fill();
      const fw = clamp(pct / 25) * bw;
      if (fw > 0.5) {
        g.save();
        g.shadowColor = rgba(col, 0.9); g.shadowBlur = 6 + 26 * clamp(pulse);
        rr(g, bx, by, Math.max(bh, fw), bh, bh / 2); g.fillStyle = rgba(col); g.fill();
        g.restore();
        if (a > 0.05) { // moving sheen on the leading edge while singing
          g.save(); rr(g, bx, by, Math.max(bh, fw), bh, bh / 2); g.clip();
          const sx = bx + Math.max(bh, fw) - 40 + 20 * Math.sin(t * 8);
          const gr = g.createLinearGradient(sx - 30, 0, sx + 30, 0);
          gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,255,255,${0.55 * a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = gr; g.fillRect(sx - 30, by, 60, bh); g.restore();
        }
      }
      g.fillStyle = 'rgba(242,242,247,0.85)'; g.font = `600 22px ${FONT}`;
      g.fillText(`${s.toFixed(1)}s`, bx, ry + 108);
      g.textAlign = 'right'; g.fillStyle = rgba(mix(PAPER, col, 0.5)); g.font = `800 22px ${FONT}`;
      g.fillText(`${pct.toFixed(1)}%`, bx + bw, ry + 108); g.textAlign = 'left';
    });
    g.fillStyle = 'rgba(242,242,247,0.4)'; g.font = `500 17px ${FONT}`;
    g.fillText(`${fmtT(t)} / ${fmtT(this.DUR)}`, LP.x + 36, LP.y + LP.h - 26);
  }

  // ---------------------------------------------------------------- centre: messenger lyrics
  drawChat(g, t, act, kick) {
    // group-chat header pill
    rr(g, CX, 40, CW, 110, 55); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1.5; g.stroke();
    ORDER.forEach((m, i) => this.drawAvatar(g, m, CX + 70 + i * 40, 95, 30, 1, 0));
    g.textAlign = 'left'; g.fillStyle = rgba(PAPER); g.font = `800 30px ${FONT}`; g.fillText('DESERVE', CX + 340, 90);
    const typing = this.lines.some((l) => t >= l.t - 0.4 && t < l.t);
    g.fillStyle = 'rgba(242,242,247,0.5)'; g.font = `500 19px ${FONT}`; g.fillText(typing ? 'someone is typing…' : '6 members · active now', CX + 340, 122);
    const live = Math.sin(t * 4) * 0.5 + 0.5;
    g.beginPath(); g.arc(CX + CW - 50, 95, 9, 0, Math.PI * 2); g.fillStyle = `rgba(155,246,255,${0.5 + 0.5 * live})`; g.fill();

    // visible window: last (up to 6) appeared lines
    let k = -1;
    for (let i = 0; i < this.lines.length; i++) if (this.lines[i].t <= t) k = i;
    const first = Math.max(0, k - 5);
    // typing indicator slot: line whose lead-in is running
    let sIdx = -1;
    for (let i = 0; i < this.lines.length; i++) { const l = this.lines[i]; if (t >= l.t - 0.4 && t < l.t + 0.35) sIdx = i; }
    let indQ = 0;
    if (sIdx >= 0) { const l = this.lines[sIdx]; indQ = t < l.t ? easeOut((t - (l.t - 0.4)) / 0.15) : 1 - easeOut((t - l.t) / 0.35); }
    const INDH = 64, GAP = 12;
    let y = CHAT_BOTTOM - (indQ > 0.001 ? indQ * (INDH + GAP) : 0);
    g.save(); rr(g, CX - 10, CHAT_TOP - 10, CW + 20, CHAT_BOTTOM - CHAT_TOP + 20, 20); g.clip();
    if (indQ > 0.001) this.drawIndicator(g, this.lines[sIdx], CX, CHAT_BOTTOM - INDH * indQ, INDH, indQ, t);
    for (let i = k; i >= first; i--) {
      const l = this.lines[i], p = easeOut((t - l.t) / 0.35), eff = l.slot * p + GAP * p + (l.first ? 10 * p : 0);
      const top = y - (l.slot * p), age = k - i;
      const fade = clamp((top + 60 - CHAT_TOP) / 150) * (age > 4 ? 0.5 : 1);
      if (fade > 0.01 && p > 0.01) this.drawBubble(g, l, CX, top, p, fade, i === k ? kick : 0);
      y -= eff;
    }
    g.restore();
  }

  drawIndicator(g, l, x, y, h, q, t) {
    const duet = l.singers.length > 1, ax = x + 32, bx = x + (duet ? 100 : 70);
    g.save(); g.globalAlpha *= q;
    for (let j = l.singers.length - 1; j >= 0; j--) this.drawAvatar(g, l.singers[j], ax + 30 * j, y + h / 2, 28);
    this.bubblePath(g, bx, y + 2, 120, h - 4, l.singers.map((m) => this.col[m]), 0.85);
    for (let i = 0; i < 3; i++) {
      const b = Math.sin(t * 9 - i * 0.9) * 0.5 + 0.5;
      g.beginPath(); g.arc(bx + 32 + i * 28, y + h / 2 - b * 6 + 2, 8, 0, Math.PI * 2); g.fillStyle = `rgba(21,22,29,${0.4 + 0.5 * b})`; g.fill();
    }
    g.restore();
  }

  bubblePath(g, x, y, w, h, cols, alpha = 1) {
    rrCorners(g, x, y, w, h, 30, 30, 30, 8);
    let fill;
    if (cols.length > 1) { fill = g.createLinearGradient(x, y, x + w, y + h); fill.addColorStop(0, rgba(cols[0], alpha)); fill.addColorStop(1, rgba(cols[1], alpha)); }
    else fill = rgba(cols[0], alpha);
    g.fillStyle = fill; g.fill();
  }

  drawBubble(g, l, x, top, p, fade, kick) {
    const duet = l.singers.length > 1, avR = 28, avX = x + avR + 4;
    const bx = x + (duet ? 100 : 70), by = top + (l.first ? 30 : 0), cols = l.singers.map((m) => this.col[m]);
    const pop = 1 + 0.03 * kick, slide = (1 - p) * 40;
    g.save(); g.globalAlpha *= fade * clamp(p * 1.6);
    if (l.first) { // name tag
      g.textAlign = 'left'; g.font = `800 17px ${FONT}`; g.fillStyle = rgba(mix(cols[0], PAPER, 0.15));
      g.fillText(l.singers.map((m) => NAME[m]).join(' + '), bx + 14 - slide * 0.3, top + 20);
    }
    const ay = by + l.bh - avR; // avatar(s), bottom aligned with the bubble
    for (let j = l.singers.length - 1; j >= 0; j--) this.drawAvatar(g, l.singers[j], avX + 30 * j - slide, ay, avR, 1, 0);
    g.save(); g.translate(bx - slide, by + l.bh); g.scale(pop, pop); g.translate(0, -l.bh); // kick pop around the bottom-left corner
    g.shadowColor = rgba(cols[0], 0.35); g.shadowBlur = 24; g.shadowOffsetY = 6;
    this.bubblePath(g, 0, 0, l.bw, l.bh, cols);
    g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
    g.textAlign = 'left'; g.fillStyle = TXT; g.font = `600 ${l.fs}px ${FONT}`;
    let ty = 20 + l.fs * 0.95;
    for (const s of l.wrap) { g.fillText(s, 30, ty); ty += l.fs * 1.25; }
    if (l.rwrap.length) {
      g.font = `500 ${l.fs2}px ${FONT}`; g.fillStyle = 'rgba(21,22,29,0.62)'; ty += 4;
      for (const s of l.rwrap) { g.fillText(s, 30, ty); ty += l.fs2 * 1.2; }
    }
    g.restore();
    g.restore();
  }

  // ---------------------------------------------------------------- right column
  drawNowPlaying(g, t, acc) {
    this.card(g, NP.x, NP.y, NP.w, NP.h, 36);
    const cx = NP.x + 24, cy = NP.y + 22, cs = 76; // cover tile with the six pastels
    rr(g, cx, cy, cs, cs, 20);
    const gr = g.createLinearGradient(cx, cy, cx + cs, cy + cs);
    ORDER.forEach((m, i) => gr.addColorStop(i / 5, rgba(this.col[m])));
    g.fillStyle = gr; g.fill();
    g.fillStyle = TXT; g.font = `800 44px ${FONT}`; g.textAlign = 'center'; g.fillText('D', cx + cs / 2, cy + cs / 2 + 16);
    g.textAlign = 'left';
    g.fillStyle = rgba(mix(acc, PAPER, 0.3)); g.font = `800 14px ${FONT}`; g.fillText('NOW PLAYING', NP.x + 118, NP.y + 36);
    g.fillStyle = rgba(PAPER); g.font = `800 28px ${FONT}`; g.fillText('DESERVE', NP.x + 118, NP.y + 68);
    g.fillStyle = 'rgba(242,242,247,0.55)'; g.font = `500 18px ${FONT}`; g.fillText('BABYMONSTER', NP.x + 118, NP.y + 92);
    for (let i = 0; i < 18; i++) { // beat-reactive bars
      const arr = i < 6 ? 'low' : i < 13 ? 'mid' : 'high', e = this.energy(t - i * 0.035, arr);
      const bh = 8 + clamp(e * 1.4) * 44 * (0.75 + 0.25 * Math.sin(i * 1.7 + t * 6));
      rr(g, NP.x + 392 + i * 9, NP.y + 56 - bh / 2, 5, bh, 2.5); g.fillStyle = rgba(mix(acc, PAPER, i / 30), 0.9); g.fill();
    }
    const px = NP.x + 118, pw = 400, py = NP.y + 106;
    rr(g, px, py, pw, 4, 2); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fill();
    rr(g, px, py, Math.max(4, pw * clamp(t / this.DUR)), 4, 2); g.fillStyle = rgba(acc); g.fill();
  }

  drawMv(g, t, acc, kick) {
    const { x, y, w, h } = MV;
    g.save();
    g.shadowColor = rgba(acc, 0.35 + 0.3 * kick); g.shadowBlur = 30; rr(g, x, y, w, h, 52); g.fillStyle = rgba(INK); g.fill(); g.shadowColor = 'transparent'; g.shadowBlur = 0;
    rr(g, x, y, w, h, 52); g.clip();
    if (this.video && this.video.readyState >= 2) {
      const vw = this.video.videoWidth, vh = this.video.videoHeight, s = Math.max(w / vw, h / vh) * (1.02 + 0.015 * kick);
      g.drawImage(this.video, x + (w - vw * s) / 2, y + (h - vh * s) / 2, vw * s, vh * s);
    } else { // fallback: beat-reactive scope card
      g.fillStyle = rgba(mix(INK, acc, 0.12)); g.fillRect(x, y, w, h);
      g.beginPath();
      for (let i = 0; i <= 64; i++) { const e = this.energy(t - i * 0.012, 'mid'), yy = y + h / 2 + Math.sin(i * 0.5 + t * 5) * e * 70; if (i) g.lineTo(x + (i / 64) * w, yy); else g.moveTo(x, yy); }
      g.strokeStyle = rgba(acc); g.lineWidth = 4; g.stroke();
    }
    g.restore();
    rr(g, x, y, w, h, 52); g.strokeStyle = rgba(acc, 0.55); g.lineWidth = 2.5; g.stroke();
  }

  firstOfRun(k) { let i = k; while (i > 0 && this.lines[i - 1].singers.join() === this.lines[k].singers.join()) i--; return i; }
  currentSpot(t) { // current vocalist set, the previous (different) set, and the crossfade progress
    let k = -1;
    for (let i = 0; i < this.lines.length; i++) if (this.lines[i].t - 0.2 <= t) k = i;
    if (k < 0) return null;
    const cur = this.lines[k].singers, r0 = this.firstOfRun(k);
    const prev = r0 > 0 ? this.lines[r0 - 1].singers : null;
    return { cur, prev, p: prev ? easeOut((t - (this.lines[r0].t - 0.2)) / 0.55) : 1 };
  }

  drawSpot(g, t, acc, kick) {
    const { x, y, w, h } = SP;
    this.card(g, x, y, w, h, 52, 'rgba(255,255,255,0.04)');
    const st = this.currentSpot(t);
    g.save(); rr(g, x, y, w, h, 52); g.clip();
    if (!st) { // before the first line: all six members as a 3x2 grid
      ORDER.forEach((m, i) => this.drawAvatar(g, m, x + 110 + (i % 3) * 170, y + 200 + Math.floor(i / 3) * 190, 70, 1, 0.5));
      g.textAlign = 'center'; g.fillStyle = 'rgba(242,242,247,0.6)'; g.font = `800 26px ${FONT}`; g.fillText('BABYMONSTER', x + w / 2, y + h - 90);
      g.font = `500 18px ${FONT}`; g.fillText('waiting for the first line…', x + w / 2, y + h - 56);
    } else {
      if (st.prev && st.p < 1) this.drawSpotSet(g, st.prev, x, y, w, h, 1 - st.p, -40 * st.p, 1 + 0.04 * st.p, t, kick, false);
      this.drawSpotSet(g, st.cur, x, y, w, h, st.p, 50 * (1 - st.p), 1 + 0.03 * (1 - st.p) + 0.012 * kick, t, kick, true);
    }
    g.restore();
    rr(g, x, y, w, h, 52); g.strokeStyle = rgba(acc, 0.35); g.lineWidth = 2; g.stroke();
  }

  drawSpotSet(g, set, x, y, w, h, alpha, dx, zoom, t, kick, label) {
    g.save(); g.globalAlpha *= clamp(alpha);
    const n = set.length, pw = w / n;
    set.forEach((m, i) => {
      g.save(); g.beginPath(); g.rect(x + i * pw, y, pw, h); g.clip();
      g.translate(x + i * pw + pw / 2 + dx, y + h / 2); g.scale(zoom, zoom);
      g.drawImage(this.sp[m], -w / 2, -h / 2, w, h);
      g.restore();
    });
    if (n > 1) { g.fillStyle = rgba(INK, 0.5); g.fillRect(x + w / 2 - 1.5, y, 3, h); }
    const sh = g.createLinearGradient(0, y + h - 260, 0, y + h);
    sh.addColorStop(0, 'rgba(14,15,20,0)'); sh.addColorStop(1, 'rgba(14,15,20,0.92)');
    g.fillStyle = sh; g.fillRect(x, y + h - 260, w, 260);
    const name = set.map((m) => NAME[m]).join(' + '), col = this.col[set[0]];
    g.textAlign = 'left';
    rr(g, x + 28, y + h - 156, 166, 36, 18); g.fillStyle = rgba(col, 0.2); g.fill(); // "vocal now" chip with equalizer
    g.fillStyle = rgba(col); g.font = `800 15px ${FONT}`; g.fillText('VOCAL NOW', x + 78, y + h - 132);
    for (let i = 0; i < 3; i++) { const e = 6 + (Math.sin(t * 9 + i * 1.7) * 0.5 + 0.5) * 12 + kick * 4; rr(g, x + 42 + i * 8, y + h - 138 - e / 2 + 6, 4, e, 2); g.fillStyle = rgba(col); g.fill(); }
    g.font = `800 ${set.length > 1 ? 46 : 68}px ${FONT}`; g.fillStyle = rgba(PAPER); g.fillText(name, x + 28, y + h - 52);
    g.fillStyle = rgba(col); rr(g, x + 28, y + h - 36, 110 + 30 * kick, 6, 3); g.fill();
    g.restore();
  }

  // ---------------------------------------------------------------- outro summary
  drawSummary(g, t) {
    const a = easeOut((t - 194.6) / 0.8), cw = 900, chh = 700, cx = (W - cw) / 2, cy = (H - chh) / 2;
    g.save();
    g.fillStyle = rgba(INK, 0.55 * a); g.fillRect(0, 0, W, H);
    g.globalAlpha = a; g.translate(W / 2, H / 2); const s = 0.94 + 0.06 * a; g.scale(s, s); g.translate(-W / 2, -H / 2);
    rr(g, cx, cy, cw, chh, 56); g.fillStyle = 'rgba(20,21,30,0.94)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 2; g.stroke();
    g.textAlign = 'center'; g.fillStyle = rgba(PAPER); g.font = `800 46px ${FONT}`; g.fillText('FINAL LINE DISTRIBUTION', W / 2, cy + 84);
    g.fillStyle = 'rgba(242,242,247,0.5)'; g.font = `500 21px ${FONT}`; g.fillText(`BABYMONSTER · DESERVE · ${fmtT(this.DUR)}`, W / 2, cy + 120);
    const rows = ORDER.slice().sort((p, q) => this.total[q] - this.total[p] || ORDER.indexOf(p) - ORDER.indexOf(q));
    const max = this.total[rows[0]], count = easeOut((t - 195.3) / 3.0);
    rows.forEach((m, i) => {
      const ry = cy + 160 + i * 84, col = this.col[m], tot = this.total[m] * count, pct = (tot / this.DUR) * 100;
      g.textAlign = 'left'; g.fillStyle = 'rgba(242,242,247,0.35)'; g.font = `800 26px ${FONT}`; g.fillText(`${i + 1}`, cx + 40, ry + 46);
      this.drawAvatar(g, m, cx + 120, ry + 36, 30, 1, i === 0 ? 0.9 : 0);
      g.fillStyle = rgba(PAPER); g.font = `800 25px ${FONT}`; g.fillText(NAME[m], cx + 170, ry + 32);
      rr(g, cx + 170, ry + 44, 420, 18, 9); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fill();
      const fw = clamp(this.total[m] / max) * 420 * count;
      if (fw > 1) { g.save(); g.shadowColor = rgba(col, 0.6); g.shadowBlur = 14; rr(g, cx + 170, ry + 44, Math.max(18, fw), 18, 9); g.fillStyle = rgba(col); g.fill(); g.restore(); }
      g.textAlign = 'right'; g.fillStyle = 'rgba(242,242,247,0.85)'; g.font = `600 23px ${FONT}`; g.fillText(`${tot.toFixed(1)}s`, cx + 720, ry + 52);
      g.fillStyle = rgba(mix(PAPER, col, 0.5)); g.font = `800 26px ${FONT}`; g.fillText(`${pct.toFixed(1)}%`, cx + cw - 40, ry + 52);
    });
    g.restore();
  }
}

function fmtT(s) { s = Math.max(0, s); return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; }
