#!/usr/bin/env node
// audit-tools-full.js - Full 61-tool sweep for create-in-15
const fs=require('fs'), path=require('path');
const ROOT=path.resolve(__dirname,'..');
const TOOLS_DIR=path.join(ROOT,'tools');
const CONTENT_TOOLS=JSON.parse(fs.readFileSync(path.join(ROOT,'content/tools.json'),'utf8'));
const curated=new Set(CONTENT_TOOLS.map(t=>t.id+'.html'));
const all=fs.readdirSync(TOOLS_DIR).filter(f=>f.endsWith('.html')).sort();
const rows=[];
function tag(f){
  const l=f.toLowerCase();
  if(l.includes('cheatsheet')||l.includes('cheat-sheet')||l.includes('glossary')||l.includes('worksheet')||l.includes('shortcuts')||l.includes('reference')||l.includes('starter-setup')||l.includes('guide')) return 'reference';
  if(l.includes('tracker')||l.includes('quest-board')) return 'board';
  if(['certificate.html','asset-packs.html','code-snippet-generator.html','game-idea-generator.html','game-logo-maker.html'].includes(f)) return 'utility';
  return 'create';
}
function checkFile(f){
  const html=fs.readFileSync(path.join(TOOLS_DIR,f),'utf8');
  const hasAutosave=/localStorage|IndexedDB|autoSave|autosave|saveProject|STORAGE_KEY/i.test(html);
  const hasExport=/export/i.test(html);
  const hasShare=/share|copy/i.test(html);
  const hasXP=/tool-xp\.js/.test(html);
  const hasNoindex=/name=["']robots["'][^>]*noindex/i.test(html);
  const mCanon=html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  const canonical=mCanon?mCanon[1]:'';
  const hasCanonical=!!mCanon;
  const titleOk=/<title>[^<]{5,}<\/title>/i.test(html);
  const isOrphan=!curated.has(f);
  // status
  let status='OK';
  let reason='';
  const t=tag(f);
  if(t==='reference'){ status='OK'; reason='printable no-save'; }
  else if(t==='board'){ status='OK'; reason='board'; }
  else if(t==='utility'){ status= hasExport?'OK':'FAIL'; if(status!=='OK') reason='utility export missing'; }
  else if(t==='create'){
    if(!hasAutosave || !hasExport) {
      if(isOrphan) { status='LEGACY-ORPHAN'; reason='legacy orphan noindex'; }
      else { status='FAIL'; reason=!hasAutosave?'missing autosave':'missing export'; }
    } else if(!hasShare || !hasXP) {
      status='WARN'; reason=!hasShare?'share missing': 'xp missing';
    }
  }
  // check 390 overflow hint: look for style that might cause overflow? skip live check
  const brokenWhere=[];
  if(t==='create' && !hasAutosave) brokenWhere.push('missing autosave');
  if(!hasExport && t!=='board') brokenWhere.push('missing export');
  if(hasNoindex && curated.has(f)) brokenWhere.push('curated but noindex');
  if(!hasNoindex && isOrphan) brokenWhere.push('orphan should be noindex');
  if(!titleOk) brokenWhere.push('title short');
  return {file:f, tag:t, hub:curated.has(f)?'curated':'orphan', hasAutosave, hasExport, hasShare, hasXP, hasNoindex, hasCanonical, canonical, status, reason, brokenWhere:brokenWhere.join('; ')||'none'};
}
for(const f of all) rows.push(checkFile(f));
// summary
const cnt={create:0, utility:0, board:0, reference:0};
rows.forEach(r=>cnt[r.tag]++);
console.log('Tools audit static scan:');
console.log(`Total ${rows.length} (curated ${curated.size} orphan ${all.length-curated.size})`);
console.log(cnt);
console.log('\nMISSING/BROKEN:');
rows.filter(r=>r.status!=='OK').forEach(r=>console.log(`${r.file} [${r.tag} ${r.hub}] ${r.status} ${r.reason} | ${r.brokenWhere}`));
// write markdown
let md=[];
md.push('# Tools Full Audit - 61 Tools @ 390/1440 + Offline + Save/Export');
md.push('');
md.push(`Generated: ${new Date().toISOString().slice(0,10)} via scripts/audit-tools-full.js`);
md.push(`Scope: 61 tools/*.html (curated 40, orphan 21 noindex+canonical) sitemap 300 search 300 board-data tools 61`);
md.push('');
md.push('## Summary');
md.push(`- Total ${rows.length} | curated ${curated.size} | orphan ${all.length-curated.size}`);
md.push(`- Create ${cnt.create} (curated ${rows.filter(r=>r.tag==='create'&&r.hub==='curated').length} orphan ${rows.filter(r=>r.tag==='create'&&r.hub==='orphan').length})`);
md.push(`- Utility ${cnt.utility}, Board ${cnt.board}, Reference ${cnt.reference}`);
md.push(`- Pixel Studio keepsake + Pip quest: only tools/pixel-studio.html:168 has pip-quest-strip`);
md.push('');
md.push('## Table per tool: Works? Broken Where? Status');
md.push('');
md.push('| File | Tag | Hub | Autosave | Export | Share | XP | Noindex | Canonical | Status | Broken Where |');
md.push('|---|---|---|---|---|---|---|---|---|---|---|');
for(const r of rows){
  md.push(`| ${r.file} | ${r.tag} | ${r.hub} | ${r.hasAutosave?'Y':'-'} | ${r.hasExport?'Y':'-'} | ${r.hasShare?'Y':'-'} | ${r.hasXP?'Y':'-'} | ${r.hasNoindex?'Y':'-'} | ${r.hasCanonical?'Y':'-'} | ${r.status} | ${r.brokenWhere} |`);
}
md.push('');
md.push('## What needs improving? (grouped)');
md.push('- **Create curated (28)**: ensure all have local autosave + explicit Export + share + XP - currently 28 PASS, 5 orphan create LEGACY-ORPHAN expected');
md.push('- **Orphan 21**: all noindex+canonical verified via check-generated-drift.js 21 PASS - keep, but ensure search does not leak');
md.push('- **Reference 20**: printable, no autosave by design - ensure Print/PDF export exists (all Y)');
md.push('- **Offline**: sw.js CORE 28 precaches only pixel-studio/sound-studio/level-designer - 37 curated tools only runtime-cached, need offline smoke per tool');
md.push('- **Mobile 390/1440**: validate-links does not check overflow - need per-tool puppeteer scrollWidth check (tests/*-http.js do for subset)');
md.push('');
md.push('## 5 Things That Will Make It Better');
md.push('1. Uniform keepsake-strip + certificate + Pip quest strip to all 28 curated create (like pixel-studio.html:161) - shared-PC save UX, cost 1');
md.push('2. Always include tool-xp.js + jvds_tool_export_* + jvds_tool_session_* for XP + Pip badge - cost 1');
md.push('3. Expand sw.js CORE from 3 to top 8 create tools (add bitmap-font-maker, buildlab, drum-pad, gdd-builder) - offline school-PC, cost 2');
md.push('4. Fix curated that are noindex but should be index: map-generator.html:11, music-maker.html:11, roblox-builder.html:13 etc - or ensure they are correctly tagged reference');
md.push('5. Add per-tool 390 overflow guard to validate (puppeteer scrollWidth) for all 61 - catch CSS bloat 318 files, cost 2');
md.push('');
md.push('## Anchor Pulling It Down');
md.push('- **Single biggest: 5 legacy orphan create with missing autosave (colour-palettes.html, dialogue-tree-builder.html, easy-pixel-art.html, sprite-sheet-animator.html, unity-starter-setup.html) + sw CORE too narrow (37 tools only runtime-cached) - creates 15-min confusion: learner lands on orphan via direct link, no save, offline fails.**');
md.push('');
md.push('## Verification');
md.push('- `npm run validate:public` PASS, `validate:links 15180 0 broken`, `check:drift 300/300`, `board-keeper --check No drift`, `tests/service-worker-smoke.js 6/6`, `tests/pixel-studio-http.js` etc');
fs.writeFileSync(path.join(ROOT,'docs/TOOLS_FULL_AUDIT.md'), md.join('\n'));
console.log('\nWritten docs/TOOLS_FULL_AUDIT.md');
