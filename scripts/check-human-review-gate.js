#!/usr/bin/env node
// check-human-review-gate.js - human_review must be approved before it can go live
// Fails CI if any tasks.json human_review exists, because SHIPPED is the only live contract.
// Run: node scripts/check-human-review-gate.js [--allow] (allow forces pass for local dev)
const fs=require('fs'), path=require('path');
const TASKS_CANDIDATES=[
  path.join(__dirname,'..','..','studio-workspace','tasks.json'),
  'F:/Website/studio-workspace/tasks.json',
  path.join(process.env.HOME||'','studio-workspace','tasks.json')
];
let tasksPath=null;
for(const p of TASKS_CANDIDATES){ if(fs.existsSync(p)){ tasksPath=p; break; } }
if(!tasksPath){
  // A1486: board counts are no longer published in board-data.json, so this gate
  // can only run where the private tasks.json is present (local / pre-publish).
  console.log('check-human-review: no private tasks.json here - human review gate runs locally only, skip');
  process.exit(0);
}
const tasks=JSON.parse(fs.readFileSync(tasksPath,'utf8'));
const hr=tasks.filter(t=>t.status==='human_review');
if(hr.length===0){
  console.log('check-human-review: 0 human_review - ok to publish');
  process.exit(0);
}
if(process.argv.includes('--allow') || process.env.ALLOW_HUMAN_REVIEW==='1'){
  console.log(`check-human-review: ${hr.length} human_review (allowed): ${hr.map(t=>t.id).join(', ')}`);
  process.exit(0);
}
console.error(`\n✗ ${hr.length} task(s) in human_review must be approved before it can go live:`);
hr.forEach(t=> console.error(`  - ${t.id} [${t.priority} ${t.tag}] ${t.title}`));
console.error(`\nHuman review is the live gate: SHIPPED is the only live contract (board/index.html: SHIPPED 149).`);
console.error(`Approve via: board/index.html (👁 Human Review) or: node F:/Website/studio-workspace/board-keeper.cjs --approve <ID> --agent josh`);
console.error(`To bypass for local dev: node scripts/check-human-review-gate.js --allow`);
process.exit(1);
