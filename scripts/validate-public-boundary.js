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
// Extended leak scan - tokens, ntfy, env files
const leakPatterns = [/github_pat_/i, /gho_/i, /ntfy-topic/i, /BREVO_API_KEY/i, /\.env/i];
const walkForLeaks=(dir,depth=0)=>{
  if(depth>4) return [];
  const foundLeaks=[];
  try{
    for(const e of fs.readdirSync(dir,{withFileTypes:true})){
      if(e.name.startsWith('.git')||e.name==='node_modules') continue;
      const full=path.join(dir,e.name);
      if(e.isDirectory()) foundLeaks.push(...walkForLeaks(full,depth+1));
      else if(e.name.endsWith('.js')||e.name.endsWith('.html')||e.name.endsWith('.ps1')||e.name.endsWith('.md')){
        try{
          const txt=fs.readFileSync(full,'utf8');
          for(const pat of leakPatterns) if(pat.test(txt) && !full.includes('validate-public-boundary.js')) foundLeaks.push(path.relative(root,full)+':'+pat);
        }catch(e){}
      }
    }
  }catch(e){}
  return foundLeaks;
};
const leaks=walkForLeaks(root);
if(leaks.length) console.warn('WARN: potential private leak patterns found (check manually): '+leaks.slice(0,5).join(', '));
console.log('Public boundary checked: internal board and audit artifacts are absent.');
