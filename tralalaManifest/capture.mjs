// Lossless frame-by-frame capture: Playwright renders every frame via ?capture (PNG), FFmpeg encodes 1080p MP4 + audio.mp3.
// Usage: node capture.mjs [--fps 30] [--out tralala-code-mv.mp4] [--nudge 0] [--start 0] [--end <sec>] [--q 1] [--crf 14] [--port 8123]
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : d; };
const FPS = Number(arg('fps', 30)), OUT = arg('out', 'tralala-code-mv.mp4'), NUDGE = arg('nudge', '0');
const START = Number(arg('start', 0)), Q = arg('q', '1'), CRF = arg('crf', '14'), PORT = Number(arg('port', 8123));
const W = 1920, H = 1080;

const server = await startServer(PORT);
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('page error:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/?capture&q=${Q}&nudge=${NUDGE}`);
await page.waitForFunction(() => window.__capture, null, { timeout: 180000 });
const duration = await page.evaluate(() => window.__capture.duration);
const END = Math.min(Number(arg('end', duration)), duration);
const total = Math.floor((END - START) * FPS);
console.log(`capturing ${total} frames @ ${FPS}fps (${START}s - ${END.toFixed(1)}s) -> ${OUT}`);

const ff = spawn('ffmpeg', [
  '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
  '-ss', String(START), '-t', String(END - START), '-i', 'audio.mp3',
  '-map', '0:v', '-map', '1:a',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-pix_fmt', 'yuv420p', '-vf', `scale=${W}:${H}`,
  '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', '-shortest', OUT,
], { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((res, rej) => { ff.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exit ${c}`)))); });
ff.stdin.on('error', () => { /* surfaced by the close handler */ });

const t0 = Date.now();
for (let i = 0; i < total; i++) {
  const b64 = await page.evaluate((t) => window.__capture.frame(t), START + i / FPS);
  if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % FPS === 0) {
    const el = (Date.now() - t0) / 1000;
    process.stdout.write(`\r${i}/${total}  ${((i / total) * 100).toFixed(1)}%  eta ${Math.round((el / (i + 1)) * (total - i))}s   `);
  }
}
ff.stdin.end();
await done;
await browser.close();
server.close();
console.log(`\ndone -> ${OUT}`);
