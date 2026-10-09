// Offline audio analysis: band energies, onset flux, tempo/beat grid, downbeat, drops, sections.
// Everything the visuals react to is derived from audio.mp3 itself.

const N = 1024;
const HOP = 512;

function makeFFT(n) {
  const levels = Math.log2(n);
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < levels; b++) if (i & (1 << b)) r |= 1 << (levels - 1 - b);
    rev[i] = r;
  }
  const cos = new Float32Array(n / 2);
  const sin = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n);
    sin[i] = Math.sin((2 * Math.PI * i) / n);
  }
  return (re, im) => {
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1;
      const step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = i, k = 0; j < i + half; j++, k += step) {
          const l = j + half;
          const tr = re[l] * cos[k] + im[l] * sin[k];
          const ti = -re[l] * sin[k] + im[l] * cos[k];
          re[l] = re[j] - tr; im[l] = im[j] - ti;
          re[j] += tr; im[j] += ti;
        }
      }
    }
  };
}

function normalize(arr, pct = 0.97) {
  const sorted = Float32Array.from(arr).sort();
  const ref = sorted[Math.floor(sorted.length * pct)] || 1;
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = Math.min(1, arr[i] / ref);
  return out;
}

const mean = (a, from, to) => {
  from = Math.max(0, Math.round(from)); to = Math.min(a.length, Math.round(to));
  let s = 0;
  for (let i = from; i < to; i++) s += a[i];
  return to > from ? s / (to - from) : 0;
};

export const fmt = (s) => {
  s = Math.max(0, s);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

export async function analyze(buf, onProgress = () => {}) {
  const sr = buf.sampleRate;
  const fps = sr / HOP;
  const a = buf.getChannelData(0);
  const b = buf.numberOfChannels > 1 ? buf.getChannelData(1) : a;
  const nF = Math.floor((a.length - N) / HOP) + 1;
  const fft = makeFFT(N);
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  const binHz = sr / N;
  const kLow = Math.max(2, Math.round(150 / binHz));
  const kMid = Math.round(2000 / binHz);
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  const prev = new Float32Array(N / 2);

  const lowE = new Float32Array(nF), midE = new Float32Array(nF), highE = new Float32Array(nF);
  const lowF = new Float32Array(nF), midF = new Float32Array(nF), highF = new Float32Array(nF);

  for (let f = 0; f < nF; f++) {
    const o = f * HOP;
    for (let i = 0; i < N; i++) { re[i] = (a[o + i] + b[o + i]) * 0.5 * win[i]; im[i] = 0; }
    fft(re, im);
    let eL = 0, eM = 0, eH = 0, fL = 0, fM = 0, fH = 0;
    for (let k = 1; k < N / 2; k++) {
      const m = Math.hypot(re[k], im[k]);
      const lm = Math.log1p(m);
      const d = lm - prev[k];
      prev[k] = lm;
      const pos = d > 0 ? d : 0;
      if (k < kLow) { eL += m * m; fL += pos; }
      else if (k < kMid) { eM += m * m; fM += pos; }
      else { eH += m * m; fH += pos; }
    }
    lowE[f] = Math.sqrt(eL); midE[f] = Math.sqrt(eM); highE[f] = Math.sqrt(eH);
    lowF[f] = fL; midF[f] = fM; highF[f] = fH;
    if (f % 600 === 0) { onProgress(f / nF); await new Promise((r) => setTimeout(r)); }
  }
  onProgress(1);

  const low = normalize(lowE), mid = normalize(midE), high = normalize(highE);
  const kick = normalize(lowF), snare = normalize(midF), hat = normalize(highF);
  const onset = new Float32Array(nF);
  for (let i = 0; i < nF; i++) onset[i] = kick[i] * 0.55 + snare[i] * 0.35 + hat[i] * 0.1;

  // ---- tempo: autocorrelation of detrended onset envelope, then joint period/phase refinement
  const det = new Float32Array(nF);
  const w = Math.round(fps * 0.5);
  for (let i = 0; i < nF; i++) det[i] = Math.max(0, onset[i] - mean(onset, i - w, i + w));
  let bestL = 0, bestAC = -1;
  const lMin = Math.floor((fps * 60) / 190), lMax = Math.ceil((fps * 60) / 60);
  for (let L = lMin; L <= lMax; L++) {
    let s = 0;
    for (let i = 0; i + L < nF; i++) s += det[i] * det[i + L];
    s /= nF - L;
    const bpm = (60 * fps) / L;
    const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 115) / 0.75, 2));
    if (s * prior > bestAC) { bestAC = s * prior; bestL = L; }
  }
  let bestScore = -1, period = bestL, phase = 0, scoreSum = 0, scoreN = 0;
  for (let p = bestL * 0.97; p <= bestL * 1.03; p += bestL * 0.0005) {
    for (let ph = 0; ph < p; ph += 0.5) {
      let s = 0;
      for (let x = ph; x < nF - 1; x += p) s += det[Math.round(x)];
      scoreSum += s; scoreN++;
      if (s > bestScore) { bestScore = s; period = p; phase = ph; }
    }
  }
  const confidence = bestScore / (scoreSum / scoreN);
  const beatDur = period / fps;
  const offset = phase / fps;
  const bpm = 60 / beatDur;

  // ---- downbeat: which of 4 beat slots carries the most kick energy
  const slot = [0, 0, 0, 0];
  const beats = Math.floor((nF / fps - offset) / beatDur);
  for (let i = 0; i < beats; i++) {
    const c = Math.round((offset + i * beatDur) * fps);
    let m = 0;
    for (let j = c - 2; j <= c + 2; j++) m = Math.max(m, kick[j] || 0);
    slot[i % 4] += m;
  }
  const barPhase = slot.indexOf(Math.max(...slot));

  // ---- bars, drops, sections
  const barDur = beatDur * 4;
  const firstBar = offset + barPhase * beatDur;
  const nBars = Math.floor((nF / fps - firstBar) / barDur);
  const barLow = [], barAll = [];
  for (let j = 0; j < nBars; j++) {
    const f0 = (firstBar + j * barDur) * fps, f1 = (firstBar + (j + 1) * barDur) * fps;
    barLow.push(mean(low, f0, f1) + 0.5 * mean(mid, f0, f1));
    barAll.push((mean(low, f0, f1) + mean(mid, f0, f1) + mean(high, f0, f1)) / 3);
  }
  const drops = [];
  let lastDropBar = -99;
  for (let j = 4; j < nBars - 1; j++) {
    const before = mean(barLow, j - 4, j), after = mean(barLow, j, j + 2);
    const jump = after - before;
    if (after > 0.45 && after > before * 1.45 && jump > 0.18 && j - lastDropBar >= 8) {
      let bj = j, bv = jump;
      for (let q = j; q < j + 3 && q < nBars - 1; q++) {
        const v = mean(barLow, q, q + 2) - mean(barLow, q - 4, q);
        if (v > bv) { bv = v; bj = q; }
      }
      drops.push(firstBar + bj * barDur);
      lastDropBar = bj;
      j = bj;
    }
  }

  const bounds = [0];
  let lastB = -99;
  for (let j = 4; j < nBars - 4; j++) {
    const d = Math.abs(mean(barAll, j, j + 4) - mean(barAll, j - 4, j));
    const dl = Math.abs(mean(barAll, j + 1, j + 5) - mean(barAll, j - 3, j + 1));
    const dr = Math.abs(mean(barAll, j - 1, j + 3) - mean(barAll, j - 5, j - 1));
    if (d > 0.07 && d >= dl && d >= dr && j - lastB >= 8) {
      bounds.push(firstBar + j * barDur);
      lastB = j;
    }
  }
  const duration = buf.duration;
  const median = [...barAll].sort((x, y) => x - y)[Math.floor(barAll.length / 2)] || 0.5;
  const sections = bounds.map((start, i) => {
    const end = i + 1 < bounds.length ? bounds[i + 1] : duration;
    const e = mean(barAll, (start - firstBar) / barDur, (end - firstBar) / barDur);
    return { start, end, energy: e, level: e > median * 1.12 ? 'high' : e < median * 0.88 ? 'low' : 'mid' };
  });

  return {
    fps, duration, bpm, beatDur, offset, barPhase, barDur, firstBar, confidence,
    low, mid, high, kick, snare, hat, onset, drops, sections, barAll,
  };
}

export function reportText(an) {
  return [
    `BPM: ${an.bpm.toFixed(1)} (beat ${an.beatDur.toFixed(3)}s, grid offset ${an.offset.toFixed(3)}s, confidence x${an.confidence.toFixed(1)})`,
    `Duration: ${fmt(an.duration)}`,
    `Drops: ${an.drops.length ? an.drops.map((d) => fmt(d)).join(', ') : 'none detected'}`,
    'Sections:',
    ...an.sections.map((s, i) => `  ${i + 1}. ${fmt(s.start)}-${fmt(s.end)}  ${s.level} energy`),
  ].join('\n');
}

export function chaptersMarkdown(an) {
  return an.sections.map((s, i) => {
    const dropHere = an.drops.some((d) => d >= s.start - 1 && d < s.end);
    const name = i === 0 ? 'Intro' : dropHere ? `Drop / Section ${i + 1}` : `Section ${i + 1} (${s.level} energy)`;
    return `${fmt(s.start)} ${name}`;
  }).join('\n');
}
