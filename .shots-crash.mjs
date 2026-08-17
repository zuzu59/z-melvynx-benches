// Quick crash screenshots: default 22 m/s run at several moments
import { chromium } from 'playwright';
import path from 'path';

const ROOT = '/home/ubuntu/dev/z-melvynx-benches';
const URL = 'file://' + path.join(ROOT, 'index.html');
const SHOT_DIR = path.join(ROOT, 'screenshots');

const d = new Date();
const p = (n, l = 2) => String(n).padStart(l, '0');
const ts = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function shot(tag) {
  const f = path.join(SHOT_DIR, `${ts}.${tag}.png`);
  await page.screenshot({ path: f });
  console.log('📸', f);
}

await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.__BENCH !== undefined, null, { timeout: 8000 });
await page.waitForTimeout(800); // wall settle

await shot('crash-01-ready');

// ---- default run (22 m/s) ----
await page.click('#btnTest');
await page.waitForTimeout(450);   // during launch, car mid-track
const s1 = await page.evaluate(() => { const s = window.__BENCH.getState(); return `${s.phase} t=${s.simTime.toFixed(2)} v=${s.carSpeed.toFixed(1)}`; });
console.log('launch:', s1);
await shot('crash-02-launch');

await page.waitForFunction(() => window.__BENCH.getState().phase === 'crash', null, { timeout: 15000 });
await page.waitForTimeout(60);    // right at first impact
const s2 = await page.evaluate(() => { const s = window.__BENCH.getState(); return `t=${s.simTime.toFixed(2)} v=${s.carSpeed.toFixed(1)} moving=${s.movingBricks}`; });
console.log('impact:', s2);
await shot('crash-03-impact');

await page.waitForTimeout(700);   // collapse in progress
const s3 = await page.evaluate(() => { const s = window.__BENCH.getState(); return `t=${s.simTime.toFixed(2)} v=${s.carSpeed.toFixed(1)} moving=${s.movingBricks}`; });
console.log('collapse:', s3);
await shot('crash-04-collapse');

await page.waitForTimeout(600);   // late collapse, bricks scattering
const s4 = await page.evaluate(() => { const s = window.__BENCH.getState(); return `t=${s.simTime.toFixed(2)} v=${s.carSpeed.toFixed(1)} moving=${s.movingBricks}`; });
console.log('scatter:', s4);
await shot('crash-05-scatter');

await page.waitForFunction(() => window.__BENCH.getState().phase === 'settled', null, { timeout: 30000 });
const s5 = await page.evaluate(() => { const s = window.__BENCH.getState(); return `t=${s.simTime.toFixed(1)} v=${s.carSpeed.toFixed(1)} moving=${s.movingBricks} KE=${(s.kineticEnergy/1000).toFixed(1)}kJ`; });
console.log('settled:', s5);
await shot('crash-06-settled');

// ---- fast run (45 m/s) for a more violent impact ----
await page.evaluate(() => { window.__BENCH.setSettings({ speed: 45 }); window.__BENCH.test(); });
await page.waitForFunction(() => window.__BENCH.getState().phase === 'crash', null, { timeout: 15000 });
await page.waitForTimeout(80);
const s6 = await page.evaluate(() => { const s = window.__BENCH.getState(); return `t=${s.simTime.toFixed(2)} v=${s.carSpeed.toFixed(1)} moving=${s.movingBricks}`; });
console.log('fast impact:', s6);
await shot('crash-07-fast-impact');

await page.waitForTimeout(700);
const s7 = await page.evaluate(() => { const s = window.__BENCH.getState(); return `t=${s.simTime.toFixed(2)} v=${s.carSpeed.toFixed(1)} moving=${s.movingBricks}`; });
console.log('fast collapse:', s7);
await shot('crash-08-fast-collapse');

await browser.close();
console.log('done.');
