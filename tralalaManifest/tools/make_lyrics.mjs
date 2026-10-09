// words.json (word-level timings from tools/transcribe.py) -> lyrics.json (vocal phrase blocks, >= ~2.4s on screen).
// Usage: node tools/make_lyrics.mjs
import { readFile, writeFile } from 'node:fs/promises';

// lyrics.json carries curated official text on final timings: never overwrite it by accident
try {
  if (JSON.parse(await readFile('lyrics.json', 'utf8')).curated && !process.argv.includes('--force')) {
    console.error('lyrics.json is curated (official text, final timings). Pass --force to overwrite.'); process.exit(1);
  }
} catch { /* no lyrics.json yet */ }

const { words: raw } = JSON.parse(await readFile('words.json', 'utf8'));
const GAP = 0.6;         // silence that always ends a phrase
const MAX_DUR = 5.5;     // longest phrase
const MAX_WORDS = 10;
const MIN_DUR = 2.4;     // shorter phrases are merged into their neighbour

// 1) drop whisper hallucinations (instrumental passages) and fix sloppy renderings of the hook syllables
let text = raw.map((w) => w.w).join(' ');
const dead = new Set();
for (const m of text.matchAll(/thanks for watching!?|altyaz\S* m\.?k\.?|subtitles? by \S+/gi)) {
  const from = text.slice(0, m.index).split(' ').length - 1;
  for (let i = from; i < from + m[0].split(' ').length; i++) dead.add(i);
}
const FIX = [[/oompa[-\s]?la[-\s]?la[-\s]?la|jalala|ultra\s?lala/i, 'tra-la-la'], [/^dum-da-da-da$/i, 'dum-da-ra-ra']];
const words = [];
raw.forEach((w, i) => {
  if (dead.has(i) || !/[\p{L}\p{N}]/u.test(w.w)) return;
  // tokens like "-da" belong to the previous word ("da-da-da")
  const prev = words[words.length - 1];
  if (w.w.startsWith('-') && prev && w.s - prev.e < 0.4) { prev.w += w.w; prev.e = w.e; return; }
  words.push({ ...w, endsSentence: /[.!?]$/.test(w.w) });
});
words.forEach((w) => { w.w = FIX.reduce((a, [re, to]) => a.replace(re, to), w.w).replace(/[.!?]+$/, ''); });

// 2) phrases: break on silence, sentence ends, new capitalised sentence starts mid-segment, or length limits
const startsSentence = (w) => /^[A-Z]/.test(w.w) && !/^I(['’].*)?$/.test(w.w);
const phrases = [];
let cur = [];
for (const w of words) {
  const last = cur[cur.length - 1];
  if (last && (w.s - last.e > GAP || last.endsSentence || (startsSentence(w) && cur.length >= 3) || w.e - cur[0].s > MAX_DUR || cur.length >= MAX_WORDS)) { phrases.push(cur); cur = []; }
  cur.push(w);
}
if (cur.length) phrases.push(cur);

// 3) merge too-short phrases with the next one while the block stays readable (max 2 rows)
const span = (p) => p[p.length - 1].e - p[0].s;
for (let i = 0; i < phrases.length - 1; i++) {
  const p = phrases[i], n = phrases[i + 1];
  if (span(p) < MIN_DUR && p.length + n.length <= 12 && n[0].s - p[p.length - 1].e < 1.0 && span([...p, ...n]) < 7) {
    phrases.splice(i, 2, [...p, ...n]); i--;
  }
}

const rowsOf = (ws) => {
  const t = ws.map((w) => w.w);
  const joined = t.join(' ');
  if (joined.length <= 24 || t.length < 4) return joined;
  const mid = Math.ceil(t.length / 2);
  return `${t.slice(0, mid).join(' ')}\n${t.slice(mid).join(' ')}`;
};

const lines = phrases.map((p, i) => ({
  t: +p[0].s.toFixed(3),
  end: +(p[p.length - 1].e + 0.45).toFixed(3),
  text: rowsOf(p),
  block: `p${i + 1}`,
}));
await writeFile('lyrics.json', JSON.stringify({
  _note: 'Phrase blocks from audio analysis (faster-whisper word timings). Edit text freely; tune timing with , . / in the browser (offset below is added to every t/end).',
  offset: 0, source: 'faster-whisper word timestamps', lines,
}, null, 1), 'utf8');
console.log(`${lines.length} blocks -> lyrics.json`);
