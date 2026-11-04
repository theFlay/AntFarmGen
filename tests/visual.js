const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto('file://' + path.resolve(process.argv[2]));
  await page.waitForTimeout(600);
  // interactions
  const before = await page.evaluate(() => JSON.stringify(window.__nest.state.L.H));
  const edge = await page.$('[data-edge]');
  const eb = await edge.boundingBox();
  await page.mouse.click(eb.x + eb.width / 2, eb.y + eb.height / 2);
  const after = await page.evaluate(() => JSON.stringify(window.__nest.state.L));
  await page.click('#undo');
  const undone = await page.evaluate(() => JSON.stringify(window.__nest.state.L.H));
  await page.click('[data-tool="cell"]');
  const cell = await page.$('[data-cell="1,4"]'); const cb = await cell.boundingBox();
  await page.mouse.click(cb.x + cb.width / 2, cb.y + cb.height / 2);
  const cellOff = await page.evaluate(() => window.__nest.state.L.active[1][4]);
  await page.click('#undo');
  await page.click('[data-tool="merge"]');
  const cell2 = await page.$('[data-cell="0,6"]'); const cb2 = await cell2.boundingBox();
  await page.mouse.click(cb2.x + cb2.width / 2, cb2.y + cb2.height / 2);
  const merges = await page.evaluate(() => window.__nest.state.L.merges);
  console.log('edge changed:', before !== after, 'undo restored:', before === undone, 'cell off:', cellOff === false, 'merges:', JSON.stringify(merges));
  await page.click('#undo');
  await page.click('[data-tool="wall"]');
  const prev = await page.$('#preview');
  await prev.screenshot({ path: path.resolve(__dirname, 'preview.png') });
  // dump exported files
  const files = await page.evaluate(() => {
    const s = window.__nest.state; return window.__nest.exporters(s.G, s.L, s.P, s.geo).files;
  });
  fs.mkdirSync(path.resolve(__dirname, 'out'), { recursive: true });
  for (const f of files) fs.writeFileSync(path.resolve(__dirname, 'out', f.name), f.data);
  console.log(files.map(f => f.name + ' ' + f.data.length).join('\n'));
  // render a few svgs at scale for inspection
  for (const [name, scale] of [['strips-sheet-1.svg', 2], ['front-sheet.svg', 3], ['frame-layer-cut-x4.svg', 3]]) {
    const svg = fs.readFileSync(path.resolve(__dirname, 'out', name), 'utf8').replace(/width="[\d.]+mm" height="[\d.]+mm"/, '');
    const p2 = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    await p2.setContent(`<body style="margin:0;background:#fff"><div style="width:1400px">${svg.replace('<svg', '<svg style="width:1400px;height:auto"')}</div></body>`);
    await p2.screenshot({ path: path.resolve(__dirname, name.replace('.svg', '.png')), fullPage: true });
    await p2.close();
  }
  // mobile layout
  const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await m.goto('file://' + path.resolve(process.argv[2]));
  await m.waitForTimeout(500);
  await m.screenshot({ path: path.resolve(__dirname, 'mobile.png') });
  console.log('ERRORS', errs);
  await browser.close();
})();
