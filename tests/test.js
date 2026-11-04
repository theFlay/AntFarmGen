const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve(process.argv[2]));
  await page.waitForTimeout(800);
  const res = await page.evaluate(() => {
    const N = window.__nest;
    const base = N.state.P;
    const out = { defaultMsgs: N.state.rules.msgs, runs: [] };
    const configs = [
      {}, { W: 300, H: 500 }, { W: 200, H: 500 }, { brood: 3 }, { activeCount: 8, growFrom: 'center' },
      { sponges: 8, dampSide: 'none' }, { W: 500, H: 300, loops: 0.5 }, { workerLen: 6, W: 200, H: 200, spongeLen: 14 },
      { brood: 0, sponges: 0 }, { fillSide: 'both' }, { activeCount: 5, brood: 2 }, { activeCount: 3, growFrom: 'top' }, { activeCount: 12, growFrom: 'center', brood: 2, W: 300, H: 500 }, { workerLen: 20, pitchFactor: 2.5 },
    ];
    for (const cfg of configs) {
      let fails = 0, firstFail = null, slotMismatch = 0, totalFiles = 0;
      for (let seed = 1; seed <= 80; seed++) {
        const P = Object.assign({}, base, cfg, { seed });
        const G = N.derive(P);
        const L = N.generate(G, P);
        const geo = N.buildGeometry(G, L, P);
        const r = N.checkRules(G, L, P, geo);
        if (!r.ok) { fails++; if (!firstFail) firstFail = { seed, msgs: r.msgs.filter(m => m[0] === 'error').map(m => m[1]) }; }
        const tops = geo.pieces.reduce((a, p) => a + p.top.length, 0), bots = geo.pieces.reduce((a, p) => a + p.bot.length, 0);
        if (tops !== geo.slotsFront.length || bots !== geo.slotsBack.length) slotMismatch++;
        const ex = N.exporters(G, L, P, geo);
        totalFiles += ex.files.length;
        for (const f of ex.files) { if (/NaN|undefined|Infinity/.test(f.data)) throw new Error('bad value in ' + f.name + ' cfg ' + JSON.stringify(cfg)); }
      }
      out.runs.push({ cfg, fails, firstFail, slotMismatch, avgFiles: totalFiles / 80 });
    }
    // offset sanity: square 10x10 offset by 1 -> 12x12
    const sq = N.offsetPoly([[0,0],[10,0],[10,10],[0,10]], 1);
    out.offset = sq;
    const sq2 = N.offsetPoly([[0,0],[0,10],[10,10],[10,0]], 1);
    out.offset2 = sq2;
    return out;
  });
  console.log(JSON.stringify(res.runs.map(r=>[JSON.stringify(r.cfg),r.fails,r.firstFail,r.slotMismatch])));console.log(JSON.stringify(res.offset),JSON.stringify(res.offset2));console.log(JSON.stringify(res.defaultMsgs));
  console.log('ERRORS', errs);
  await page.screenshot({ path: path.resolve(__dirname, 'full.png'), fullPage: true });
  await browser.close();
})();
