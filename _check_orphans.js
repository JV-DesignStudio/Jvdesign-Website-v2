const fs=require('fs'),path=require('path');
function walk(d){let o=[];for(const e of fs.readdirSync(d,{withFileTypes:true})){if(e.isDirectory()&&!['node_modules','.git','quest-board-deploy','questlog-pwa'].includes(e.name))o=o.concat(walk(path.join(d,e.name)));else if(e.isFile()&&e.name.endsWith('.html'))o.push(path.join(d,e.name))}return o}
const files=walk('.');
const combined=files.map(f=>fs.readFileSync(f,'utf8')).join('\n');
const orphans=files.filter(f=>{const n=path.basename(f);return!combined.includes(n)&&n!=='404.html'&&n!=='offline.html'}).map(f=>f.replace(/\\/g,'/').replace(/^\.\//,''));
console.log('Orphans:',orphans.length);
orphans.forEach(f=>console.log(f));
