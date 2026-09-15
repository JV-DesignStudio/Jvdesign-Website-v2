#!/usr/bin/env node
// Keep the private Studio reference out of this public repository and Pages output.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const forbidden = ['tools/dev-board.html', 'docs/audits', 'studio-workspace'];
const docs = path.join(root, 'docs');
if (fs.existsSync(docs)) {
  for (const entry of fs.readdirSync(docs)) {
    if (/^STUDIO_AUDIT.*\.md$/i.test(entry)) forbidden.push('docs/' + entry);
  }
}
const found = forbidden.filter(relative => fs.existsSync(path.join(root, relative)));
if (found.length) {
  console.error('Private planning must be moved outside the public site: ' + found.join(', '));
  process.exit(1);
}
// Extended leak scan - tokens, ntfy, env files (depth 8, json/txt/yml scanned, strict .env)
const leakPatterns = [
  /github_pat_/i,
  /gho_[A-Za-z0-9_]{20,}/i,
  /ntfy-topic/i,
  /BREVO_API_KEY/i,
  /(^|\W)\.env(\W|$)/,
  /ga4-key\.json/i,
  /bmc-key\.txt/i,
  /kofi-token\.txt/i,
  /\.board-token/i,
];
const ALLOWED_LEAK_FILES = new Set(['validate-public-boundary.js', 'board-keeper.log', 'check-dashes.cjs', 'A29_PROVENANCE.md', 'approve-private.html']);
// files where .env / BREVO / ga4-key mention is documentation, not secret
const DOC_LEAK_ALLOW = new Set(['docs/A29_PROVENANCE.md', 'scripts/send-newsletter.js', 'tools/sound-studio.html', 'approve-private.html', 'board-data.json', 'content/stats.json', 'content-data.js']);
const SCAN_EXTS = ['.js','.html','.ps1','.md','.json','.txt','.yml','.yaml'];
const walkForLeaks=(dir,depth=0)=>{
  if(depth>8) return [];
  const foundLeaks=[];
  try{
    for(const e of fs.readdirSync(dir,{withFileTypes:true})){
      if(e.name.startsWith('.git')||e.name==='node_modules') continue;
      if(e.name==='quest-board-deploy' || e.name==='dist' || e.name==='.vite' || e.name==='coverage' || e.name==='tmp' ) continue;
      const full=path.join(dir,e.name);
      if(e.isDirectory()) foundLeaks.push(...walkForLeaks(full,depth+1));
      else if(SCAN_EXTS.some(ext=>e.name.endsWith(ext)) || e.name==='.env' || e.name.startsWith('.env.') || e.name==='.board-token' || e.name.endsWith('.env')){
        if(ALLOWED_LEAK_FILES.has(e.name)) continue;
        try{
          const txt=fs.readFileSync(full,'utf8');
          const rel=path.relative(root,full).replace(/\\/g,'/');
          for(const pat of leakPatterns){
            if(!pat.test(txt)) continue;
            // allow docs/examples that mention env vars but are not leaks
            if(DOC_LEAK_ALLOW.has(rel) || DOC_LEAK_ALLOW.has(path.basename(rel))){
              // for these files only fail if pattern looks like real token (pat includes _ and value)
              if(pat.source.includes('github_pat') && /github_pat_[A-Za-z0-9]{20,}/.test(txt)) { foundLeaks.push(rel+':'+pat); break; }
              if(pat.source.includes('BREVO') && /BREVO_API_KEY\s*=\s*['"][^'"]{10,}/.test(txt)) { foundLeaks.push(rel+':'+pat); break; }
              if(pat.source.includes('\\.env') && /(?:^|[^a-zA-Z0-9_])\.env(?:\s*=\s*['"][^'"]+['"]|\s+key)/i.test(txt)) { foundLeaks.push(rel+':'+pat); break; }
              continue;
            }
            foundLeaks.push(rel+':'+pat); break;
          }
        }catch(e){}
      }
    }
  }catch(e){}
  return foundLeaks;
};
const leaks=walkForLeaks(root);
if(leaks.length){
  console.error('FAIL: potential private leak patterns found: '+leaks.slice(0,10).join(', '));
  console.error('Fix: remove secrets from public files or add to .gitignore; check '+leaks.length+' hits');
  process.exit(1);
}
console.log('Public boundary checked: internal board and audit artifacts are absent.');
