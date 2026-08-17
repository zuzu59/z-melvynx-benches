// Minimal contact tests: single brick on ground, 2-brick stack, brick pair
const fs = require('fs');
const html = fs.readFileSync('/home/ubuntu/dev/z-melvynx-benches/index.html', 'utf8');
const src = html.match(/<script>([\s\S]*?)<\/script>/)[1];

const mkEl = id => ({ id, style:{}, textContent:'', className:'', classList:{add(){},remove(){},toggle(){},contains(){return false}},
  addEventListener(){}, clientWidth:1440, clientHeight:900, width:0, height:0, innerText:'', value:'',
  getContext(){ return new Proxy({}, { get:(t,p)=> p==='createLinearGradient'||p==='createRadialGradient' ? (()=>({addColorStop(){}})) : (['fillStyle','strokeStyle','lineWidth','lineCap','font','textAlign'].includes(p)?'':fn()), set(){return true;} }); } });
function fn(){ return function(){}; }
const canvasEl = { width:0, height:0, clientWidth:1440, clientHeight:900, style:{}, addEventListener(){}, getContext:mkEl().getContext };
const doc = { getElementById: id => id==='view'?canvasEl:(cache[id] ||= mkEl(id)), createElement: () => ({ width:0, height:0, style:{}, getContext:mkEl().getContext }) };
const cache = {};
const sandbox = { console, performance:{now:()=>0}, document:doc, requestAnimationFrame:()=>{}, Math, Set, Map, Infinity, NaN,
  parseFloat, parseInt, String, Number, Object, Array, JSON };
sandbox.window = { addEventListener(){}, devicePixelRatio:1 };
sandbox.globalThis = sandbox;
const vm = require('vm');
vm.runInContext(src, vm.createContext(sandbox));
const B = sandbox.window.__BENCH, D = sandbox.window.__DBG;

function freshScene(){
  B.reset();
  // remove car and all bricks, keep scene empty
  const bs = D.bodies;
  bs.length = 0;
}
function addBrick(x, y, a=0){
  return D.makeBody({x, y, a, mass:2.5, hx:0.25, hy:0.12, mu:0.72, rest:0.18, row:0, col:0});
}
function stepN(n, label){
  for(let i=0;i<n;i++) B.stepUntil(B.getState().simTime + D.DT);
  const s = B.getState();
  const bs = D.bodies;
  const info = bs.map((b,i)=>`b${i}(x=${b.x.toFixed(4)},y=${b.y.toFixed(4)},a=${b.a.toFixed(4)},vx=${b.vx.toFixed(4)},vy=${b.vy.toFixed(4)},w=${b.w.toFixed(4)})`).join(' ');
  console.log(`${label} t=${s.simTime.toFixed(3)} ${info}`);
  return s;
}
function dumpContacts(label){
  for(const c of D.contacts){
    const pts = c.pts.map(p=>`(${p.x.toFixed(3)},${p.y.toFixed(3)},pen=${p.pen.toFixed(5)})`).join(' ');
    console.log(`  C[${label}] n=(${c.nx.toFixed(2)},${c.ny.toFixed(2)}) mu=${c.mu.toFixed(2)} ${pts}`);
  }
}

// ---- Test 1: single brick on ground ----
console.log('--- T1: single brick on ground ---');
freshScene();
const b1 = addBrick(5, 0.12); D.bodies.push(b1);
stepN(1, 'T1 s1'); dumpContacts('T1s1');
stepN(239, 'T1 s240');

// ---- Test 2: two bricks stacked ----
console.log('--- T2: two-brick stack ---');
freshScene();
const c1 = addBrick(5, 0.12), c2 = addBrick(5, 0.36); D.bodies.push(c1, c2);
stepN(1, 'T2 s1'); dumpContacts('T2s1');
stepN(47, 'T2 s48');
stepN(192, 'T2 s240');

// ---- Test 3: two bricks side by side ----
console.log('--- T3: side-by-side ---');
freshScene();
const d1 = addBrick(5, 0.12), d2 = addBrick(5.5, 0.12); D.bodies.push(d1, d2);
stepN(240, 'T3 s240');

// ---- Test 4: brick hit by fast brick (momentum transfer) ----
console.log('--- T4: moving brick hits resting brick ---');
freshScene();
const e1 = addBrick(3, 0.12), e2 = addBrick(5, 0.12); D.bodies.push(e1, e2);
e1.vx = 22;
stepN(100, 'T4 s100');
