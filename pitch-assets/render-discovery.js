const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 1 });
  const fileUrl = 'http://localhost:3007/pages/discovery_session.html';
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  const info = await page.evaluate(() => ({
    total: document.querySelectorAll('.reveal').length,
    visible: document.querySelectorAll('.reveal.visible').length,
    heroOpacity: getComputedStyle(document.querySelector('.hero-inner')).opacity
  }));
  console.log('reveal state:', JSON.stringify(info));
  // Full page screenshot
  await page.screenshot({ path: path.resolve(__dirname, 'discovery-full.png'), fullPage: true });
  // Hero-only shot
  await page.screenshot({ path: path.resolve(__dirname, 'discovery-hero.png') });
  await browser.close();
  console.log('screenshots written');
})().catch(e => { console.error(e); process.exit(1); });
