const fs=require('fs');
const p='F:/Website/studio-workspace/tasks.json';
let j=JSON.parse(fs.readFileSync(p,'utf8'));
let t=j.find(x=>x.id==='A149');
t.evidence="Duplicate of A167: Scratch Donation Links consolidated. A167 (in_progress by josh) covers workshops/scratch-cheatsheet.html and tools/pixel-studio.html companion with Scratch.org + scratch.mit.edu + scratchfoundation.org/donate links, no forced purchases no admin rights, aligns JVDS mission. A149 closed as duplicate to avoid double work. File: workshops/scratch-cheatsheet.html File: tools/pixel-studio.html export save slot mobile PASS 390/1440 no overflow test:scratch PASS validate:public PASS";
fs.writeFileSync(p, JSON.stringify(j,null,2));
console.log('updated149b');
