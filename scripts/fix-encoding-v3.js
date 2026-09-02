const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
let fixed=0;
function walk(dir){
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,e.name);
    if(e.isDirectory()){if(['node_modules','.git','.claude','quest-board-deploy','scripts'].includes(e.name))continue;walk(full)}
    else if(e.name.endsWith('.html')||e.name.endsWith('.js')){
      let c=fs.readFileSync(full,'utf8');
      const orig=c;
      c=c.replace(/\u00E2\u20AC\u201D/g,'\u2014');
      c=c.replace(/\u00E2\u20AC\u201C/g,'\u2013');
      c=c.replace(/\u00E2\u20AC\u2018/g,'\u2018');
      c=c.replace(/\u00E2\u20AC\u2019/g,'\u2019');
      c=c.replace(/\u00E2\u20AC\u2026/g,'\u2026');
      c=c.replace(/\u00E2\u20AC\u2122/g,'\u2122');
      c=c.replace(/\u00E2\u20AC\u2192/g,'\u2192');
      c=c.replace(/\u00E2\u20AC\u2190/g,'\u2190');
      if(c!==orig){
        fs.writeFileSync(full,c,'utf8');
        fixed++;
        console.log('Fixed:',path.relative(ROOT,full));
      }
    }
  }
}
walk(ROOT);
console.log('\nTotal files fixed:',fixed);
