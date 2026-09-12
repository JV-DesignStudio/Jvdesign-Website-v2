#!/usr/bin/env node
/* Tools QA: static contract for every tool page + curated count gate */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const TOOLS_DIR = path.join(ROOT, 'tools');
const CONTENT_TOOLS = path.join(ROOT, 'content', 'tools.json');

const files = fs.readdirSync(TOOLS_DIR).filter(f => f.endsWith('.html')).sort();
const failures = [];
const notes = [];
function check(ok, file, msg){ if(!ok) failures.push(`${file}: ${msg}`); }

// curated count gate - 18 live hub cards vs 61 filesystem
try{
  const curated = JSON.parse(fs.readFileSync(CONTENT_TOOLS,'utf8'));
  const curatedCount = Array.isArray(curated) ? curated.length : 0;
  check(curatedCount === 18, 'content/tools.json', `curated ${curatedCount} != 18 (hub live)`);
  check(files.length === 61, 'tools/*.html', `filesystem ${files.length} != 61 raw (18 curated + 43 reference/landing)`);
  if(curatedCount===18 && files.length===61) console.log(`  [PASS] tools count curated 18 vs raw 61`);
  else console.log(`  [INFO] tools count curated ${curatedCount} vs raw ${files.length}`);
}catch(e){ failures.push(`content/tools.json: ${e.message}`); }

for(const file of files){
  const html = fs.readFileSync(path.join(TOOLS_DIR, file), 'utf8');
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const noZoom = /user-scalable\s*=\s*no|maxim(?:um)?-scale\s*=\s*1/i.test(html);
  const title = /<title>[^<]+<\/title>/i.test(html);
  const ids = [...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(m=>m[1]);
  const dups = ids.filter((id,i)=> ids.indexOf(id)!==i && !id.includes('${'));
  check(title, file, 'missing title');
  check(hasViewport, file, 'missing viewport');
  check(!noZoom, file, 'viewport disables zoom');
  if(dups.length) notes.push(`${file}: duplicate ids: ${[...new Set(dups)].join(', ')}`);
  // noindex landing pages should not be in curated count - they are raw 61 but not 18
  if(/noindex/i.test(html) && /rel=["']canonical["']/i.test(html)) notes.push(`${file}: noindex redirect (landing/reference)`);
}
console.log(`Tools QA: ${files.length} pages scanned`);
if(failures.length) failures.forEach(f=> console.log(`  [FAIL] ${f}`));
else console.log('  [PASS] tools static contract');
notes.forEach(n=> console.log(`  [INFO] ${n}`));
if(failures.length) process.exitCode=1;
