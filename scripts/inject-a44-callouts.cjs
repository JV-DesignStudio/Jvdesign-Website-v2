#!/usr/bin/env node
// inject-a44-callouts.cjs — A44 Workshop companion tool callouts
// Adds compact tool-callout before footer on core workshop pages without one.
// Does not interrupt lesson flow (inserted after main/finish banner, before footer).
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const WS=path.join(ROOT,'workshops');

const MAP={
  scratch:{icon:'🎨',head:'Make your own sprites!',desc:'Draw pixel art in Pixel Studio — free, in-browser, no account. Export PNG for Scratch.',href:'/tools/pixel-studio.html',cta:'Try Pixel Studio →',id:'pixel-studio'},
  python:{icon:'🐍',head:'Keep the Pygame cheatsheet handy',desc:'All the syntax in one place — use it beside this workshop while you code.',href:'/tools/python-cheatsheet.html',cta:'Open Pygame Cheatsheet →',id:'python-cheatsheet'},
  roblox:{icon:'🧱',head:'Build in browser, ship to Roblox',desc:'Design block models in BuildLab and export OBJ / RBXM for Studio.',href:'/tools/buildlab.html',cta:'Open BuildLab →',id:'buildlab'},
  browser:{icon:'🌐',head:'Make it playable, then share it',desc:'Prototype the same idea in Arcade Game Maker — no setup, instant share link.',href:'/tools/arcade-game-maker.html',cta:'Try Arcade Game Maker →',id:'arcade-game-maker'},
  prototype:{icon:'🚀',head:'Turn your idea into a prototype',desc:'Plan it in Game Design Studio, then build a playable version in Arcade Game Maker.',href:'/tools/gdd-builder.html',cta:'Open Game Design Studio →',id:'gdd-builder'},
};

function familyOf(file){
  const f=file.toLowerCase();
  if(f.startsWith('scratch-')) return 'scratch';
  if(f.startsWith('python-')) return 'python';
  if(f.startsWith('roblox-')) return 'roblox';
  if(f.startsWith('js-')||f.startsWith('javascript')||f==='space_invaders_tutorial.html') return 'browser';
  if(f==='my-first-browser-game.html') return null; // already has
  if(f.startsWith('my-first-')||f==='build-a-game-15-min.html'||f==='add-your-own-stage.html') return 'prototype';
  return null;
}

function calloutHTML(fam, file){
  const m=MAP[fam];
  return `<!-- A44:tool-callout:${m.id} -->
<section style="max-width:780px;margin:0 auto 40px;padding:0 20px;">
<div class="tool-callout" role="complementary" aria-label="Companion tool for this workshop">
  <div class="tool-callout-inner">
    <div class="tool-callout-icon">${m.icon}</div>
    <div class="tool-callout-body">
      <p class="tool-callout-head">${m.head}</p>
      <p class="tool-callout-desc">${m.desc}</p>
    </div>
    <a href="${m.href}" class="tool-callout-btn">${m.cta}</a>
  </div>
</div>
</section>
`;
}

let targets=fs.readdirSync(WS).filter(f=>f.endsWith('.html')&&f!=='my-progress.html');
let toFix=[];
for(const f of targets){
  const fam=familyOf(f);
  if(!fam) continue;
  const full=path.join(WS,f);
  const c=fs.readFileSync(full,'utf8');
  if(c.includes('tool-callout')||c.includes('A44:tool-callout')) continue;
  // also skip if already has dev-tools large grid? check for python-game-builder etc but we want compact too - but respect A44: if has large grid, still add compact for counting? For now treat as needing compact
  // python-game-builder has large grid but no tool-callout -> we should add
  toFix.push({f,fam});
}
console.log(`A44 candidates: ${toFix.length}`);
toFix.forEach(x=>console.log(` - ${x.f} -> ${x.fam} -> ${MAP[x.fam].id}`));

let injected=0;
for(const {f,fam} of toFix){
  const fp=path.join(WS,f);
  let c=fs.readFileSync(fp,'utf8');
  const snippet=calloutHTML(fam,f);
  // insertion point: before <!-- BUILD:footer-content -->
  const marker='<!-- BUILD:footer-content -->';
  if(c.includes(marker)){
    c=c.replace(marker, snippet+'\n'+marker);
  } else if(c.includes('</main>')){
    c=c.replace('</main>', '</main>\n'+snippet);
  } else if(c.includes('<!-- --- DEV TOOLS CALLOUT --- -->')){
    // for python-game-builder which has large grid before footer, insert compact before that large grid's footer
    c=c.replace('<!-- BUILD:footer-content -->', snippet+'\n<!-- BUILD:footer-content -->');
    if(!c.includes(snippet.trim())){ // fallback
      c=c.replace('</section>\n<!-- BUILD:footer-content -->', '</section>\n'+snippet+'\n<!-- BUILD:footer-content -->');
    }
  } else {
    // fallback before footer tag
    c=c.replace('<footer', snippet+'\n<footer');
  }
  fs.writeFileSync(fp,c,'utf8');
  injected++;
}
console.log(`Injected ${injected} callouts`);
