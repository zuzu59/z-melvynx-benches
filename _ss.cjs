const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless:true, args:['--no-sandbox','--disable-gpu'] });
  const p = await b.newPage({ width:1280, height:720 });
  await p.goto('file://'+process.cwd()+'/index.html', { waitUntil:'load' });
  await p.waitForTimeout(600);
  const r = await p.evaluate(()=>{
    const D=window.__crash;
    const bricks=D.bodies.filter(x=>!x.static&&!x.isCar);
    // group brick centers by rounded y to count rows
    const rows={};
    for(const br of bricks){
      const yk=Math.round((br.y)/19.2); // ~brickH
      const key=yk; (rows[key]=rows[key]||[]).push(br);
    }
    const keys=Object.keys(rows).map(Number).sort((a,b)=>a-b);
    const gy=D.gy;
    const rowsInfo=keys.map(k=>({yM:Math.round(rows[k][0].y),n:rows[k].length}));
    return { camX:D.camX.toFixed(1), camY:D.camY.toFixed(1), camScale:D.camScale.toFixed(2),
      gy, wallFrontX:D.wallFrontX, minY:Math.min(...bricks.map(x=>x.y-x.hh)).toFixed(0),
      maxY:Math.max(...bricks.map(x=>x.y+x.hh)).toFixed(0),
      nRows:keys.length, rowsInfo };
  });
  console.log(JSON.stringify(r,null,2));
  await b.close();
})();
