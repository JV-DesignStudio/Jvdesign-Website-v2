const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');
const root = path.join(__dirname, '..');
const port = 19251;
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.json':'application/json','.svg':'image/svg+xml'};
const server = http.createServer((req,res)=>{let url=decodeURIComponent(req.url.split('?')[0]);if(url==='/')url='/index.html';const file=path.normalize(path.join(root,url));if(!file.startsWith(path.normalize(root))){res.writeHead(403);res.end('Forbidden');return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end('Not found');return;}res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'});res.end(data);});});
function listen(){return new Promise(resolve=>server.listen(port, resolve));}
let failures=0;function check(name, ok, detail=''){console.log((ok?'PASS ':'FAIL ')+name+(detail?' — '+detail:''));if(!ok)failures++;}
(async()=>{
 await listen();
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push('pageerror: '+e.message));page.on('console',m=>{if(m.type()==='error'){const text=m.text();if(!/ERR_NETWORK_ACCESS_DENIED|Failed to load resource/.test(text))errors.push('console: '+text);}});
 await page.setViewport({width:390,height:844,isMobile:true});
 await page.goto(`http://127.0.0.1:${port}/tools/story-editor.html`,{waitUntil:'domcontentloaded',timeout:15000});
 await new Promise(r=>setTimeout(r,1000));
 const data=await page.evaluate(()=>{
   try{localStorage.setItem('jvds_story_slots', JSON.stringify([{name:'<img src=x onerror=alert(1)>',nodeCount:2,date:'today',data:{nodes:[],chars:[],vars:[]}}])); renderSaveSlots();}catch(e){}
   return {
     title:document.title,
     skipLinks:document.querySelectorAll('.skip-link').length,
     main:!!document.getElementById('main-content'),
     nodes:document.querySelectorAll('.story-node').length,
     nodeList:document.querySelectorAll('.node-list-item').length,
     cleanText:!/â|Ã|ï|�/.test(document.body.innerText),
     previewBtn:[...document.querySelectorAll('button')].some(b=>b.textContent.includes('▶ Preview')),
     exportFns: ['exportJSON','exportScript','exportGodot','exportUnity','copyPlayLink','sendToGameMaker'].every(k=>typeof window[k]==='function'),
     escapedSlot:(document.getElementById('saveSlots')?.textContent||'').includes('<img src=x') && !document.getElementById('saveSlots')?.querySelector('img'),
     scrollWidth:document.documentElement.scrollWidth,
     clientWidth:document.documentElement.clientWidth
   };
 });
 check('title loads', data.title.includes('Story Editor'), data.title);
 check('single skip link', data.skipLinks===1, String(data.skipLinks));
 check('main target exists', data.main);
 check('starter nodes render', data.nodes>=1, String(data.nodes));
 check('node list renders', data.nodeList>=1, String(data.nodeList));
 check('visible text has no mojibake', data.cleanText);
 check('preview button clean', data.previewBtn);
 check('export/handoff functions exist', data.exportFns);
 check('saved slot name escaped', data.escapedSlot);
 check('mobile does not overflow viewport', data.scrollWidth<=data.clientWidth+2, `${data.scrollWidth}/${data.clientWidth}`);
 check('zero runtime errors', errors.length===0, errors.join(' | '));
 await browser.close(); server.close();
 if(failures){console.log(`\n${failures} FAILURE(S)`);process.exit(1);} console.log('\nALL STORY EDITOR CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
