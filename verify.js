// Playwright headless verification + progress screenshots for index.html
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const SH_DIR = path.join(__dirname, "screenshots");
fs.mkdirSync(SH_DIR, { recursive: true });

function stamp(){
  const d = new Date();
  const p = n => String(n).padStart(2,"0");
  return ""+p(d.getFullYear()%100)+p(d.getMonth()+1)+p(d.getDate())+"."+p(d.getHours())+p(d.getMinutes())+p(d.getSeconds());
}

(async () => {
  const url = "file://" + path.join(__dirname, "index.html");
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox","--disable-gpu","--use-gl=swiftshader","--enable-unsafe-swshader"],
  });
  const page = await browser.newPage({ width: 1366, height: 768 });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  // wait for the initial scene to render (canvas sized + default scene drawn)
  await page.waitForFunction(() => document.getElementById('c').width > 100 && document.getElementById('tMove').textContent.length > 0, null, { timeout: 3000 });

  const shots = [];
  async function cap(name){
    let base = stamp()+".png";
    let fn = path.join(SH_DIR, base);
    let n = 1;
    while(fs.existsSync(fn)){ fn = path.join(SH_DIR, base.replace(/\.png$/, "_"+ (n++) +".png")); }
    await page.screenshot({ path: fn, fullPage: false });
    shots.push({ name, path: fn });
    console.log("SAVED", fn, "(", name, ")");
  }

  // 1. Initial default scene (before Test)
  await cap("00_initial_default_scene");
  await page.waitForTimeout(500);

  // 2. Launch test, capture progress
  await page.evaluate(() => window.startTest());
  await page.waitForTimeout(350);
  await cap("01_pre_impact");
  await page.waitForTimeout(450);
  await cap("02_first_contact");
  await page.waitForTimeout(700);
  await cap("03_wall_breaking");
  await page.waitForTimeout(900);
  await cap("04_collapse_mid");
  await page.waitForTimeout(1400);
  await cap("05_collapse_settling");
  await page.waitForTimeout(2000);
  await cap("06_debris_settled");

  // 3. A heavier-wall / faster run
  await page.evaluate(() => window.startTest());
  await page.waitForTimeout(700);
  await cap("07_high_speed_run");
  await page.waitForTimeout(1200);
  await cap("08_high_speed_collapse");

  // 4. Heavier bricks
  await page.evaluate(() => {
    document.getElementById("mass").value = 8;
    document.getElementById("vMass").textContent = "8";
    window.prebuild();
    window.startTest();
  });
  await page.waitForTimeout(800);
  await cap("09_heavier_bricks");
  await page.waitForTimeout(1500);
  await cap("10_heavier_bricks_collapse");

  // 5. Reset / final config view
  await page.evaluate(() => { window.prebuild(); });
  await page.waitForTimeout(400);
  await cap("11_reset_config_view");

  await browser.close();
  console.log("\nDONE — " + shots.length + " screenshots in", SH_DIR);
})().catch(e => { console.error("PLAYWRIGHT ERROR:", e); process.exit(1); });
