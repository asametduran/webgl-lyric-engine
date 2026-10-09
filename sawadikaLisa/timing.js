// Deterministic lyric timing on the bar grid detected by analyzer.js (bar 0 = 1.47 s, 2.57 s per bar).
// Vocals enter immediately (~2.1 s): two hook passes fill the pre-drop bars 0-11, then the bass drop at 0:32 carries verse 1,
// bars 22-30 "how many", 31-32 melodic couplet, hook x2 on the 1:26 drop, verse 2, couplet, hook x2 on the 2:35 drop, outro.
// Inside a block each line gets time proportional to its syllable count, snapped to half-beats.

const HOOK = [
  'Hello Sawadika',
  'Yeah, you know my wrist is cold',
  'Got this time piece from Geneva',
  'If you know it, then you know',
  "I'm that bitch on your TV and my Ferrari indigo",
  'La la Lisa la diva, Sawadika, there she go',
];
const VERSE1 = [
  'Who let this bitch out of the cage?',
  'Move that, get out of the way',
  "Murder, killed that, I'm on the case",
  'Hands up, now lock me away',
  'Championship, they call me the one',
  "Whip my shit like it's a salon",
  'I throw fits like highlight clips',
  'I aim, I hit, blow smoke off the gun',
];
const HOWMANY = [
  'How many does it take?',
  'How many does it take?',
  'How many-',
  'How many tryna ride my wave?',
  'How many want my name?',
  'How many-',
  'How many got discipline?',
  'How many comprehend?',
  'How many that been where I been?',
  'How many get me from within?',
];
const CATCH = [
  'Catch me in my feelings up in the sky',
  "Baby, there's no ceiling in my mind",
];
const VERSE2 = [
  'Bang, bang, Bangkok bang',
  "Screaming 'geng mak' with my gang",
  "Baht be going in my bank till I'm going out with a bag",
  "Thai'd up like I'm booked, booked",
  "I'm like hold up, let me cook, cook",
  'Put a show on when I show up doing donuts in a tuktuk',
  'Step on the terrace, the rooftop',
  'Hop in the back of the chop, chop',
  'Like are you coming or what?',
  "I'm like the tick on your clock, waking 'em up",
  "Yes, I'm a trouble fanatic",
  "Live for the shock like I'm anaphylactic",
  'Is it too much? Am I overdramatic?',
  "Sick I'm too sick, better call me a medic",
];
const OUTRO = [
  'Hello Sawadika',
  'Hello Sawadika',
  'Hello Sawadika',
  'Hello Sawadika, there she go',
];

const BLOCKS = [
  { name: 'hook', fromTime: 2.116, to: 6, lines: HOOK },      // vocals enter on beat 3 (~0:02)
  { name: 'hook', from: 6, to: 12, lines: HOOK },
  { name: 'verse1', from: 12, to: 22, lines: VERSE1 },        // bass drop at 0:32
  { name: 'howmany', from: 22, to: 31, lines: HOWMANY },
  { name: 'catch', from: 31, to: 33, lines: CATCH },
  { name: 'hook', from: 33, to: 41, lines: HOOK },            // drop 2 at 1:26
  { name: 'hook', from: 41, to: 49, lines: HOOK },
  { name: 'verse2', from: 49, to: 58, lines: VERSE2 },
  { name: 'catch', from: 58, to: 60, lines: CATCH },
  { name: 'hook', from: 60, to: 65, lines: HOOK },            // drop 3 at 2:35
  { name: 'hook', from: 65, to: 70, lines: HOOK },
  { name: 'outro', from: 70, toTime: 187.6, lines: OUTRO },
];

const syllables = (w) => Math.max(1, (w.toLowerCase().match(/[aeiouy]+/g) || []).length);
const weight = (line) => line.split(/\s+/).reduce((s, w) => s + syllables(w), 0) + 1.5;

export function buildTimeline(an) {
  const bar = (j) => an.firstBar + j * an.barDur;
  const half = an.beatDur / 2;
  const snap = (t) => an.offset + Math.round((t - an.offset) / half) * half;
  const out = [];
  for (const b of BLOCKS) {
    const t0 = b.fromTime ?? bar(b.from), t1 = b.toTime ?? bar(b.to);
    const ws = b.lines.map(weight), tot = ws.reduce((a, c) => a + c, 0);
    let acc = 0;
    b.lines.forEach((text, i) => {
      let t = i === 0 ? t0 : snap(t0 + ((t1 - t0) * acc) / tot);
      const prev = out[out.length - 1];
      if (prev && t <= prev.t + half * 0.99) t = prev.t + half;
      acc += ws[i];
      out.push({ t: +t.toFixed(3), text, block: b.name, last: i === b.lines.length - 1, blockEnd: t1 });
    });
  }
  out.forEach((l, i) => {
    const next = out[i + 1];
    const stop = l.last ? l.blockEnd - 0.08 : next.t - 0.05;
    l.end = +Math.min(stop, l.t + 7).toFixed(3);
    delete l.last; delete l.blockEnd;
  });
  return out;
}

const HERO = /^hello sawadika(,? there she go)?$|ferrari|donuts/i;
export const KEYWORDS = new Set(['SAWADIKA', 'FERRARI', 'INDIGO', 'DONUTS', 'TUKTUK', 'BANGKOK', 'GENEVA', 'LISA', 'DIVA', 'HELLO']);

// Adds flags (hero lines) and indexes; there is no intro card, the first lyric starts the show.
export function decorate(lines, an) {
  const out = lines
    .filter((l) => l && l.text && Number.isFinite(l.t))
    .map((l) => ({ ...l }))
    .sort((a, b) => a.t - b.t);
  out.forEach((l, i) => {
    const next = out[i + 1];
    l.idx = i + 1;
    if (!Number.isFinite(l.end)) l.end = Math.min(l.t + 6, next ? next.t - 0.05 : l.t + 6);
    l.hero = l.hero ?? HERO.test(l.text.trim());
  });
  return enforceMinDisplay(out);
}

// Minimum on-screen time: a line stays at least MIN_DISPLAY seconds (or until its optional `minEnd`),
// as far as the next line's start allows. Start times are never moved here (lyrics.json already carries the pushes).
export const MIN_DISPLAY = 2.4;
export function enforceMinDisplay(lines, min = MIN_DISPLAY) {
  lines.forEach((l, i) => {
    const next = lines[i + 1];
    const want = Math.max(l.t + min, l.minEnd ?? 0);
    const room = next ? next.t - 0.05 : Infinity;
    l.end = Math.max(l.end, Math.min(want, room));
  });
  return lines;
}
