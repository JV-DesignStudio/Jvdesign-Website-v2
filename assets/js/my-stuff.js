// A2274: My Stuff shelf - localStorage library across tools
(function(){
  'use strict';
  var TOOLS = [
    {key:'jvds_pixel', tool:'Pixel Studio', icon:'🎨', href:'../tools/pixel-studio.html', type:'sprite',
     label:function(d){return (d.cW||'?')+'×'+(d.cH||'?')+' sprite, '+(d.frames?d.frames.length:1)+' frame'+(d.frames&&d.frames.length!==1?'s':'');}},
    {key:'jvds_sound_auto', tool:'Sound Studio', icon:'🎵', href:'../tools/sound-studio.html', type:'sound',
     label:function(d){return (d.bpm||120)+' BPM, '+(d.tracks?d.tracks.length:0)+' track'+(d.tracks&&d.tracks.length!==1?'s':'');}},
    {key:'jv_arcade_autosave', tool:'Arcade Game Maker', icon:'🕹️', href:'../tools/arcade-game-maker.html', type:'game',
     label:function(d){return '“'+(d.title||'Untitled')+'” - '+(d.genre||'custom');}},
    {key:'jvds-tabletop-v1', tool:'Tabletop Studio', icon:'🎲', href:'../tools/tabletop-studio.html', type:'board',
     label:function(d){return (d.name?String(d.name)+', ':'')+(d.cols||'?')+'×'+(d.rows||'?')+' board, '+(d.tokens?d.tokens.length:0)+' piece'+(d.tokens&&d.tokens.length!==1?'s':'');}}
  ];

  var BOARD_COLORS = {
    grass:'#8FBF6A', water:'#6FA9C9', sand:'#E3CD8F', forest:'#5E8C5A',
    stone:'#B9B4A8', path:'#C9A97D', lava:'#D46A4A', snow:'#EDF2F4', wall:'#6B6257'
  };

  function boardThumb(d){
    try{
      var cols=Math.max(1,Number(d.cols)||12), rows=Math.max(1,Number(d.rows)||9);
      var c=document.createElement('canvas'); c.width=96; c.height=72;
      var x=c.getContext('2d'); if(!x) return '';
      x.fillStyle='#F0EAD6'; x.fillRect(0,0,96,72);
      var cw=96/cols, ch=72/rows;
      for(var r=0;r<rows;r++){
        for(var col=0;col<cols;col++){
          var t=Array.isArray(d.tiles)?d.tiles[r*cols+col]:null;
          if(!t||!BOARD_COLORS[t]) continue;
          x.fillStyle=BOARD_COLORS[t];
          x.fillRect(Math.floor(col*cw), Math.floor(r*ch), Math.ceil(cw)+1, Math.ceil(ch)+1);
        }
      }
      return c.toDataURL();
    }catch(e){ return ''; }
  }

  function readItem(t){
    try{var raw=localStorage.getItem(t.key); if(!raw) return null; return JSON.parse(raw);}catch(e){return null;}
  }

  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

  function renderCard(t,d){
    var li=document.createElement('li');
    li.className='my-stuff-card';
    li.setAttribute('data-type',t.type);
    var thumbHtml='<span class="my-stuff-card-icon" aria-hidden="true">'+t.icon+'</span>';
    if(t.type==='sprite' && d && d.frames && d.frames[0]){
      try{
        var w=d.cW||8, h=d.cH||8;
        var cv=document.createElement('canvas'); cv.width=w; cv.height=h;
        var ctx=cv.getContext('2d');
        var id=ctx.createImageData(w,h);
        id.data.set(new Uint8ClampedArray(d.frames[0][0].slice(0,w*h*4)));
        ctx.putImageData(id,0,0);
        thumbHtml='<img class="my-stuff-card-thumb" src="'+cv.toDataURL()+'" alt="Sprite preview" width="48" height="48">';
      }catch(e){}
    }
    if(t.type==='game' && d && d.sprite){
      thumbHtml='<img class="my-stuff-card-thumb" src="'+esc(d.sprite)+'" alt="Game sprite" width="48" height="48">';
    }
    if(t.type==='board' && d && Array.isArray(d.tiles)){
      var boardImg=boardThumb(d);
      if(boardImg) thumbHtml='<img class="my-stuff-card-thumb" src="'+boardImg+'" alt="Board preview" width="48" height="48">';
    }
    li.innerHTML=thumbHtml+
      '<div class="my-stuff-card-body">'+
        '<strong class="my-stuff-card-name">'+esc(t.tool)+'</strong>'+
        '<span class="my-stuff-card-meta">'+esc(t.label(d))+'</span>'+
      '</div>'+
      '<div class="my-stuff-card-btns">'+
        '<a href="'+t.href+'" class="my-stuff-btn my-stuff-btn--open">Open</a>'+
        '<button class="my-stuff-btn my-stuff-btn--export" data-on="myStuffExportItem" data-on-args="'+t.key+'">Export</button>'+
      '</div>';
    return li;
  }

  function buildShelf(){
    var grid=document.getElementById('myStuffGrid');
    var section=document.getElementById('my-stuff');
    if(!grid||!section) return;
    grid.innerHTML='';
    var count=0;
    TOOLS.forEach(function(t){
      var d=readItem(t);
      if(!d) return;
      grid.appendChild(renderCard(t,d));
      count++;
    });
    if(count>0) section.removeAttribute('hidden');
    else section.setAttribute('hidden','');
  }

  window.myStuffExportItem=function(key){
    try{
      var raw=localStorage.getItem(key);
      if(!raw) return;
      var blob=new Blob([raw],{type:'application/json'});
      var a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download='my-stuff-'+key.replace(/^jvds_|^jv_/,'')+'.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    }catch(e){}
  };

  window.myStuffExportAll=function(){
    try{
      var bundle={v:1,exported:new Date().toISOString(),items:{}};
      TOOLS.forEach(function(t){
        var raw=localStorage.getItem(t.key);
        if(raw) bundle.items[t.key]=JSON.parse(raw);
      });
      if(!Object.keys(bundle.items).length) return;
      var blob=new Blob([JSON.stringify(bundle)],{type:'application/json'});
      var a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download='my-stuff-bundle.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    }catch(e){}
  };

  window.myStuffImportFile=function(input){
    if(!input||!input.files||!input.files[0]) return;
    var reader=new FileReader();
    reader.onload=function(){
      try{
        var bundle=JSON.parse(reader.result);
        if(bundle.v===1 && bundle.items){
          Object.keys(bundle.items).forEach(function(k){
            localStorage.setItem(k,JSON.stringify(bundle.items[k]));
          });
        } else {
          var keys=TOOLS.map(function(t){return t.key;});
          keys.forEach(function(k){
            if(bundle[k]) localStorage.setItem(k, typeof bundle[k]==='string'?bundle[k]:JSON.stringify(bundle[k]));
          });
        }
        buildShelf();
        if(window.showToast) showToast('Imported');
      }catch(e){if(window.showToast) showToast('Import failed','error');}
    };
    reader.readAsText(input.files[0]);
    input.value='';
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',buildShelf);
  else buildShelf();
})();
