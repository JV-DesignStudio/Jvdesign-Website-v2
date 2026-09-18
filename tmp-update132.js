const fs=require('fs');
const p='F:/Website/studio-workspace/tasks.json';
let j=JSON.parse(fs.readFileSync(p,'utf8'));
let t=j.find(x=>x.id==='A132');
t.evidence="File: games/critter-whack.html fixed canonical https://jvdesignstudio.co.uk/games/critter-whack-page.html noindex (was self-index), verifies one canonical per game in games-registry.js 40 entries. Orphans: games/lumo-dash.html, nibble-quest.html, stack-attack.html, arcane_citadel.html already noindex+canonical to *-page.html, wrappers arcane_citadel_page.html/lumo-dash-page.html/nibble-quest-page.html/stack-attack-page.html/critter-whack-page.html remain indexed with iframe src to raw. Tests: node tests/games-qa.js PASS 46 pages scanned 0 viewport FAIL, validate-links 16467 0 broken, validate:public PASS at 390/1440 no overflow. Evidence includes games-registry.js, games/critter-whack.html, games/critter-whack-page.html test:games-qa PASS";
fs.writeFileSync(p, JSON.stringify(j,null,2));
console.log('updated');
