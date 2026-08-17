import { chromium } from 'playwright';
const URL = 'file:///home/ubuntu/dev/z-melvynx-benches/index.html';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => console.log('PAGEERROR:', String(e)));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.__BENCH !== undefined);
// real-time sim: sample every 0.3s for 4s (READY phase)
for (let i = 0; i < 14; i++) {
  await page.waitForTimeout(300);
  const s = await page.evaluate(() => {
    const st = window.__BENCH.getState();
    return { t: st.simTime, ph: st.phase, cx: st.car.x, cy: st.car.y, ca: st.car.a,
      cvx: st.car.vx, cvy: st.car.vy, cw: st.car.w, mv: st.movingBricks, ke: st.kineticEnergy };
  });
  console.log(`READY t=${s.t.toFixed(2)} x=${s.cx.toFixed(3)} y=${s.cy.toFixed(3)} a=${s.ca.toFixed(4)} vx=${s.cvx.toFixed(4)} vy=${s.cvy.toFixed(4)} w=${s.cw.toFixed(4)} moving=${s.mv} ke=${s.ke.toFixed(1)}`);
}
// now click Test and sample
await page.click('#btnTest');
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(200);
  const s = await page.evaluate(() => {
    const st = window.__BENCH.getState();
    return { t: st.simTime, ph: st.phase, cx: st.car.x, cvx: st.car.vx, cvy: st.car.vy, cw: st.car.w,
      mv: st.movingBricks, ke: st.kineticEnergy, impact: st.impactTime };
  });
  console.log(`RUN   t=${s.t.toFixed(2)} ph=${s.ph} x=${s.cx.toFixed(3)} vx=${s.cvx.toFixed(3)} vy=${s.cvy.toFixed(3)} w=${s.cw.toFixed(3)} moving=${s.mv} ke=${s.ke.toFixed(0)} impact=${s.impact.toFixed(2)}`);
}
await browser.close();
