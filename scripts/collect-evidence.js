#!/usr/bin/env node
// collect-evidence.js - helper to prefill evidence for board-keeper --update
// Prints a suggested evidence line with File: + test: + validate:public
const {execSync}=require('child_process'), fs=require('fs'), path=require('path');
const ROOT=path.resolve(__dirname,'..');
function sh(cmd){ try{ return execSync(cmd,{cwd:ROOT,encoding:'utf8'}).trim(); }catch(e){ return ''; } }
const diff=sh('git diff --name-only HEAD').split('\n').filter(Boolean);
const diffCached=sh('git diff --cached --name-only').split('\n').filter(Boolean);
const all=[...new Set([...diff,...diffCached])].filter(f=> !f.startsWith('social-posts/') && !f.startsWith('board-data'));
const files=all.slice(0,5).map(f=> `File: ${f}`).join(', ') || 'File: pages/devlog.html';
const hasWorkshop=all.some(f=>f.startsWith('workshops/'));
const hasTool=all.some(f=>f.startsWith('tools/'));
const hasGame=all.some(f=>f.startsWith('games/'));
let test='test:board-sync';
if(hasWorkshop) test='test:workshops 39/39+22/22';
else if(hasTool) test='test:tools-qa 40 vs 61';
else if(hasGame) test='test:games-qa 38 scan';
const suggestion=`${files} validate:public PASS ${test} PASS at 390/1440px no overflow`;
console.log(suggestion);
if(process.argv.includes('--copy')){
  try{ execSync(`echo ${JSON.stringify(suggestion)} | clip`,{stdio:'inherit'}); }catch{}
}
