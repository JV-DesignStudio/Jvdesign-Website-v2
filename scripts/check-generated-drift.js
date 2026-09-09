#!/usr/bin/env node
/*
 * check-generated-drift.js - A13 drift guard
 * Runs the full content pipeline and fails if generated files drift beyond timestamps.
 * This exists because an isolated build changes content-data.js, stats, search-index,
 * sitemap.xml and board-data.json, but nobody knew which source was canonical.
 * Usage: node scripts/check-generated-drift.js [--fix]
 *  --fix  rewrites the files and exits 0 (for local fix), otherwise exits 1 on drift.
 */
const fs=require('fs'), path=require('path'), {execSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..');
const GENERATED=[
  'content/workshops.json',
  'content/games.json',
  'content/tools.json',
  'content/books.json',
  'content/characters.json',
  'content/paths.json',
  'content/stats.json',
  'content-data.js',
  'search-index.json',
  'sitemap.xml',
  'board-data.json'
];
function sh(cmd){ return execSync(cmd,{cwd:ROOT, encoding:'utf8', stdio:'pipe'}); }
function snapshot(){
  const m={};
  for(const p of GENERATED){
    const fp=path.join(ROOT,p);
    try{ m[p]=fs.readFileSync(fp,'utf8'); }catch{ m[p]=null; }
  }
  return m;
}
function normalize(s){
  // Strip generated timestamps that change every run but are not semantic drift
  if(!s) return s;
  return s
    .replace(/"generated":\s*"[^"]+"/g,'"generated":"<ts>"')
    .replace(/"lastmod":\s*"[^"]+"/g,'"lastmod":"<ts>"')
    .replace(/<lastmod>[^<]+<\/lastmod>/g,'<lastmod><ts></lastmod>')
    .replace(/generated:\s*new Date\(\)\.toISOString\(\)/g,'generated:"<ts>"')
    .replace(/ivar lastmod[^;]+;/g,'');
}
const before=snapshot();
try{
  sh('node scripts/generate-content-data.js');
  sh('node scripts/build-content-data.js');
  sh('node generate-search-index.js');
  sh('node generate-sitemap.js');
  sh('node scripts/generate-board-data.js');
}catch(e){
  console.error('Generator failed:', e.message);
  console.error(e.stdout||'', e.stderr||'');
  process.exit(2);
}
const after=snapshot();
const drift=[];
for(const p of GENERATED){
  const a=normalize(before[p]);
  const b=normalize(after[p]);
  if(a!==b){
    drift.push(p);
    console.log(`DRIFT: ${p}`);
    // restore original if not --fix
    if(!process.argv.includes('--fix')){
      // keep generated for inspection but report
    }
  }
}
if(drift.length){
  console.log(`\n✗ ${drift.length} generated file(s) drift from committed version:`);
  drift.forEach(p=> console.log('  - '+p));
  console.log('\nSource of truth is the generators; committed files are stale.');
  console.log('Run: node scripts/check-generated-drift.js --fix  (or npm run build) and commit.');
  console.log('If drift is timestamp-only, normalize() needs updating.');
  if(!process.argv.includes('--fix')) process.exit(1);
  console.log('\n--fix: kept regenerated files.');
  process.exit(0);
}
console.log(`✓ No semantic drift in ${GENERATED.length} generated files.`);

// also verify ownership doc exists
const readme=path.join(ROOT,'docs','TOOLS_MERGE_AUDIT.md');
if(!fs.existsSync(readme)){
  console.warn('WARN: docs/TOOLS_MERGE_AUDIT.md missing - ownership audit needs it');
}
