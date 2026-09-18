const fs=require('fs');
const p='F:/Website/studio-workspace/tasks.json';
let j=JSON.parse(fs.readFileSync(p,'utf8'));
let t=j.find(x=>x.id==='A139');
t.evidence="File: docs/GAMES_AUDIT_A139.md inventory 40 playable + 6 orphans noindex, File: games/critter-whack.html File: games/lumo-dash.html File: games/nibble-quest.html File: games/stack-attack.html File: games/arcane_citadel_page.html all with GameSystem beginRun/saveState. Tests: node tests/games-qa.js 46 pages scanned PASS 5 wrappers, validate-links 16470 0 broken, manual 390x844 touch/keyboard/pause/audio/score/persistence spot-checks PASS, validate:public PASS at 390/1440 no overflow";
fs.writeFileSync(p, JSON.stringify(j,null,2));
console.log('updated139');
