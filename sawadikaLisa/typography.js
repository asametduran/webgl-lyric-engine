// Calm, readable phrase typography (2D canvas -> texture). One block of 1-3 lines is on stage at a time:
// it fades/scales/rises in smoothly, holds still, then dissolves. Keywords are tinted temple-gold.
// Beats only add a soft glow; drops add a short, gentle gold glow plus a hairline colour ghost. No shaking.
// Pure function of (t, features): deterministic, no Math.random.

import { KEYWORDS } from './timing.js';

export const TW = 1920;
export const TH = 1080;
const FONT = "'Montserrat','Segoe UI Variable Display','Segoe UI','Helvetica Neue',Arial,sans-serif";
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x) => x * x * (3 - 2 * x);

export class Typography {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = TW; this.canvas.height = TH;
    this.c = this.canvas.getContext('2d');
    this.cache = new Map();
    this.activeText = '';
    this.impact = 0; // kept for API compatibility (no camera shake any more)
  }

  layout(line) {
    let L = this.cache.get(line.idx);
    if (L) return L;
    const c = this.c;
    const rows = line.text.split('\n').map((r) => r.trim()).filter(Boolean);
    const n = rows.length;
    let size = n === 1 ? 118 : n === 2 ? 104 : 90;
    const maxW = 1560;
    const measure = (s) => rows.map((r) => { c.font = `800 ${s}px ${FONT}`; return c.measureText(r).width; });
    let widths = measure(size);
    const fit = Math.min(1, maxW / Math.max(...widths));
    size = Math.round(size * fit);
    c.font = `800 ${size}px ${FONT}`;
    const gap = size * 0.26;
    const lh = size * 1.18;
    const total = lh * n;
    L = {
      size, lh, rows: rows.map((r, i) => {
        const words = r.split(/\s+/);
        const spaceW = c.measureText(' ').width;
        const ws = words.map((w) => c.measureText(w).width);
        const wTotal = ws.reduce((a, b) => a + b, 0) + spaceW * (words.length - 1);
        let x = -wTotal / 2;
        return {
          y: -total / 2 + lh * i + lh / 2,
          words: words.map((w, k) => {
            const item = { w, x: x + ws[k] / 2, gold: KEYWORDS.has(w.replace(/[^A-Za-z]/g, '').toUpperCase()) };
            x += ws[k] + spaceW;
            return item;
          }),
        };
      }), gap,
    };
    this.cache.set(line.idx, L);
    return L;
  }

  draw(t, lines, f) {
    const c = this.c;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, TW, TH);
    this.activeText = '';
    for (const line of lines) {
      if (t < line.t || t >= line.end + 0.05) continue;
      this.activeText = line.text.replace(/\n/g, ' / ');
      this.drawBlock(c, line, t, f);
    }
    this.drawCredit(c, t, f);
    return this.canvas;
  }

  drawBlock(c, line, t, f) {
    const L = this.layout(line);
    const outDur = 0.7;
    const q = easeInOut(clamp((t - (line.end - outDur)) / outDur));
    c.save();
    c.translate(TW / 2, TH / 2 + 10);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `800 ${L.size}px ${FONT}`;
    const glowBeat = 10 * f.kick;       // soft pulse on the beat
    const glowDrop = 38 * f.drop;       // gentle bloom on the big hits
    L.rows.forEach((row, ri) => {
      const u = clamp((t - line.t - ri * 0.18) / 0.85);
      const e = easeOutCubic(u);
      const alpha = e * (1 - q);
      if (alpha <= 0.002) return;
      const sc = (0.94 + 0.06 * e) * (1 + 0.025 * q) * (1 + 0.012 * f.kick);
      const dy = 26 * (1 - e) - 10 * q;
      c.save();
      c.translate(0, row.y + dy);
      c.scale(sc, sc);
      c.globalAlpha = alpha;
      for (const w of row.words) {
        const gold = w.gold;
        const fill = gold ? '#f0cf6e' : '#f4fffb';
        // 1) dark soft backing for contrast against the city
        c.shadowColor = 'rgba(0,10,8,0.75)'; c.shadowBlur = 26; c.shadowOffsetY = 6;
        c.fillStyle = 'rgba(0,10,8,0.9)';
        c.fillText(w.w, w.x, 0);
        // 2) hairline colour ghost, only right after a drop
        if (f.drop > 0.55) {
          const o = 3 * f.drop;
          c.shadowBlur = 0; c.shadowOffsetY = 0; c.globalAlpha = alpha * 0.28 * f.drop;
          c.fillStyle = '#ff4466'; c.fillText(w.w, w.x - o, 0);
          c.fillStyle = '#33e6ff'; c.fillText(w.w, w.x + o, 0);
          c.globalAlpha = alpha;
        }
        // 3) the readable face with a soft neon glow
        c.shadowColor = gold || f.drop > 0.3 ? 'rgba(212,175,55,0.8)' : 'rgba(25,230,211,0.55)';
        c.shadowBlur = 14 + glowBeat + glowDrop; c.shadowOffsetY = 0;
        c.fillStyle = fill;
        c.fillText(w.w, w.x, 0);
      }
      c.restore();
    });
    c.restore();
  }

  drawCredit(c, t, f) {
    const a = Math.min(clamp(t / 1.5), 1 - clamp((t - 6) / 1.5));
    const b = clamp((t - (f.duration - 9)) / 1.5);
    const al = Math.max(a, b);
    if (al <= 0) return;
    c.save();
    c.globalAlpha = al * 0.7;
    c.font = `600 22px ${FONT}`;
    c.textAlign = 'left'; c.fillStyle = '#D4AF37';
    c.fillText('LISA - SaWaDiKa  //  fan-made lyric visualizer, not affiliated', 48, TH - 44);
    c.restore();
  }
}
