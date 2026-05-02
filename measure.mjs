const URL = process.argv[2] || 'http://localhost:5173';
const LABEL = process.argv[3] || 'unlabeled';
const SAMPLES = 8;

const targets = await (await fetch('http://localhost:9222/json')).json();
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const data = JSON.parse(e.data);
  if (data.id && pending.has(data.id)) { pending.get(data.id)(data.result); pending.delete(data.id); }
});
const send = (m, p={}) => new Promise(r => { const i=++id; pending.set(i,r); ws.send(JSON.stringify({id:i, method:m, params:p})); });
const wait = ms => new Promise(r => setTimeout(r, ms));

await new Promise(r => ws.addEventListener('open', () => r(), { once: true }));
await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: URL });
await wait(2500);
await send('Runtime.evaluate', { expression: "document.getElementById('btn-find').click()" });
await wait(3500);

const readX = async () => {
  const r = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const g = window.__bf;
        if (!g) return null;
        const scene = g.scene.getScene('GameScene');
        if (!scene) return null;
        const p = scene.localPlayer ?? scene.player;
        return p?.sprite?.x ?? null;
      })()
    `,
    returnByValue: true,
  });
  return r.result.value;
};

const samples = [];
for (let i = 0; i < SAMPLES; i++) {
  const beforeX = await readX();
  if (beforeX == null) { console.error(`[${LABEL}] could not read sprite x`); break; }
  const t0 = performance.now();
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });

  let elapsed = null;
  for (let waited = 0; waited < 600; waited += 4) {
    await wait(4);
    const x = await readX();
    if (x != null && Math.abs(x - beforeX) >= 1) {
      elapsed = performance.now() - t0;
      break;
    }
  }
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await wait(500);
  if (elapsed != null) samples.push(elapsed);
  else console.log(`[${LABEL}] sample ${i}: TIMEOUT`);
}

if (samples.length) {
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const min = samples[0];
  const max = samples[samples.length - 1];
  console.log(`[${LABEL}] samples (ms): ${samples.map(s => s.toFixed(0)).join(', ')}`);
  console.log(`[${LABEL}] median ${median.toFixed(0)}ms · mean ${mean.toFixed(0)}ms · min ${min.toFixed(0)} · max ${max.toFixed(0)} · n=${samples.length}`);
}
ws.close();
