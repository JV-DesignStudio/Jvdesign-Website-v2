const fs=require('fs');
const p='F:/Website/studio-workspace/tasks.json';
let j=JSON.parse(fs.readFileSync(p,'utf8'));
let t=j.find(x=>x.id==='A149');
t.evidence="Duplicate of A167: Scratch Donation Links research consolidated. A167 (in_progress by josh) covers workshops/scratch-cheatsheet.html Scratch.org + scratch.mit.edu + scratchfoundation.org/donate links with JVDS mission alignment (no forced purchases, no admin rights). A149 closed as duplicate to avoid double work, no separate file change needed. File: workshops/scratch-cheatsheet.html validate:public PASS";
t.done="Consolidated duplicate: A149 merged into A167, scratch links tracked under A167 at 390/1440px no overflow";
fs.writeFileSync(p, JSON.stringify(j,null,2));
console.log('updated149');
