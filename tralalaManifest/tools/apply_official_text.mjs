// One-off: replaces the whisper text of each lyrics.json block with the official lyrics. t / end / offset are NEVER touched.
// Row breaks (\n) are chosen for readable 1-3 row blocks; ad-libs are kept in parentheses.
import { readFile, writeFile } from 'node:fs/promises';

const T = [
  /* 0   1.1 */ "Can't get your eyes off my,\num, tra-la-la",
  /* 1   4.9 */ "Look like an angel,\nGod bless, mashallah, mm-mm",
  /* 2   8.5 */ "Move to the beat,\nit goes dum-da-ra-ra",
  /* 3  12.6 */ "Can't get your eyes off my\nCan't get your eyes off my",
  /* 4  15.5 */ "Didn't mean to ask for\nattention when I came by",
  /* 5  19.2 */ "In the same location\non the same night",
  /* 6  21.1 */ "Build up that tension, oh,\nday by day, oh",
  /* 7  24.1 */ "I know, you want\nwhat you can't get",
  /* 8  25.8 */ "That's the law of attraction\nYou're not getting that satisfaction",
  /* 9  28.1 */ "I'll be driving you crazy, oh, play by play, oh\nYou can't help but notice me (Uh)",
  /* 10 35.5 */ "I can't help but notice you\n(You; Da-da-da-da-da)",
  /* 11 39.4 */ "You can't look away from me\n(Mm, ayy)",
  /* 12 43.4 */ "Feel your eyes all over you",
  /* 13 46.6 */ "Can't get your eyes off my,\num, tra-la-la",
  /* 14 50.8 */ "Look like an angel,\nGod bless, mashallah, mm-mm",
  /* 15 54.5 */ "Move to the beat,\nit goes dum-da-ra-ra",
  /* 16 58.7 */ "Can't get your eyes off my",
  /* 17 60.2 */ "Can't get your eyes off my\n(Can't get your eyes off my)",
  /* 18 62.7 */ "I do it on purpose\nNow you look a little bit nervous (Yeah)",
  /* 19 65.2 */ "You're watching every movement",
  /* 20 68.0 */ "To the right, to the left,\nto the right,",
  /* 21 69.8 */ "to the right, right",
  /* 22 70.4 */ "You're tryna calm your lady down\nI'm messing with you on the daily now",
  /* 23 72.8 */ "All it takes is one look",
  /* 24 75.8 */ "Start a fight with your girl\neverytime I'm around, 'round",
  /* 25 77.9 */ "You can't help but notice me\n(Mm, uh)",
  /* 26 82.0 */ "I can't help but notice you\n(Da-da-da-da)",
  /* 27 86.0 */ "Building up that fantasy (Uh)",
  /* 28 89.5 */ "Feel your eyes all over you",
  /* 29 93.2 */ "Can't get your eyes off my, um, tra-la-la\nLook like an angel,",
  /* 30 98.2 */ "God bless, mashallah, mm-mm",
  /* 31 100.9 */ "Move to the beat,\nit goes dum-da-ra-ra",
  /* 32 104.7 */ "Can't get your eyes off my\nCan't get your eyes off my\n(Can't get your eyes off my, tra-la-la)",
  /* 33 110.5 */ "My friends know your friends",
  /* 34 112.2 */ "And we got a lot of intel\non the weekends",
  /* 35 114.0 */ "Where you going out?\nI'm dressed up and I'll be there",
  /* 36 116.0 */ "Whoops, it must be a coincidence",
  /* 37 117.8 */ "And then your friends see my friends",
  /* 38 119.8 */ "Now we're pulling up,\nsame club, same wristband",
  /* 39 121.7 */ "It's so obvious that you wanted this",
  /* 40 123.9 */ "And I love messing with your confidence",
  /* 41 126.1 */ "You can't help but notice me\n(Mm, uh)",
  /* 42 129.8 */ "I can't help but notice you\n(Da-da-da-da)",
  /* 43 133.7 */ "You can't look away from me\n(Uh)",
  /* 44 137.6 */ "Feel your eyes all over you",
  /* 45 141.2 */ "Can't get your eyes off my, um, tra-la-la\nLook like an angel,",
  /* 46 146.2 */ "God bless, mashallah, mm-mm",
  /* 47 148.7 */ "Move to the beat, it goes dum-da-ra-ra\n(La-la-la-la-la-la-la)",
  /* 48 151.2 */ "Can't get your eyes off my\nCan't get your eyes off my (Ooh)",
  /* 49 156.1 */ "Can't get your eyes off my,\num, tra-la-la",
  /* 50 158.7 */ "Look like an angel,",
  /* 51 161.5 */ "God bless, mashallah (Uh)",
  /* 52 164.2 */ "Move to the beat,\nit goes dum-da-ra-ra",
  /* 53 166.6 */ "Can't get your eyes off my\nCan't get your eyes off my (You)",
  /* 54 172.0 */ "Can't get your eyes off my,\num, tra-la-la (Uh)",
  /* 55 174.2 */ "Look like an angel,\nGod bless, mashallah, mm-mm",
  /* 56 179.2 */ "Move to the beat,\nit goes dum-da-ra-ra",
  /* 57 181.8 */ "Can't get your eyes off my",
  /* 58 185.0 */ "Can't get your eyes off my,\ntra-la-la",
];

const j = JSON.parse(await readFile('lyrics.json', 'utf8'));
if (j.lines.length !== T.length) throw new Error(`block count ${j.lines.length} != ${T.length}`);
j.lines.forEach((l, i) => { l.text = T[i]; });
j.curated = true; // tools/make_lyrics.mjs refuses to overwrite a curated file
j._note = 'Official lyrics text (curated) on whisper-derived timings. Do not retime: t/end are final; use , . / in the browser for a global offset.';
j.source = 'timings: faster-whisper word timestamps; text: official lyrics';
await writeFile('lyrics.json', JSON.stringify(j, null, 1), 'utf8');
console.log('ok', T.length);
