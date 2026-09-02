const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
let fixed=0;
function walk(dir){
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,e.name);
    if(e.isDirectory()){if(['node_modules','.git','.claude','quest-board-deploy','scripts'].includes(e.name))continue;walk(full)}
    else if(e.name.endsWith('.html')){
      let c=fs.readFileSync(full,'utf8');
      const orig=c;
      // Fix ZWJ sequences in emoji
      c=c.replace(/\u00E2\u20AC\u008D/g,'\u200D');
      c=c.replace(/\u00E2\u20AC(?=[\uD800-\uDBFF\u00F0])/g,'\u200D');
      // Fix bullet
      c=c.replace(/\u00E2\u20AC\u00A2/g,'\u2022');
      // Fix em dash
      c=c.replace(/\u00E2\u20AC\u009D/g,'\u2014');
      // Fix quotes
      c=c.replace(/\u00E2\u20AC\u009C/g,'\u201C');
      c=c.replace(/\u00E2\u20AC\u0099/g,'\u2019');
      c=c.replace(/\u00E2\u20AC\u0098/g,'\u2018');
      c=c.replace(/\u00E2\u20AC\u00A6/g,'\u2026');
      // Fix arrows
      c=c.replace(/\u00E2\u20AC\u0092/g,'\u2192');
      c=c.replace(/\u00E2\u20AC\u0090/g,'\u2190');
      // Fix guillemets
      c=c.replace(/\u00E2\u20AC\u00B9/g,'\u2039');
      c=c.replace(/\u00E2\u20AC\u00BA/g,'\u203A');
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
