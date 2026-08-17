// Node harness: run the sim physics headlessly (no rAF, fixed stepping)
const fs = require('fs');
const html = fs.readFileSync('/home/ubuntu/dev/z-melvynx-benches/index.html', 'utf8');
const src = html.match(/<script>([\s\S]*?)<\/script>/)[1];

const els = {};
function mkEl(id){ return { id, style:{}, textContent:'', className:'', classList:{add(){},remove(){},toggle(){},contains(){return false}},
  addEventListener(){}, getContext(){ return new Proxy({}, { get:(t,p)=> (p==='canvas'?{width:100,height:100}: (typeof p==='string'? fn():undefined)) }); },
  clientWidth:1440, clientHeight:900, width:0, height:0, innerText:'', value:'' };
}
function fn(){ return function(){}; }
const ctxStub = new Proxy({}, {
  get(t, p){
    if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop(){} });
    if (p === 'measureText') return () => ({ width: 0 });
    if (p === 'canvas') return { width: 100, height: 100 };
    return typeof p === 'string' ? (['fillStyle','strokeStyle','lineWidth','lineCap','font','textAlign'].includes(p) ? '' : fn()) : undefined;
  },
  set(){ return true; }
});
const canvasEl = { width:0, height:0, clientWidth:1440, clientHeight:900, style:{}, getContext:() => ctxStub, addEventListener(){} };
const doc = {
  getElementById: id => id === 'view' ? canvasEl : (els[id] ||= mkEl(id)),
  createElement: () => ({ width:0, height:0, style:{}, getContext:() => ctxStub }),
};
const stageEl = { clientWidth:1440, clientHeight:900 };
const win = {
  addEventListener(){}, devicePixelRatio:1,
};
const sandbox = {
  console, performance: { now: () => simPerf },
  document: doc, window: win, requestAnimationFrame: () => {},
  Math, Set, Map, Infinity, NaN, isNaN, parseFloat, parseInt, String, Number, Object, Array, JSON,
};
sandbox.window = Object.assign(win, {
  addEventListener(){},
});
sandbox.globalThis = sandbox;
let simPerf = 0;

const vm = require('vm');
const ctx2 = vm.createContext(sandbox);
vm.runInContext(src, ctx2, { filename: 'sim.js' });
const B = sandbox.window.__BENCH;
if (!B) { console.error('no __BENCH'); process.exit(1); }

function report(label){
  const s = B.getState();
  const maxY = Math.max(...s.bricks.map(b => b.y));
  const minY = Math.min(...s.bricks.map(b => b.y));
  const maxSp = Math.max(...s.bricks.map(b => Math.hypot(b.vx, b.vy)));
  console.log(`${label} t=${s.simTime.toFixed(3)} phase=${s.phase} car(x=${s.car.x.toFixed(3)},y=${s.car.y.toFixed(3)},vx=${s.car.vx.toFixed(3)},vy=${s.car.vy.toFixed(3)}) bricks mvy=[${minY.toFixed(3)},${maxY.toFixed(3)}] maxBrickSp=${maxSp.toFixed(3)} moving=${s.movingBricks}`);
}

B.reset();
// settle the ready state for 1 sim-second (240 steps)
for (let i = 0; i < 240; i++) B.stepUntil(B.getState().simTime + 1/240);
report('READY+1.0s ');
for (let i = 0; i < 120; i++) B.stepUntil(B.getState().simTime + 1/240);
report('READY+1.5s ');

B.test();
let prev = -1;
for (let i = 0; i < 12 * 240; i++) {
  B.stepUntil(B.getState().simTime + 1/240);
  const s = B.getState();
  if (Math.floor(s.simTime) !== prev) { prev = Math.floor(s.simTime); report('RUN  t=' + s.simTime.toFixed(2) + ' '); }
}
report('RUN  final');
