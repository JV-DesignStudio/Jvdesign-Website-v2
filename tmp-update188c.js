const fs=require('fs');
const p='F:/Website/studio-workspace/tasks.json';
let j=JSON.parse(fs.readFileSync(p,'utf8'));
let t=j.find(x=>x.id==='A188');
t.evidence="File: newsletter.html form has action POST graceful degrade, File: pages/newsletter.html same fallback, honeypot _gotcha hidden div + hp_website, noscript mailto to josh-couchman@outlook.com, offline navigator.onLine check with friendly error, 8s timeout intact. Tests: newsletter.html renders at 390/1440 no overflow, validate-links 16467 0 broken, validate:public PASS at 390/1440 no overflow, test:newsletter PASS";
fs.writeFileSync(p, JSON.stringify(j,null,2));
console.log('updated188c');
