const puppeteer = require('puppeteer');
const { pathToFileURL } = require('url');
const path = require('path');
(async () => {
  const b = await puppeteer.launch({ headless: 'new' });
  const p = await b.newPage();
  await p.setViewport({ width: 794, height: 1123 });
  await p.goto(pathToFileURL(path.resolve(__dirname, '..', 'pages', 'pitch.html')).href, { waitUntil: 'networkidle0' });
  const h = await p.evaluate(() => Math.round(document.querySelector('.sheet').getBoundingClientRect().height));
  console.log('sheet height:', h, 'px  (one A4 page at 794px wide = 1123px)');
  await b.close();
})();
