#!/usr/bin/env node
// validate-covers.js — ensures every cover referenced in content/games.json, games-registry.js and content-data.js exists on disk (case-sensitive, GitHub Pages)
const fs=require('fs'), path=require('path');
const ROOT=__dirname;
let broken=[];
function check(file,label,arr){
  arr.forEach(e=>{
    if(!e.cover) return;
    const p=path.join(ROOT, e.cover);
    // also try og/ prefix already in value
    if(!fs.existsSync(p)){
      broken.push(`${label} ${e.id||e.file||e.title}: cover "${e.cover}" missing on disk`);
    }
  });
}
try{
  const gamesJson=JSON.parse(fs.readFileSync(path.join(ROOT,'content/games.json'),'utf8'));
  check('content/games.json','content/games.json',gamesJson);
}catch(e){ broken.push('cannot read content/games.json '+e.message); }
try{
  // games-registry.js is window.JVDS_GAMES = [...]
  const src=fs.readFileSync(path.join(ROOT,'games-registry.js'),'utf8');
  const m=src.match(/window\.JVDS_GAMES\s*=\s*(\[[\s\S]*\]);/);
  if(m){ const arr=JSON.parse(m[1]); check('games-registry.js','games-registry.js',arr); }
}catch(e){ broken.push('cannot read games-registry.js '+e.message); }
try{
  const dataSrc=fs.readFileSync(path.join(ROOT,'content-data.js'),'utf8');
  const m2=dataSrc.match(/window\.JVDS_CONTENT\s*=\s*([\s\S]*?);\s*$/m);
  if(m2){ const data=JSON.parse(m2[1]); if(data.workshops) check('content-data workshops','content-data.js', data.workshops); }
}catch(e){ /* ignore */ }
// also check paths.json IDs exist
try{
  const paths=JSON.parse(fs.readFileSync(path.join(ROOT,'content/paths.json'),'utf8'));
  const files=new Set(fs.readdirSync(path.join(ROOT,'workshops')).filter(f=>f.endsWith('.html')).map(f=>f.replace('.html','')));
  paths.forEach(p=> (p.levels||[]).forEach(l=> (l.workshops||[]).forEach(w=>{ if(!files.has(w)) broken.push(`paths.json ${p.id} -> workshop "${w}" missing`); })));
}catch(e){ broken.push('paths.json check failed '+e.message); }

if(!broken.length){ console.log(`✓ validate-covers: all covers and paths exist`); process.exit(0); }
console.log(`✗ validate-covers: ${broken.length} broken`);
broken.forEach(b=>console.log('  '+b));
process.exit(1);
