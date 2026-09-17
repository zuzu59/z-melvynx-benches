const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless:true, args:['--no-sandbox','--disable-gpu'] });
  const p = await b.newPage({ width:1280, height:720 });
  p.on('console', m => console.log('LOG', m.text()));
  await p.goto('file://'+process.cwd()+'/index.html', { waitUntil:'load' });
  await p.waitForTimeout(500);
  const r = await p.evaluate(()=>{
    const C=window.__crash;
    window.__dbg=true;
    function mk(x,y){
      const I=1/((1/12)*2.5*(38.8**2+18**2));
      return { x,y,w:38.8,h:18,boxH:18,vx:0,vy:0,va:0,a:0,mass:2.5,invMass:0.4,invI:I,hw:19.4,hh:9,static:0,restitution:0.18,friction:0.72,isCar:false,cos:1,sin:0 };
    }
    const out=[];
    for(let ov=0; ov<=20; ov+=4){
      const A=mk(999, 620);
      const B=mk(999, 620-18+ov);
      window._dbgResult=null;
      const c=C.__collide(A,B);
      out.push({overlap:ov, found:!!(c&&c.contacts), nc:c?c.contacts.length:'-', res:window._dbgResult, clip2:window._dbgClip2});
    }
    return out;
  });
  console.log(JSON.stringify(r,null,2));
  await b.close();
})();
