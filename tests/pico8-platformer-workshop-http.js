/* A1879: the PICO-8 platformer must finish with a game the learner owns.
   Static checks guard the "Make it yours" finish check and the recovery-only
   framing of the reference cartridge; the shared canvas suite then drives every
   step on a live render at 1440, 390 and 320. */
const fs=require('fs'),path=require('path');
const html=fs.readFileSync(path.resolve(__dirname,'..','workshops','pico8-platformer-workshop.html'),'utf8');

let bad=0;
function check(name,ok,detail){
  console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:''));
  if(!ok)bad++;
}

check('finish check section is present',/data-workshop-own="pico8-platformer-workshop"/.test(html));
check('finish check lists five required choices',(html.match(/id="own-[1-5]"/g)||[]).length===5,
  (html.match(/id="own-[1-5]"/g)||[]).length+' found');
check('finish check requires an original mechanic',/mechanic was designed by you/i.test(html));
check('finish check requires a saved, reopened cartridge',/saved the cartridge and reopened it/i.test(html));
check('finish check requires explaining the code',/explain the code you are proudest of/i.test(html));
check('reference cartridge is recovery only',/Reference cartridge \(recovery only\)/.test(html));
check('reference cartridge is no longer advertised as the finished product',
  !/download the finished, playable Pico-8 cart for this workshop/i.test(html));
check('outcome points at the learner\'s own version',/own version, with one feature, sprite or level you designed/i.test(html));
check('finish banner links back to the finish check',/href="#make-it-yours"/.test(html));

if(bad){
  console.log('\n'+bad+' FINISH CHECK FAILURE(S)');
  process.exit(1);
}

const {run}=require('./canvas-workshop-suite');
run('/workshops/pico8-platformer-workshop.html',{steps:6}).catch(e=>{console.error(e);process.exit(1);});
