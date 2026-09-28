/* Fidelity tests for workshops/jv-exporter.js, the shared 3D export used by
   every 3D builder.

   The rule these tests exist to protect: whatever the learner builds on the page
   is what lands in the file. So each format is checked for structure, all four
   are checked to agree on triangle count, OBJ and FBX are checked to agree on
   world size, and the GLB is re-imported with Three's own GLTFLoader and
   compared against what collect() measured. If a future change quietly
   rescales, re-pivots or drops parts, these fail.

   Run: node tests/3d-export-fidelity.js
*/
const http=require('http'),fs=require('fs'),path=require('path');
const puppeteer=require('puppeteer');

const root=path.resolve(__dirname,'..');
const PAGE_DIR=path.join(root,'workshops');

// Builders that load the shared exporter, with the group they build into and
// the units their on-page dimensions are authored in.
const TARGETS=[
  { page:'phone-stand-builder', group:'standGroup', units:'mm' },
  { page:'rocket-builder',        group:'rocketGroup', units:'m'  },
  { page:'robot-builder',         group:'robotGroup',  units:'m'  },
  { page:'castle-builder',        group:'castleGroup',   units:'m'  },
  { page:'space-station-builder', group:'stationGroup',  units:'m'  },
  { page:'robot-builder',         group:'robotGroup',    units:'m'  }
];

let failures=0;
function check(name,ok,detail){
  console.log((ok?'PASS ':'FAIL ')+name+(detail?'  '+detail:''));
  if(!ok)failures++;
}

const MIME={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json',
  '.zip':'application/zip','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};

const server=http.createServer((req,res)=>{
  const u=decodeURIComponent(new URL(req.url,'http://x').pathname);
  const f=path.resolve(root,'.'+u);
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end('missing '+u);}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);
});

/* ---------- parsers ---------- */

function parseOBJ(text){
  const v=[],vt=[],vn=[],groups=[],faces=[];
  let cur=null;
  for(const raw of text.split('\n')){
    const l=raw.trim();
    if(l.startsWith('v ')){const p=l.split(/\s+/);v.push([+p[1],+p[2],+p[3]]);}
    else if(l.startsWith('vt ')){const p=l.split(/\s+/);vt.push([+p[1],+p[2]]);}
    else if(l.startsWith('vn ')){const p=l.split(/\s+/);vn.push([+p[1],+p[2],+p[3]]);}
    else if(l.startsWith('o ')){cur=l.slice(2).trim();groups.push(cur);}
    else if(l.startsWith('f ')){
      faces.push(l.split(/\s+/).slice(1).map(x=>{
        const b=x.split('/');
        return {v:+b[0],vt:b[1]?+b[1]:null,vn:b[2]?+b[2]:null};
      }));
    }
  }
  return {v,vt,vn,groups,faces};
}

function parseSTL(text){
  let tris=0;
  for(const l of text.split('\n')) if(l.trim()==='endfacet') tris++;
  return {tris};
}

function parseFBX(text){
  // Objects must all sit inside the Objects: block, matched by brace counting.
  const oi=text.indexOf('Objects:  {');
  let objStart=-1,objEnd=-1;
  if(oi>=0){
    let d=0;
    const start=text.indexOf('{',oi);
    for(let i=start;i<text.length;i++){
      if(text[i]==='{')d++;
      else if(text[i]==='}'){d--;if(d===0){objStart=oi;objEnd=i;break;}}
    }
  }
  let depth=0;
  for(const ch of text){ if(ch==='{')depth++; else if(ch==='}')depth--; }
  const idRe=/(Geometry|Model|Material):\s*(\d+),/g;
  let m,orphans=[];
  while((m=idRe.exec(text))){
    if(!(m.index>=objStart&&m.index<=objEnd)) orphans.push(m[1]+':'+m[2]);
  }
  // FBX packs vertices as "x y z,x y z", not a flat float list.
  const geoms=[];
  let i=objStart;
  while(i<objEnd){
    const hit=/Geometry:\s*\d+,\s*"Geometry::/.exec(text.slice(i,objEnd));
    if(!hit)break;
    const head=i+hit.index;
    const brace=text.indexOf('{',head);
    let d=0,j=brace;
    for(;j<objEnd;j++){ if(text[j]==='{')d++; else if(text[j]==='}'){d--;if(d===0)break;} }
    const block=text.slice(head,j+1);
    i=j+1;
    const name=(block.match(/"Geometry::([^"]*)"/)||[])[1];
    const vm=block.match(/Vertices:\s*\*(\d+)\s*\{\s*a:\s*([\s\S]*?)\}/);
    const pm=block.match(/PolygonVertexIndex:\s*\*(\d+)\s*\{\s*a:\s*([\s\S]*?)\}/);
    if(!vm||!pm){geoms.push({name,err:'missing arrays'});continue;}
    const verts=vm[2].trim().split(',')
      .reduce((acc,g)=>acc.concat(g.trim().split(/\s+/).map(Number)),[]);
    const poly=pm[2].trim().split(',').map(s=>parseInt(s,10));
    const vc=+vm[1]/3;
    let tris=0,badIdx=0,complementOk=true;
    for(let k=0;k<poly.length;k+=3){
      const a=poly[k],b=poly[k+1],c=~poly[k+2];
      if(poly[k+2]>=0)complementOk=false;   // last index of a polygon is ~i
      if(a<0||b<0||c<0||a>=vc||b>=vc||c>=vc)badIdx++;
      tris++;
    }
    geoms.push({name,verts:vc,tris,badIdx,complementOk,points:verts});
  }
  const mn=[Infinity,Infinity,Infinity],mx=[-Infinity,-Infinity,-Infinity];
  for(const g of geoms){
    if(!g.points)continue;
    for(let k=0;k+2<g.points.length;k+=3)for(let q=0;q<3;q++){
      const x=g.points[k+q];
      if(x<mn[q])mn[q]=x; if(x>mx[q])mx[q]=x;
    }
  }
  return {
    braceBalanced:depth===0,
    objBlockFound:objStart>=0,
    orphans,
    geoms,
    unionSize:[0,1,2].map(q=>isFinite(mx[q])?+(mx[q]-mn[q]).toFixed(3):null),
    minY:isFinite(mn[1])?+mn[1].toFixed(3):null,
    models:[...text.matchAll(/Model:\s*\d+,\s*"Model::([^"]*)"/g)].map(m=>m[1]),
    mats:(text.match(/Material:\s*\d+,\s*"Material::/g)||[]).length,
    conns:(text.match(/C:\s*"OO",/g)||[]).length,
    upAxisY:/UpAxis",\s*"int",\s*"Integer",\s*"",\s*1/.test(text),
    unitScale:(text.match(/UnitScaleFactor",\s*"double",\s*"Number",\s*"",\s*([\d.]+)/)||[])[1]
  };
}

function parseGLBHeader(buf){
  const magic=buf.slice(0,4).toString('ascii');
  const version=buf.readUInt32LE(4);
  const jsonLen=buf.readUInt32LE(12);
  const json=JSON.parse(buf.slice(20,20+jsonLen).toString('utf8'));
  // Count per NODE, not per mesh. GLTFExporter reuses one mesh across several
  // nodes when the geometry and material match, so summing over json.meshes
  // undercounts everything that appears more than once.
  let tris=0;
  (json.nodes||[]).forEach(n=>{
    const mesh=json.meshes[n.mesh];
    if(!mesh)return;
    (mesh.primitives||[]).forEach(p=>{
      const a=json.accessors[p.attributes.POSITION];
      const c=p.indices!=null?json.accessors[p.indices].count:a.count;
      tris+=(p.mode==null||p.mode===4)?c/3:c;
    });
  });
  return {magic,version,tris,
    meshes:(json.meshes||[]).length,
    meshNodes:(json.nodes||[]).filter(n=>n.mesh!=null).length,
    namedNodes:(json.nodes||[]).filter(n=>n.name).length,
    hasNormals:(json.meshes||[]).some(m=>m.primitives.some(p=>p.attributes.NORMAL!==undefined))};
}

/* ---------- run ---------- */

(async()=>{
  server.listen(0);
  await new Promise(r=>server.once('listening',r));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});

  // Every 3D builder that exports must load the shared module, or it will keep
  // drifting onto its own bespoke writer.
  const expected=['rocket-builder','robot-builder','pirate-ship-builder','pirate-cannon-builder',
    'steampunk-airship-builder','race-car-builder','submarine-builder','phone-stand-builder',
    'castle-builder','space-station-builder'];
  for(const name of expected){
    const html=fs.readFileSync(path.join(PAGE_DIR,name+'.html'),'utf8');
    check(name+' loads jv-exporter.js', /jv-exporter\.js/.test(html));
  }

  for(const t of TARGETS){
    const page=await browser.newPage();
    const pageErrors=[];
    page.on('pageerror',e=>pageErrors.push(e.message.split('\n')[0].slice(0,120)));
    await page.setRequestInterception(true);
    page.on('request',r=>r.url().startsWith(base)||r.url().startsWith('data:')||r.url().startsWith('blob:')?r.continue():r.abort());
    await page.setViewport({width:1440,height:900});
    await page.goto(base+'/workshops/'+t.page+'.html',{waitUntil:'load'});
    if(await page.$('#cookie-decline')){try{await page.click('#cookie-decline');}catch(e){}}
    await new Promise(r=>setTimeout(r,1200));
    // clear onboarding, then build the whole thing
    await page.evaluate(()=>{
      const b=Array.from(document.querySelectorAll('button'))
        .find(x=>/^(Let's Build!|Accept|Got it)$/i.test(x.textContent.trim())&&x.offsetParent!==null);
      if(b)b.click();
    });
    await new Promise(r=>setTimeout(r,400));
    await page.evaluate(async()=>{
      const hit=re=>{const b=Array.from(document.querySelectorAll('button'))
        .find(x=>re.test(x.textContent)&&x.offsetParent!==null&&!x.disabled);
        if(b){b.click();return true;}return false;};
      if(!hit(/quick build/i)) for(let i=0;i<35&&hit(/^\s*(Next|Continue)\b/i);i++){}
      await new Promise(r=>setTimeout(r,900));
    });
    // Let any trailing rebuild (autosave restore, step Apply) finish before
    // measuring, otherwise the export races the model.
    await new Promise(r=>setTimeout(r,1200));
    // GLTFLoader is only needed here, to prove the GLB we wrote reads back as
    // the model we built. Not shipped to learners.
    await page.addScriptTag({path:path.join(root,'node_modules/three/examples/js/loaders/GLTFLoader.js')});

    const got=await page.evaluate(async(groupVar,units)=>{
      const J=window.JVExporter;
      if(!J) return {err:'JVExporter not loaded'};
      const g=(function(){ try{ return (new Function('return '+groupVar))(); }catch(e){ return null; } })();
      if(!g) return {err:'group '+groupVar+' not found'};

      const asBuilt=J.collect(g,{units:units,name:'Fidelity Test'});
      const out={
        asBuilt:J.summary(asBuilt),
        names:asBuilt.parts.map(p=>p.name)
      };

      // Take every reading before the first await. Anything asynchronous in
      // between gives the page a chance to rebuild, and an antenna length is
      // randomised on every build, so the readings stop describing one model.
      const withPivot=J.collect(g,{units:units,name:'Fidelity Test',pivotToBase:true});
      const again=J.collect(g,{units:units,name:'Fidelity Test'});
      out.pivot=J.summary(withPivot);
      out.pivotSameSize=JSON.stringify(withPivot.size.map(n=>n.toFixed(6)))===
                        JSON.stringify(asBuilt.size.map(n=>n.toFixed(6)));
      out.pivotLandsOnZero=out.pivot.minYInFile===0;
      out.pivotLeavesAsBuiltAlone=out.asBuilt.minYInFile===out.asBuilt.minYAsBuilt;
      out.stable=again.stats.triangles===asBuilt.stats.triangles &&
                 again.stats.parts===asBuilt.stats.parts &&
                 JSON.stringify(again.size.map(n=>n.toFixed(6)))===
                 JSON.stringify(asBuilt.size.map(n=>n.toFixed(6)));
      out.stableDetail=asBuilt.stats.triangles+' tris / '+asBuilt.size.map(n=>n.toFixed(3)).join('x')+
        '  vs  '+again.stats.triangles+' tris / '+again.size.map(n=>n.toFixed(3)).join('x');

      // Generate the GLB from the same group the other three come from.
      const buf=await J.glb(g,asBuilt);
      out.glbBytes=Array.from(new Uint8Array(buf.buffer));

      out.obj=J.obj(asBuilt,'fidelity test');
      out.fbx=J.fbx(asBuilt,'fidelity test').text;
      out.stl=J.stl(asBuilt,'fidelity test').text;

      // Re-import and measure, which is the authoritative scale check.
      out.roundTrip=await new Promise(resolve=>{
        new THREE.GLTFLoader().parse(new Uint8Array(out.glbBytes).buffer,'',gltf=>{
          try{
            gltf.scene.updateMatrixWorld(true);
            const box=new THREE.Box3();
            let tris=0;
            gltf.scene.traverse(o=>{
              if(!o.isMesh)return;
              const q=o.geometry.clone().applyMatrix4(o.matrixWorld);
              const p=q.attributes.position;
              if(p)for(let k=0;k<p.count;k++){
                const x=p.getX(k),y=p.getY(k),z=p.getZ(k);
                if(x<box.min.x)box.min.x=x; if(x>box.max.x)box.max.x=x;
                if(y<box.min.y)box.min.y=y; if(y>box.max.y)box.max.y=y;
                if(z<box.min.z)box.min.z=z; if(z>box.max.z)box.max.z=z;
              }
              if(q.index)tris+=q.index.count/3; else if(p)tris+=p.count/3;
              q.dispose();
            });
            resolve({ok:true,tris,
              size:[box.max.x-box.min.x,box.max.y-box.min.y,box.max.z-box.min.z].map(n=>+n.toFixed(3)),
              minY:+box.min.y.toFixed(3)});
          }catch(e){ resolve({ok:false,err:String(e)}); }
        },err=>resolve({ok:false,err:'parse failed: '+err}));
      });
      return out;
    },t.group,t.units);

    if(got.err){
      check(t.page+' exports',false,got.err);
      await page.close();
      continue;
    }

    const o=parseOBJ(got.obj.obj);
    const mtl=got.obj.mtl;
    const f=parseFBX(got.fbx);
    const s=parseSTL(got.stl);
    const g=parseGLBHeader(Buffer.from(got.glbBytes));

    console.log('\n--- '+t.page+' ('+t.units+', '+got.asBuilt.parts+' parts, '+got.asBuilt.triangles+' triangles) ---');

    check(t.page+': OBJ vertex and normal counts line up',
      o.v.length===o.vn.length&&(o.vt.length===0||o.vt.length===o.v.length),
      'v='+o.v.length+' vn='+o.vn.length+' vt='+o.vt.length);
    check(t.page+': OBJ every face index is in range and every face is a triangle',
      o.faces.every(fr=>fr.length===3&&fr.every(i=>i.v>=1&&i.v<=o.v.length&&i.vn>=1&&i.vn<=o.vn.length)),
      o.faces.length+' faces');
    check(t.page+': OBJ names its parts',o.groups.length===got.asBuilt.parts&&!o.groups.some(x=>/^mesh\d+$/.test(x)),
      o.groups.length+' groups, first "'+o.groups[0]+'"');
    check(t.page+': every exported part has a real name, none fall back to part_N',
      o.groups.every(g=>g&&!/^part_\d+$/.test(g)),
      o.groups.filter(g=>/^part_\d+$/.test(g)).length+' unnamed of '+o.groups.length+
      ' · sample '+JSON.stringify(o.groups.slice(0,4)));
    check(t.page+': OBJ states its units in the header',
      new RegExp('Units: '+(t.units==='mm'?'millimetres':'metres')).test(got.obj.obj));
    check(t.page+': OBJ references an MTL and the MTL defines every material',
      /mtllib/.test(got.obj.obj)&&
      (mtl.match(/^newmtl /gm)||[]).length>0&&
      (mtl.match(/^Kd /gm)||[]).length===(mtl.match(/^newmtl /gm)||[]).length,
      (mtl.match(/^newmtl /gm)||[]).length+' materials');

    const objSize=[0,1,2].map(i=>+(Math.max(...o.v.map(x=>x[i]))-Math.min(...o.v.map(x=>x[i]))).toFixed(3));
    check(t.page+': STL triangle count matches OBJ',s.tris===o.faces.length,'stl='+s.tris+' obj='+o.faces.length);

    check(t.page+': FBX braces balance and has an Objects block',f.braceBalanced&&f.objBlockFound);
    check(t.page+': FBX keeps every object inside the Objects block',f.orphans.length===0,JSON.stringify(f.orphans));
    check(t.page+': FBX has one geometry and one model per part',
      f.geoms.length===got.asBuilt.parts&&f.models.length===got.asBuilt.parts,
      'geo='+f.geoms.length+' model='+f.models.length);
    check(t.page+': FBX polygon indices decode in range and use the complement convention',
      f.geoms.every(x=>!x.err&&x.badIdx===0&&x.complementOk));
    check(t.page+': FBX triangle count matches OBJ',
      f.geoms.reduce((a,x)=>a+(x.tris||0),0)===o.faces.length,
      'fbx='+f.geoms.reduce((a,x)=>a+(x.tris||0),0)+' obj='+o.faces.length);
    check(t.page+': FBX declares Y-up so importers do not rotate the model',f.upAxisY);
    check(t.page+': FBX UnitScaleFactor is 1 so it matches OBJ and GLB scale',f.unitScale==='1','got '+f.unitScale);
    check(t.page+': FBX carries materials and connections',f.mats>0&&f.conns>=(f.geoms.length*2),'mats='+f.mats+' conns='+f.conns);
    check(t.page+': FBX world size matches OBJ exactly',
      f.unionSize.every((v,i)=>Math.abs(v-objSize[i])<0.01),'obj='+JSON.stringify(objSize)+' fbx='+JSON.stringify(f.unionSize));

    check(t.page+': GLB is a valid glTF 2.0 binary',g.magic==='glTF'&&g.version===2,g.magic+' v'+g.version);
    check(t.page+': GLB keeps one node per part',g.meshNodes===got.asBuilt.parts,
      'meshNodes='+g.meshNodes+' parts='+got.asBuilt.parts+' (GLB reuses '+g.meshes+' unique meshes)');
    check(t.page+': GLB triangle count matches OBJ',g.tris===o.faces.length,'glb='+g.tris+' obj='+o.faces.length);
    check(t.page+': GLB carries normals',g.hasNormals);

    // The headline guarantee.
    const rt=got.roundTrip;
    check(t.page+': GLB re-imports at exactly the on-page size',
      rt.ok&&rt.size.every((v,i)=>Math.abs(v-objSize[i])<0.01),
      rt.ok?('reimported='+JSON.stringify(rt.size)+' obj='+JSON.stringify(objSize)):'round trip failed: '+rt.err);
    check(t.page+': GLB re-imports at exactly the on-page triangle count',
      rt.ok&&rt.tris===got.asBuilt.triangles,rt.ok?('reimported='+rt.tris):'round trip failed');
    check(t.page+': GLB re-imports with the same pivot as built',
      rt.ok&&Math.abs(rt.minY-got.asBuilt.minYAsBuilt)<0.01,
      rt.ok?('reimported minY='+rt.minY+' asBuilt='+got.asBuilt.minYAsBuilt):'round trip failed');

    check(t.page+': default export does not move the model',got.pivotLeavesAsBuiltAlone,
      'minY '+got.asBuilt.minYAsBuilt+' -> '+got.asBuilt.minYInFile);
    check(t.page+': opt-in base pivot lands the model on Y=0',got.pivotLandsOnZero,'minYInFile='+got.pivot.minYInFile);
    check(t.page+': opt-in base pivot only translates, never rescales',got.pivotSameSize,
      JSON.stringify(got.pivot.size)+' vs '+JSON.stringify(got.asBuilt.size));

    check(t.page+': the build is stable, so the file matches the screen',got.stable===true,got.stableDetail||'');
    check(t.page+': no runtime errors',pageErrors.length===0,pageErrors.join(' | '));
    await page.close();
  }

  await browser.close();
  server.close();
  if(failures){
    console.log('\n'+failures+' CHECK(S) FAILED');
    process.exit(1);
  }
  console.log('\nALL 3D EXPORT FIDELITY CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
