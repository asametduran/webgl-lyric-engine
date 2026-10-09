// Calm kinetic typography (2D canvas -> texture). One phrase block of 1-3 rows on stage at a time:
// fades/scales in, holds still, dissolves. Highlight words (tra-la-la, mashallah, dum-da-ra-ra) get a soft
// neon-fuchsia glow (the rest get a faint cyan one). No shaking, no flashes. Pure function of (t, features).

import { HIGHLIGHT } from './timing.js';

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
  }

  layout(line) {
    let L = this.cache.get(line.idx);
    if (L) return L;
    const c = this.c;
    const rows = line.text.split('\n').map((r) => r.trim()).filter(Boolean);
    const n = rows.length;
    let size = n === 1 ? 92 : n === 2 ? 78 : 66;
    c.font = `700 ${size}px ${FONT}`;
    const widest = Math.max(...rows.map((r) => c.measureText(r).width));
    size = Math.round(size * Math.min(1, 1640 / widest));
    c.font = `700 ${size}px ${FONT}`;
    const lh = size * 1.2, total = lh * n, spaceW = c.measureText(' ').width;
    L = {
      size,
      rows: rows.map((r, i) => {
        const words = r.split(/\s+/);
        const ws = words.map((w) => c.measureText(w).width);
        const wTotal = ws.reduce((a, b) => a + b, 0) + spaceW * (words.length - 1);
        let x = -wTotal / 2;
        return {
          y: -total / 2 + lh * i + lh / 2,
          adlib: r.startsWith('('), // (ad-libs) are kept, just a little softer
          words: words.map((w, k) => {
            const item = { w, x: x + ws[k] / 2, k, hot: HIGHLIGHT.test(w) };
            x += ws[k] + spaceW;
            return item;
          }),
        };
      }),
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
  }

  drawBlock(c, line, t, f) {
    const L = this.layout(line);
    const outDur = 0.7;
    const q = easeInOut(clamp((t - (line.end - outDur)) / outDur));
    c.save();
    c.translate(TW / 2, TH * 0.8);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `700 ${L.size}px ${FONT}`;
    L.rows.forEach((row, ri) => {
      const u = clamp((t - line.t - ri * 0.18) / 0.85);
      const e = easeOutCubic(u);
      const alpha = e * (1 - q) * (row.adlib ? 0.72 : 1);
      if (alpha <= 0.002) return;
      const sc = (0.94 + 0.06 * e) * (1 + 0.03 * q) * (1 + 0.008 * f.beatPulse);
      const dy = 26 * (1 - e) - 10 * q;
      c.save();
      c.translate(0, row.y + dy);
      c.scale(sc, sc);
      c.globalAlpha = alpha;
      for (const w of row.words) {
        // 1) soft dark backing for contrast
        c.shadowColor = 'rgba(8,0,18,0.75)'; c.shadowBlur = 26; c.shadowOffsetY = 6;
        c.fillStyle = 'rgba(8,0,18,0.9)';
        c.fillText(w.w, w.x, 0);
        c.shadowOffsetY = 0;
        if (w.hot) {
          // 2a) highlight words: wide neon-fuchsia halo that breathes with the beat, then a bright fuchsia face
          c.shadowColor = 'rgba(255,90,0,0.95)'; c.shadowBlur = 46 + 18 * f.beatPulse;
          c.fillStyle = '#ff7a1a';
          c.fillText(w.w, w.x, 0);
          c.shadowColor = 'rgba(255,200,120,0.9)'; c.shadowBlur = 14;
          c.fillStyle = '#ffc266';
          c.fillText(w.w, w.x, 0);
        } else {
          // 2b) plain words: white face with a faint electric-cyan glow
          c.shadowColor = 'rgba(79,227,255,0.45)'; c.shadowBlur = 12 + 6 * f.beatPulse;
          c.fillStyle = '#f7fbff';
          c.fillText(w.w, w.x, 0);
        }
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
    c.font = `700 22px ${FONT}`;
    c.textAlign = 'left'; c.fillStyle = '#ffd2a8';
    c.fillText('True Damage - Know My Name  //  fan-made lyrics video, not affiliated', 48, TH - 44);
    c.restore();
  }
}
