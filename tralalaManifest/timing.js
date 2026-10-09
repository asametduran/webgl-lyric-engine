// Lyric timeline helpers. lyrics.json holds phrase blocks {t, end, text}; this module decorates them
// (highlight flags, indexes) and enforces a minimum on-screen time. Start times are never moved here.

export const HIGHLIGHT = /tra[\s-]*la[\s-]*la|mashallah|maşallah|dum[\s-]*da[\s-]*ra[\s-]*ra|satisfaction/i;
export const MIN_DISPLAY = 2.4;

export function decorate(lines) {
  const out = lines
    .filter((l) => l && l.text && Number.isFinite(l.t))
    .map((l) => ({ ...l }))
    .sort((a, b) => a.t - b.t);
  out.forEach((l, i) => {
    const next = out[i + 1];
    l.idx = i + 1;
    if (!Number.isFinite(l.end)) l.end = Math.min(l.t + 5, next ? next.t - 0.05 : l.t + 5);
    l.hero = l.hero ?? HIGHLIGHT.test(l.text);
  });
  return enforceMinDisplay(out);
}

export function enforceMinDisplay(lines, min = MIN_DISPLAY) {
  lines.forEach((l, i) => {
    const next = lines[i + 1];
    const want = Math.max(l.t + min, l.minEnd ?? 0);
    const room = next ? next.t - 0.05 : Infinity;
    l.end = Math.max(l.end, Math.min(want, room));
  });
  return lines;
}

// Fallback when lyrics.json is empty: show a quiet title card only.
export function buildTimeline() {
  return [{ t: 2, end: 6, text: 'manifest\nTRALALA', block: 'title' }];
}
