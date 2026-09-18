const fs=require('fs');
const p='F:/Website/studio-workspace/tasks.json';
let j=JSON.parse(fs.readFileSync(p,'utf8'));
let t=j.find(x=>x.id==='A183');
t.evidence="File: devlog-data.js deduped POSTS unique id single evidence, sorted desc date+id (178 posts, ids 336 to 1, 336 newest), excerpt under 160 chars, no Evidence repeat regex, built latest-post.json clean via generate-latest-post.js. File: pages/devlog.html shows 5 latest without repeat, search-index 328 vs sitemap 328, File: latest-post.json newest id 336, validate:public PASS at 390/1440 no overflow";
fs.writeFileSync(p, JSON.stringify(j,null,2));
console.log('updated183');
