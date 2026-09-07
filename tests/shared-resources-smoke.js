const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '..');

// The link validator must inspect script src without interpreting JS template text as HTML.
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'jvds-links-'));
try {
  fs.copyFileSync(path.join(ROOT, 'validate-links.js'), path.join(fixture, 'validate-links.js'));
  fs.writeFileSync(path.join(fixture, 'page.html'), '<script>const template = `<a href="not-a-real-link.html">Example</a>`;</script><script src="needed.js"></script>');
  let result = spawnSync(process.execPath, ['validate-links.js'], { cwd: fixture, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /needed\.js/);
  assert.doesNotMatch(result.stdout, /not-a-real-link/);
  fs.writeFileSync(path.join(fixture, 'needed.js'), '// fixture');
  result = spawnSync(process.execPath, ['validate-links.js'], { cwd: fixture, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  console.log('PASS: validator catches missing external scripts and ignores inline templates');
} finally {
  for (const name of ['validate-links.js', 'page.html', 'needed.js']) {
    const file = path.join(fixture, name);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  fs.rmdirSync(fixture);
}

(async () => {
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml' };
  const server = http.createServer((req, res) => {
    const file = path.resolve(ROOT, '.' + decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(ROOT + path.sep)) { res.writeHead(404); return res.end(); }
    fs.readFile(file, (error, data) => { res.writeHead(error ? 404 : 200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(error ? '' : data); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.setViewport({ width: 390, height: 844 });
    await page.setRequestInterception(true);
    page.on('request', req => req.url().startsWith(base) || req.url().startsWith('data:') || req.url().startsWith('blob:') ? req.continue() : req.abort());
    const errors = [], missing = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', res => { if (res.status() === 404 && !res.url().endsWith('/favicon.ico')) missing.push(res.url()); });
    const referencePages = fs.readdirSync(path.join(ROOT, 'tools')).filter(name => name.endsWith('.html') && fs.readFileSync(path.join(ROOT, 'tools', name), 'utf8').includes('src="../workshops/workshop-track.js"'));
    assert.ok(referencePages.length >= 17);
    for (const name of referencePages) {
      await page.goto(`${base}/tools/${name}`, { waitUntil: 'load' });
      assert.equal(await page.evaluate(() => localStorage.getItem('jvds_last_workshop')), '/tools/' + name, name);
    }
    console.log(`PASS: ${referencePages.length} reference pages load and remember their location`);

    await page.goto(base + '/games/gem_match.html', { waitUntil: 'load' });
    await page.waitForFunction(() => typeof WeeklyChallenge !== 'undefined' && typeof playerProfile !== 'undefined');
    const reward = await page.evaluate(() => {
      const p = playerProfile, challenge = WeeklyChallenge.thisWeek(), activity = p.getWeeklyActivity();
      activity.games = Array.from({ length: challenge.goal }, (_, i) => 'test-' + i);
      activity.runs = activity.xp = challenge.goal;
      activity.claimed = null;
      const before = p.state.bonusXP;
      const el = document.createElement('section'); document.body.appendChild(el);
      for (let i = 0; i < 5; i++) WeeklyChallenge.render(el, { shout() {} });
      return { delta: p.state.bonusXP - before, expected: challenge.xp, claimed: WeeklyChallenge.progress().claimed };
    });
    assert.equal(reward.delta, reward.expected);
    assert.equal(reward.claimed, true);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => typeof WeeklyChallenge !== 'undefined');
    const rollover = await page.evaluate(() => {
      const p = playerProfile, before = p.state.bonusXP, el = document.createElement('section');
      document.body.appendChild(el); WeeklyChallenge.render(el, { shout() {} });
      const unchanged = p.state.bonusXP === before;
      const claimed = WeeklyChallenge.progress().claimed;
      p.state.weeklyActivity.key = p.getWeekNumber() - 1;
      const fresh = WeeklyChallenge.progress();
      return { unchanged, claimed, reset: fresh.current === 0 && !fresh.claimed };
    });
    assert.deepEqual(rollover, { unchanged: true, claimed: true, reset: true });
    console.log('PASS: weekly helper loads, rewards once, survives reload and resets stale weekly progress');

    for (const file of ['games/sky_high_with_friends.html', 'games/pip_star_connect.html', 'pages/press.html']) {
      await page.goto(base + '/' + file, { waitUntil: 'load' });
      await page.waitForFunction(() => !document.querySelector('script[src*="game-system.js"]') || typeof WeeklyChallenge !== 'undefined');
      assert.equal(await page.$$eval('script[src]', scripts => scripts.some(s => /crashlytics\.js|telemetry\.js|\/cdn-cgi\//.test(s.src))), false, file);
      if (file === 'pages/press.html') {
        const links = await page.$$eval('.btn-dl-press, .cc-value a, .cc-link', els => els.map(el => el.getAttribute('href')).filter(Boolean));
        assert.ok(links.filter(href => href.startsWith('mailto:')).length >= 3);
        assert.equal(await page.$('[data-cfemail]'), null);
      }
    }
    assert.deepEqual(errors, [], 'No uncaught errors in affected pages');
    assert.deepEqual(missing, [], 'No missing local resources in affected pages');
    console.log('PASS: Sky High, Star Connect and press links load without missing local resources');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
