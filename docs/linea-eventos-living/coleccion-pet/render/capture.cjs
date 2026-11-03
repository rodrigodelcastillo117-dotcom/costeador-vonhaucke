// node capture.cjs <port> <outdir> shot1 shot2 ...
const { chromium } = require('playwright');
(async () => {
  const [port, out, ...shots] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const s of shots) {
    const [name, w, h] = s.split(':');
    const W = +(w || 2400), H = +(h || 1600);
    const p = await b.newPage({ viewport: { width: W, height: H } });
    const logs = [];
    p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text().slice(0, 200)); });
    p.on('pageerror', (e) => logs.push('PAGEERR ' + e.message));
    const t0 = Date.now();
    await p.goto(`http://127.0.0.1:${port}/index.html?shot=${name}&w=${W}&h=${H}`);
    await p.waitForFunction(() => window.__done, null, { timeout: 240000 }).catch(() => logs.push('timeout'));
    const st = await p.evaluate(() => window.__done);
    await (await p.$('canvas')).screenshot({ path: `${out}/${name}.png` });
    console.log(name, st, ((Date.now() - t0) / 1000).toFixed(1) + 's', logs.slice(0, 4).join(' | '));
    await p.close();
  }
  await b.close();
})();
