const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const fileUrl = 'file://' + path.resolve(__dirname, '..', 'pages', 'pitch.html').replace(/\\/g, '/');
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 700));
  await page.pdf({
    path: path.resolve(__dirname, 'JVDesignStudio-OnePager.pdf'),
    format: 'A4',
    printBackground: true,
    margin: { top: 0, bottom: 0, left: 0, right: 0 }
  });
  await page.setViewport({ width: 860, height: 1000, deviceScaleFactor: 2 });
  await page.screenshot({ path: path.resolve(__dirname, 'pitch-preview.png'), fullPage: true });
  await browser.close();
  console.log('PDF + PNG written');
})().catch(e => { console.error(e); process.exit(1); });
