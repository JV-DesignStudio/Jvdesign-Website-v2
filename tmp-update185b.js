const fs=require('fs');
const p='F:/Website/studio-workspace/tasks.json';
let j=JSON.parse(fs.readFileSync(p,'utf8'));
let t=j.find(x=>x.id==='A185');
t.evidence="File: scripts/generate-content-data.js cover populated from og:image (was null) and steps fallback 6 for engine pages, File: content/workshops.json now 0 null covers (was 100+), 33 zero steps only for series/cheatsheet type, hub badge shows steps/duration, File: pages/workshop.html renders covers, File: workshops/blender-cube-workshop.html quiz lesson complet XP. Tests: node validate-workshops.js 39/39 valid 24/24 builder 0 missing, node scripts/generate-content-data.js 185 entries, validate:public PASS at 390/1440 no overflow";
fs.writeFileSync(p, JSON.stringify(j,null,2));
console.log('updated185b');
