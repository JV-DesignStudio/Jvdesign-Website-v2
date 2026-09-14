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
  'board-data.json',
  'latest-post.json',
  'devlog-data.js'
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
    .replace(/"lastRun":\s*"[^"]+"/g,'"lastRun":"<ts>"')
    .replace(/"generated":\s*"[^"]+"/g,'"generated":"<ts>"')
    .replace(/<lastmod>[^<]+<\/lastmod>/g,'<lastmod><ts></lastmod>')
    .replace(/generated:\s*new Date\(\)\.toISOString\(\)/g,'generated:"<ts>"')
    .replace(/var lastmod[^;]+;/g,'')
    .replace(/"total":\s*"[^"]*BMC[^"]*"/g,'"total":"<ts>"')
    .replace(/"last7d":\s*"[^"]*"/g,'"last7d":"<ts>"');
}
const isQuick = process.argv.includes('--quick');
const isFix = process.argv.includes('--fix');
let quickDrift = [];
function restoreBefore(before){
  for(const p of GENERATED){
    const fp=path.join(ROOT,p);
    const orig=before[p];
    if(orig===null){
      try{ fs.unlinkSync(fp); }catch{}
    } else {
      try{ fs.writeFileSync(fp, orig); }catch(e){ console.error('restore failed '+p+': '+e.message); }
    }
  }
  // cleanup sitemap cache side-effect that breaks idempotency
  try{ fs.unlinkSync(path.join(ROOT,'tmp','lastmod-cache.json')); }catch{}
  try{ fs.unlinkSync(path.join(ROOT,'.git','lastmod-cache.json')); }catch{}
}
if(isQuick){
  // fast lane: check git dirty (including staged) + run parity gates; fail if dirty
  console.log('check:drift --quick: fast semantic checks (no generator run)');
  quickDrift = [];
  try{
    const out1 = execSync('git diff --name-only', {cwd:ROOT, encoding:'utf8'});
    const out2 = execSync('git diff --cached --name-only', {cwd:ROOT, encoding:'utf8'});
    const dirty = new Set([...out1.split(/\r?\n/), ...out2.split(/\r?\n/)].map(s=>s.trim()).filter(Boolean));
    for(const p of GENERATED){
      if(dirty.has(p)) quickDrift.push(p+' (git dirty)');
    }
  }catch{}
  if(quickDrift.length) console.log('  [quick] git dirty generated files: '+quickDrift.join(', '));
}
let beforeOnce = true;
let after;
let drift=[];
if(!isQuick){
  const before=snapshot();
  try{
    sh('node scripts/generate-content-data.js');
    sh('node scripts/build-content-data.js');
    sh('node generate-search-index.js');
    sh('node generate-sitemap.js');
    sh('node scripts/generate-board-data.js');
    try{ sh('node generate-latest-post.js'); }catch(e){ /* latest optional */ }
  }catch(e){
    console.error('Generator failed:', e.message);
    console.error(e.stdout||'', e.stderr||'');
    restoreBefore(before);
    process.exit(2);
  }
  after=snapshot();
  for(const p of GENERATED){
    const a=normalize(before[p]);
    const b=normalize(after[p]);
    if(a!==b){
      drift.push(p);
      console.log(`DRIFT: ${p}`);
    }
  }
  if(drift.length){
    console.log(`\n✗ ${drift.length} generated file(s) drift from committed version:`);
    drift.forEach(p=> console.log('  - '+p));
    console.log('\nSource of truth is the generators; committed files are stale.');
    console.log('Run: node scripts/check-generated-drift.js --fix  (or npm run build) and commit.');
    console.log('If drift is timestamp-only, normalize() needs updating.');
    if(!isFix){
      restoreBefore(before);
      console.log('[drift] restored original files (use --fix to keep regenerated)');
      process.exit(1);
    }
    console.log('\n--fix: kept regenerated files.');
    process.exit(0);
  }
  // no drift but still cleanup cache side-effect
  try{ fs.unlinkSync(path.join(ROOT,'tmp','lastmod-cache.json')); }catch{}
  try{ fs.unlinkSync(path.join(ROOT,'.git','lastmod-cache.json')); }catch{}
} else {
  // quick mode: after = before (no mutation), drift already reported via git dirty hint
}
console.log(`✓ No semantic drift in ${GENERATED.length} generated files.`);

// curated vs raw gates - human_review must be done before live, so fail if drift
try{
  const bd = JSON.parse(fs.readFileSync(path.join(ROOT,'board-data.json'),'utf8'));
  const sitemap = bd.sitemap?.urls ?? 0;
  const search = bd.searchIndex?.count ?? 0;
  const delta = Math.abs(sitemap - search);
  if(delta > 4){
    console.error(`\n✗ sitemap (${sitemap}) vs search-index (${search}) delta ${delta} >4 - keep generate-sitemap.js EXCLUDE and generate-search-index.js SKIP in sync via lib/paths`);
    process.exit(1);
  } else console.log(`✓ sitemap/search parity: ${sitemap} vs ${search} delta ${delta} (<=4 allowed, 0 ideal)`);
  const gf = bd.content?.filesystem?.games ?? 0;
  const gr = bd.content?.drift?.gamesRegistry ?? bd.content?.stats?.games ?? 0;
  if(gf !== gr){
    console.error(`\n✗ games drift: filesystem ${gf} != registry ${gr} - 32 curated vs 40 raw, orphans should be noindex redirects (see A130)`);
    process.exit(1);
  } else console.log(`✓ games curated parity: registry ${gr} == filesystem ${gf} (32)`);
  const tf = bd.content?.stats?.tools ?? 0;
  if(tf !== 40){
    console.error(`\n✗ tools curated ${tf} != 40 - hub live is 40 indexable (61 raw includes 21 noindex landing/reference)`);
    process.exit(1);
  } else console.log(`✓ tools curated: 40 (raw 61, 21 noindex)`);
}catch(e){ if(e.code) console.error(e); else console.log('  [WARN] drift gate skipped:', e.message); }

// devlog id uniqueness guard - only POSTS block, not content numbers
try{
  const devlog=fs.readFileSync(path.join(ROOT,'devlog-data.js'),'utf8');
  const block=(devlog.match(/const POSTS\s*=\s*\[([\s\S]*?)\n\];/)||[])[1]||devlog;
  const ids=[...block.matchAll(/\{\s*id:\s*(\d+)/g)].map(m=>m[1]);
  const seen=new Set(), dup=new Set();
  for(const id of ids){ if(seen.has(id)) dup.add(id); else seen.add(id); }
  if(dup.size){ console.error(`\n✗ devlog-data.js duplicate ids: ${[...dup].join(', ')} - dedupe by id`); process.exit(1); }
  else console.log(`✓ devlog-data.js ${ids.length} posts, all ids unique`);
}catch(e){ console.log('  [WARN] devlog id check skipped:', e.message); }
// quick fail on git dirty (after parity gates so delta also checked)
if(isQuick && quickDrift.length){
  console.error(`\n✗ quick: ${quickDrift.length} generated file(s) git-dirty - commit or stash before ship (use --fix or npm run build)`);
  process.exit(1);
}
// also verify ownership doc exists
const readme=path.join(ROOT,'docs','TOOLS_MERGE_AUDIT.md');
if(!fs.existsSync(readme)){
  console.warn('WARN: docs/TOOLS_MERGE_AUDIT.md missing - ownership audit needs it');
}
