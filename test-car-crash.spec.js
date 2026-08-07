const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

function getTimestamp() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const HH = String(now.getHours()).padStart(2, '0');
  const MM = String(now.getMinutes()).padStart(2, '0');
  const SS = String(now.getSeconds()).padStart(2, '0');
  return `${yy}${mm}${dd}.${HH}${MM}${SS}`;
}

test('Car Brick Wall Crash - Initial State', async ({ page }) => {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  await page.goto('file://' + path.join(__dirname, 'Car_Brick_Wall_Crash/index.html'));
  await page.waitForTimeout(2000);

  if (errors.length > 0) {
    console.log('Console errors:', JSON.stringify(errors));
  }

  // Check canvas exists
  const canvas = await page.$('canvas');
  expect(canvas).not.toBeNull();

  // Check controls exist
  const btnTest = await page.$('#btn-test');
  expect(btnTest).not.toBeNull();

  // Check default values
  const carSpeed = await page.$eval('#v-speed', el => el.textContent);
  expect(carSpeed).toBe('22');

  const cols = await page.$eval('#v-cols', el => el.textContent);
  expect(cols).toBe('12');

  // Take screenshot
  const ts = getTimestamp();
  await page.screenshot({ path: `Résultats/${ts}_Car_Brick_Wall_Crash_initial.png` });
  console.log(`Initial screenshot saved: ${ts}`);
});

test('Car Brick Wall Crash - Run Test', async ({ page }) => {
  await page.goto('file://' + path.join(__dirname, 'Car_Brick_Wall_Crash/index.html'));
  await page.waitForTimeout(1000);

  const ts = getTimestamp();

  // Click Test
  await page.click('#btn-test');
  
  // Screenshot 1: Early movement (1s)
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `Résultats/${ts}_01_approach.png` });
  console.log(`Screenshot 1: approach phase`);

  // Screenshot 2: Mid-flight (2s)
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `Résultats/${ts}_02_approach2.png` });
  console.log(`Screenshot 2: approaching wall`);

  // Screenshot 3: Impact! (3s)
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `Résultats/${ts}_03_impact.png` });
  console.log(`Screenshot 3: IMPACT!`);

  // Screenshot 4: Debris flying (4s)
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `Résultats/${ts}_04_debris.png` });
  console.log(`Screenshot 4: debris flying`);

  // Screenshot 5: Settlement (5s)
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `Résultats/${ts}_05_settling.png` });
  console.log(`Screenshot 5: settling`);

  // Screenshot 6: Final (6s)
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `Résultats/${ts}_06_final.png` });
  console.log(`Screenshot 6: final state`);

  // Check final telemetry
  const speed = await page.$eval('#tel-speed', el => parseFloat(el.textContent));
  const time = await page.$eval('#tel-time', el => parseFloat(el.textContent));
  const moving = await page.$eval('#tel-moving', el => parseInt(el.textContent));
  console.log(`Final - Speed: ${speed} m/s, Time: ${time.toFixed(2)}s, Moving: ${moving}/192`);
});
