// Screens canvas capture: serves the repo over a local static server, drives
// every catalog state in Chromium with Playwright, writes docs/screens/<id>.png
// and injects the manifest into docs/screens.template.html -> docs/screens.html.
// Run through tool/capture_screens.sh (which supplies Playwright via npx).
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const {chromium} = require('playwright');
const {groups} = require('./catalog.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'docs', 'screens');
const TEMPLATE = path.join(ROOT, 'docs', 'screens.template.html');
const HTML = path.join(ROOT, 'docs', 'screens.html');
const NOW = '2026-09-30T08:08:00Z'; // 10:08 in Europe/Zagreb, the watch faces' sample time
const DESKTOP = {width: 1440, height: 900, deviceScaleFactor: 1};
const PHONE = {width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true};

const TYPES = {'.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.txt': 'text/plain'};

function serve() {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, {'content-type': 'text/plain'}); res.end('not found'); return;
    }
    res.writeHead(200, {'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store'});
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function selectStates() {
  const all = groups.flatMap(g => g.screens.map(s => ({...s, group: g})));
  const seen = new Set();
  for (const s of all) {
    if (!/^[a-z0-9-]+--[a-z0-9-]+--[a-z0-9-]+$/.test(s.id)) throw new Error(`bad screen id: ${s.id}`);
    if (!s.id.startsWith(`${s.group.id}--`)) throw new Error(`screen ${s.id} is not in group ${s.group.id}`);
    if (seen.has(s.id)) throw new Error(`duplicate screen id: ${s.id}`);
    if (!fs.existsSync(path.join(ROOT, s.source))) throw new Error(`missing source for ${s.id}: ${s.source}`);
    seen.add(s.id);
  }
  const only = (process.env.SCREENS_ONLY || '').split(',').map(x => x.trim()).filter(Boolean);
  return {all, picked: only.length ? all.filter(s => only.includes(s.id)) : all, partial: only.length > 0};
}

async function capture(browser, base, s) {
  const device = s.device === 'phone' ? PHONE : DESKTOP;
  const context = await browser.newContext({
    viewport: {width: device.width, height: device.height}, deviceScaleFactor: device.deviceScaleFactor,
    isMobile: !!device.isMobile, hasTouch: !!device.hasTouch, locale: 'en-US', timezoneId: 'Europe/Zagreb',
    colorScheme: 'dark', reducedMotion: 'no-preference', javaScriptEnabled: !s.noJs, serviceWorkers: 'block',
  });
  const problems = [];
  const failing = s.fail || [];
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== base) { problems.push(`unhandled external request: ${url.href}`); return route.abort(); }
    if (failing.some(f => url.pathname === f)) return route.fulfill({status: 404, body: 'fake failure'});
    return route.continue();
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(NOW));
  page.on('pageerror', e => problems.push(`uncaught error: ${e.message}`));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    if (failing.length && /Failed to load resource/.test(m.text())) return;
    problems.push(`console error: ${m.text()}`);
  });
  page.on('response', r => {
    const p = new URL(r.url()).pathname;
    if (r.status() >= 400 && !failing.includes(p)) problems.push(`HTTP ${r.status()}: ${r.url()}`);
  });

  await page.goto(base + s.path, {waitUntil: 'networkidle'});
  if (s.act) await s.act(page);
  await page.waitForLoadState('networkidle');
  // Load every lazy image up front so full-page captures are complete.
  await page.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager'; });
    await document.fonts.ready;
    await Promise.all([...document.images].map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
    if (!document.documentElement.classList.contains('rampage')) window.scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(250);

  // The homepage is a fixed stage (body overflow hidden): capture the viewport only.
  const file = path.join(OUT, `${s.id}.png`);
  const buf = await page.screenshot({path: file, fullPage: s.path !== '/', animations: s.freeze ? 'allow' : 'disabled', caret: 'hide', scale: 'device'});
  const width = buf.readUInt32BE(16) / device.deviceScaleFactor;
  const height = buf.readUInt32BE(20) / device.deviceScaleFactor;
  await context.close();
  if (problems.length) throw new Error(`${s.id}:\n  ${problems.join('\n  ')}`);
  return {width, height};
}

function writeHtml(entries) {
  const manifest = {
    title: 'danyzmaj.com web — screens', platform: 'web', sibling: '', generatedAt: new Date().toISOString(),
    groups: groups.map(g => ({id: g.id, name: g.name, screens: entries.filter(e => e.group === g.id).map(e => e.screen)}))
      .filter(g => g.screens.length),
  };
  const json = JSON.stringify(manifest).replace(/</g, '\\u003c');
  const template = fs.readFileSync(TEMPLATE, 'utf8');
  const re = /(<script id="manifest" type="application\/json">)[\s\S]*?(<\/script>)/;
  if (!re.test(template)) throw new Error('manifest script not found in template');
  fs.writeFileSync(HTML, template.replace(re, (_, open, close) => open + json + close));
}

(async () => {
  const {picked, partial} = selectStates();
  if (!partial) fs.rmSync(OUT, {recursive: true, force: true});
  fs.mkdirSync(OUT, {recursive: true});
  for (const s of picked) fs.rmSync(path.join(OUT, `${s.id}.png`), {force: true});

  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({args: ['--force-color-profile=srgb', '--disable-partial-raster', '--disable-checker-imaging', '--disable-gpu', '--font-render-hinting=none']});
  const entries = [];
  const failures = [];
  try {
    for (const s of picked) {
      try {
        const {width, height} = await capture(browser, base, s);
        const screen = {id: s.id, name: s.name, state: s.state, file: `screens/${s.id}.png`, width, height, source: s.source, route: s.route || s.path};
        if (s.note) screen.note = s.note;
        entries.push({group: s.group.id, screen});
        console.log(`✓ ${s.id} ${width}×${height}`);
      } catch (e) {
        failures.push(e.message);
        console.error(`✗ ${e.message}`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  for (const e of entries) {
    if (!fs.existsSync(path.join(ROOT, 'docs', e.screen.file))) failures.push(`missing PNG: ${e.screen.file}`);
  }
  if (failures.length) { console.error(`\n${failures.length} capture(s) failed`); process.exit(1); }
  writeHtml(entries);
  console.log(`\n${entries.length} screens -> docs/screens.html`);
})().catch(e => { console.error(e); process.exit(1); });
