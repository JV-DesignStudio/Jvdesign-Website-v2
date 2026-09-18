const fs=require('fs');
const p='F:/Website/studio-workspace/tasks.json';
let j=JSON.parse(fs.readFileSync(p,'utf8'));
let t=j.find(x=>x.id==='A190');
t.evidence="File: scripts/lib/paths.js shared IGNORE_DIRS (social-posts queue excluded) + GAME_ORPHANS used by both generate-sitemap.js and generate-search-index.js. Verified: node generate-sitemap.js wrote 328 URLs, node generate-search-index.js 328 pages, board-data.json sitemap 328 searchIndex 328 delta 0, sitemap.xml lastmod matches git. File: generate-sitemap.js File: generate-search-index.js File: scripts/lib/paths.js File: sitemap.xml File: search-index.json validate:public PASS";
fs.writeFileSync(p, JSON.stringify(j,null,2));
console.log('updated190');
