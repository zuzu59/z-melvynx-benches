import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const ROOT = '/home/ubuntu/dev/z-melvynx-benches';
const URL = 'file://' + path.join(ROOT, 'index.html');
const SHOT_DIR = path.join(ROOT, 'screenshots');

const ts = (() => {
  const d = new Date();
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
})();
let shotN = 0;
function shotName(tag) { return `${ts}.${String(++shotN).padStart(2, '0')}-${tag}.png`; }

const results = [];
const consoleErrors = [];
async function shot(page, tag) {
  const f = path.join(SHOT_DIR, shotName(tag));
  await page.screenshot({ path: f });
  console.log('  📸', f);
  return f;
}
async function waitPhase(page, phases, timeoutMs = 25000) {
  return page.waitForFunction(ps => {
    const p = window.__BENCH && window.__BENCH.getState().phase;
    return ps.includes(p);
  }, phases, { timeout: timeoutMs });
}
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push(String(e)));

try {
  // ---------- T1: initial state ----------
  console.log('\nT1 — initial page state');
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__BENCH !== undefined, null, { timeout: 8000 });
  await page.waitForTimeout(1200); // let wall settle
  const title = await page.title();
  check('title is model name', title === 'Qwen3.8-27B-Q4_K_M', `got "${title}"`);
  const brand = await page.locator('.brand').first().innerText();
  check('visible heading is model name', brand.includes('Qwen3.8-27B-Q4_K_M'));
  const s0 = await page.evaluate(() => window.__BENCH.getState());
  check('phase READY before Test', s0.phase === 'ready', s0.phase);
  check('car at rest before Test', s0.carSpeed < 0.01, s0.carSpeed.toFixed(3));
  check('wall settled (moving bricks ~0)', s0.movingBricks <= 3, `${s0.movingBricks} moving`);
  const st = await page.evaluate(() => window.__BENCH.settings());
  check('default settings', st.speed === 22 && st.cols === 12 && st.rows === 8 && st.layers === 2 && st.brickMass === 2.5,
    JSON.stringify(st));
  check('brick count = 12x8', s0.totalBricks === 96, String(s0.totalBricks));
  await shot(page, 'initial');

  // ---------- T2: run default test ----------
  console.log('\nT2 — default crash test (22 m/s, 12x8x2, 2.5 kg)');
  const t0 = Date.now();
  await page.click('#btnTest');
  await waitPhase(page, ['crash']);
  const sImp = await page.evaluate(() => window.__BENCH.getState());
  check('impact happened', sImp.impactTime > 0, `t=${sImp.impactTime.toFixed(2)}s`);
  check('impact speed near 22 m/s', sImp.carSpeed > 15 && sImp.carSpeed < 23.5, `${sImp.carSpeed.toFixed(1)} m/s`);
  check('bricks moving at impact', sImp.movingBricks > 10, `${sImp.movingBricks}`);
  await shot(page, 'impact');
  // mid-collapse
  await page.waitForTimeout(900);
  const sMid = await page.evaluate(() => window.__BENCH.getState());
  await shot(page, 'collapse');
  await waitPhase(page, ['settled']);
  const sSet = await page.evaluate(() => window.__BENCH.getState());
  check('run settles', sSet.phase === 'settled', `t=${sSet.simTime.toFixed(1)}s`);
  check('car slowed after impact', sSet.carSpeed < 10, `${sSet.carSpeed.toFixed(1)} m/s`);
  check('wall was damaged', sSet.movingBricks >= 0 && sImp.movingBricks > 10);
  await shot(page, 'settled');
  console.log(`  (default run took ${(Date.now() - t0) / 1000 | 0}s wall-clock)`);

  // ---------- T3: determinism ----------
  console.log('\nT3 — determinism (same settings → same state at t=2.0s)');
  const snap = async () => {
    await page.evaluate(() => { window.__BENCH.reset(); window.__BENCH.test(); });
    return await page.evaluate(() => window.__BENCH.snapshot(2.0));
  };
  const a1 = await snap();
  const a2 = await snap();
  let identical = a1.length === a2.length;
  for (let i = 0; identical && i < a1.length; i++) if (a1[i] !== a2[i]) identical = false;
  check('identical state after 2 runs at t=2.0s', identical, `${a1.length} values compared`);
  const sDet = await page.evaluate(() => window.__BENCH.getState());
  await shot(page, 'determinism-t2');

  // ---------- T4: settings change → different outcome ----------
  console.log('\nT4 — settings responsiveness (45 m/s)');
  await page.evaluate(() => { window.__BENCH.setSettings({ speed: 45 }); window.__BENCH.test(); });
  await waitPhase(page, ['crash']);
  const s45 = await page.evaluate(() => window.__BENCH.getState());
  check('45 m/s impact faster than 22 m/s baseline', s45.carSpeed > 38, `${s45.carSpeed.toFixed(1)} m/s`);
  await shot(page, 'speed45-impact');
  await waitPhase(page, ['settled'], 40000);
  const s45s = await page.evaluate(() => window.__BENCH.getState());
  check('45 m/s run settles', s45s.phase === 'settled', `t=${s45s.simTime.toFixed(1)}s`);
  await shot(page, 'speed45-settled');

  // ---------- T5: extreme settings stability ----------
  console.log('\nT5 — extreme settings (45 m/s, 24x16x5 wall, 12 kg bricks)');
  await page.evaluate(() => { window.__BENCH.setSettings({ speed: 45, cols: 24, rows: 16, layers: 5, brickMass: 12 }); window.__BENCH.test(); });
  await waitPhase(page, ['crash'], 30000);
  await page.waitForTimeout(2500);
  const sEx = await page.evaluate(() => window.__BENCH.getState());
  let nan = !isFinite(sEx.car.x) || !isFinite(sEx.car.y) || !isFinite(sEx.car.a);
  let below = 0;
  for (const b of sEx.bricks) {
    if (!isFinite(b.x) || !isFinite(b.y) || !isFinite(b.a) || !isFinite(b.vx) || !isFinite(b.vy)) nan = true;
    if (b.y < -0.5) below++;
  }
  check('no NaN in extreme run', !nan);
  check('no bricks fell through ground', below === 0, `${below} below y=-0.5`);
  check('extreme wall has 384 bricks', sEx.totalBricks === 384, String(sEx.totalBricks));
  await shot(page, 'extreme-mid');
  await waitPhase(page, ['settled'], 60000).catch(() => {});
  const sEx2 = await page.evaluate(() => window.__BENCH.getState());
  check('extreme run settles or times out', sEx2.phase === 'settled', `phase=${sEx2.phase} t=${sEx2.simTime.toFixed(1)}s`);
  await shot(page, 'extreme-settled');

  // ---------- T6: minimal settings ----------
  console.log('\nT6 — minimal settings (5 m/s, 4x3x1, 0.5 kg)');
  await page.evaluate(() => { window.__BENCH.setSettings({ speed: 5, cols: 4, rows: 3, layers: 1, brickMass: 0.5 }); window.__BENCH.test(); });
  await waitPhase(page, ['crash']);
  await waitPhase(page, ['settled'], 30000);
  const sMin = await page.evaluate(() => window.__BENCH.getState());
  check('minimal run completes', sMin.phase === 'settled', `t=${sMin.simTime.toFixed(1)}s`);
  await shot(page, 'minimal');

  // ---------- T7: canvas resize ----------
  console.log('\nT7 — resize handling');
  await page.setViewportSize({ width: 800, height: 600 });
  await page.waitForTimeout(500);
  const dims = await page.evaluate(() => {
    const c = document.getElementById('view');
    return { cw: c.width, ch: c.height, sw: c.clientWidth, sh: c.clientHeight };
  });
  check('canvas resizes with window', dims.cw >= dims.sw * 1.5 && dims.ch >= dims.sh * 1.5,
    `${dims.cw}x${dims.ch} backing for ${dims.sw}x${dims.sh} css`);
  await shot(page, 'resized-800x600');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);

  // ---------- console errors ----------
  check('no console/page errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
} catch (e) {
  results.push({ name: 'fatal: ' + e.message, ok: false });
  console.log('  ❌ FATAL:', e.message);
  try { await shot(page, 'fatal'); } catch {}
} finally {
  await browser.close();
}

const failed = results.filter(r => !r.ok);
console.log('\n================ SUMMARY ================');
for (const r of results) console.log(`  ${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
fs.writeFileSync(path.join(SHOT_DIR, `${ts}.report.json`),
  JSON.stringify({ ts, results, consoleErrors }, null, 2));
process.exit(failed.length ? 1 : 0);
