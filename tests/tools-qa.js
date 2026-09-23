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

// curated count gate - hub card count vs filesystem (updated A368: 4 experimental tools hidden, curated 43)
try{
  const curated = JSON.parse(fs.readFileSync(CONTENT_TOOLS,'utf8'));
  const curatedCount = Array.isArray(curated) ? curated.length : 0;
  check(curatedCount === 43, 'content/tools.json', `curated ${curatedCount} != 43 (hub live indexable)`);
  check(files.length === 69, 'tools/*.html', `filesystem ${files.length} != 69 raw (43 indexable + 26 noindex)`);
  if(curatedCount===43 && files.length===69) console.log(`  [PASS] tools count curated 43 vs raw 69`);
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
