// Render single frames to PNG for look-dev: node tools/still.mjs 12 31 33 74 ...  -> tools/stills/t<sec>.png
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { startServer } from '../serve.mjs';

const times = process.argv.slice(2).map(Number).filter(Number.isFinite);
await mkdir('tools/stills', { recursive: true });
const server = await startServer(8124);
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('page error:', e.message));
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.error(m.type() + ':', m.text().slice(0, 600)); });
await page.goto('http://127.0.0.1:8124/?capture&q=1');
await page.waitForFunction(() => window.__capture, null, { timeout: 180000 });
for (const t of times) {
  const b64 = await page.evaluate((s) => window.__capture.frame(s), t);
  await writeFile(`tools/stills/t${t}.png`, Buffer.from(b64, 'base64'));
  console.log('t', t, 'ok');
}
await browser.close(); server.close();
