#!/usr/bin/env node
// CI dash guard: fails if any public file contains em/en dash (U+2014/2013)
// Public = pages,tools,games,workshops,books,partials, index.html and similar roots
const fs=require('fs'), path=require('path');
const ROOT=path.resolve(__dirname,'..');
const exts=new Set(['.html','.css','.js','.json','.md']);
const skipDirs=new Set(['node_modules','.git','.opencode','board','verification','docs','tmp','social-posts']);
const emEn = new RegExp('[' + String.fromCharCode(8212,8211) + ']');
let hits=[];
function walk(dir){
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    if(e.name.startsWith('.') && e.name!=='.well-known') continue;
    if(skipDirs.has(e.name)) continue;
    const p=path.join(dir,e.name);
    if(e.isDirectory()) walk(p);
    else if(exts.has(path.extname(e.name))){
      const txt=fs.readFileSync(p,'utf8');
      if(emEn.test(txt)){
        const lines=txt.split('\n');
        lines.forEach((l,i)=>{
          if(emEn.test(l)) hits.push(`${path.relative(ROOT,p)}:${i+1}: ${l.trim().slice(0,120)}`);
        });
      }
    }
  }
}
walk(ROOT);
if(hits.length){
  console.error(`\n✗ Found ${hits.length} lines with em/en dash (use " - " instead):`);
  hits.slice(0,30).forEach(h=>console.error('  '+h));
  console.error('\nFix: node F:/Website/studio-workspace/check-dashes.cjs --fix  then review git diff\n');
  process.exit(1);
} else console.log('✓ No em/en dashes in public files');
