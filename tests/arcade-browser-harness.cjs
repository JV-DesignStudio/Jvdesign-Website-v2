const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const ROOT=path.resolve(__dirname,'..');const puppeteer=require('puppeteer');
module.exports=async function run(scenarios){
 const results=[];const server=http.createServer((req,res)=>{const p=path.resolve(ROOT,'.'+decodeURIComponent(req.url.split('?')[0]));if(!p.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end();}fs.readFile(p,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':({'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.webp':'image/webp'})[path.extname(p)]||'application/octet-stream'});res.end(e?'':b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await puppeteer.launch({headless:true});
 try{for(const scene of scenarios){const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});await page.setRequestInterception(true);page.on('request',r=>r.url().startsWith('http://127.0.0.1:')||r.url().startsWith('data:')?r.continue():r.abort());await page.goto('http://127.0.0.1:'+server.address().port+'/games/'+scene.file,{waitUntil:'networkidle0'});await page.evaluate(()=>document.getElementById('cookie-decline')?.click());
 const check=async(name,fn)=>{try{await fn();results.push({game:scene.file,name,pass:true});console.log('PASS '+scene.file+' '+name);}catch(e){results.push({game:scene.file,name,pass:false,error:e.message});console.log('FAIL '+scene.file+' '+name+' '+e.message);}};
 await scene.run(page,check,assert);await check('no uncaught errors',()=>assert.deepEqual(errors,[]));await page.close();}
 }finally{await browser.close();server.close();}
 if(process.env.ARCADE_QA_OUT){fs.mkdirSync(process.env.ARCADE_QA_OUT,{recursive:true});fs.writeFileSync(path.join(process.env.ARCADE_QA_OUT,'depth-results.json'),JSON.stringify(results,null,2));}
 if(results.some(x=>!x.pass))process.exitCode=1;
};
