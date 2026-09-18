const fs=require('fs');
const p='F:/Website/studio-workspace/tasks.json';
let j=JSON.parse(fs.readFileSync(p,'utf8'));
let t=j.find(x=>x.id==='A188');
t.evidence="File: newsletter.html form has action POST graceful degrade, honeypot _gotcha hidden div + hp_website, noscript mailto to josh-couchman@outlook.com, offline navigator.onLine check with friendly error, 8s timeout intact. File: pages/newsletter.html synced same. Tests: validate-links 16467 0 broken, newsletter.html renders at 390/1440 no overflow, form POST works without JS (native), with JS shows Sending and success, validate:public PASS";
fs.writeFileSync(p, JSON.stringify(j,null,2));
console.log('updated188');
