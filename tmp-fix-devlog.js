const fs=require('fs');
const path='devlog-data.js';
let src=fs.readFileSync(path,'utf8');
let m=src.match(/const POSTS = (\[[\s\S]*?\]);/);
if(!m){console.log('no match');process.exit(1);}
let posts;
try{ posts=JSON.parse(m[1]); }catch(e){ console.log('parse fail',e.message); process.exit(1);}
console.log('orig count',posts.length);
// dedupe by id: keep first occurrence of each id
let seen=new Set();
let uniq=[];
for(let p of posts){
  if(seen.has(p.id)) { console.log('dup id',p.id); continue; }
  seen.add(p.id);
  uniq.push(p);
}
console.log('after dedupe',uniq.length);
// fix content: remove duplicate Evidence
for(let p of uniq){
  if(p.content){
    // count Evidence occurrences
    let parts=p.content.split('Evidence:');
    if(parts.length>2){
      // keep first Evidence segment, remove subsequent duplicate Evidence blocks
      // Find where second Evidence starts, keep up to first Evidence end? Actually keep first Evidence, then remove rest
      // Simpler: keep content up to first Evidence + first evidence block, truncate after first evidence block ends at next duplicate start
      // We'll keep first occurrence
      let firstIdx=p.content.indexOf('Evidence:');
      let secondIdx=p.content.indexOf('Evidence:', firstIdx+9);
      if(secondIdx!==-1){
        // find third?
        let thirdIdx=p.content.indexOf('Evidence:', secondIdx+9);
        // keep up to secondIdx (exclude duplicate)
        p.content=p.content.slice(0, secondIdx).trim();
      }
    }
    // also dedupe Evidence string triplication inside content: if content contains same sentence twice exactly, we already truncated
    // also ensure excerpt under 160
    if(p.excerpt && p.excerpt.length>160) p.excerpt=p.excerpt.slice(0,157)+'...';
  }
}
// sort desc by date+id (date string parse)
function pDate(s){
  try{ return new Date(s); }catch{ return new Date(0); }
}
uniq.sort((a,b)=>{
  let da=pDate(a.date), db=pDate(b.date);
  if(db-da!==0) return db-da;
  return b.id - a.id;
});
console.log('sorted first 5 ids',uniq.slice(0,5).map(p=>p.id));
console.log('sorted last 5 ids',uniq.slice(-5).map(p=>p.id));
let out=`// devlog-data.js , single source of truth for all dev log posts
// Edit this file to add, update, or remove posts.
// Both devlog.html and newsletter.html load this automatically.

const POSTS = ${JSON.stringify(uniq, null, 4)};

if (typeof module !== 'undefined') module.exports = { POSTS };
`;
fs.writeFileSync(path, out,'utf8');
console.log('wrote fixed devlog-data.js',uniq.length);
