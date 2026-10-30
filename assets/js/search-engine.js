(function(){
    var C = window.JVDS_CONTENT || {};
    var catColors = {
        'Workshop': { color:'linear-gradient(135deg,#0a1628,#1a2640)', badgeColor:'#c47f00', emoji:'🎓' },
        'Game':     { color:'linear-gradient(135deg,#0a0a1a,#1a1035)', badgeColor:'#e94560', emoji:'🎮' },
        'Tool':     { color:'linear-gradient(135deg,#0a0a0c,#18101e)', badgeColor:'#7c3aed', emoji:'🛠️' },
        'Book':     { color:'linear-gradient(135deg,#2a2838,#3d3952)', badgeColor:'#6b4fa0', emoji:'📚' },
        'Path':     { color:'linear-gradient(135deg,#1a1400,#2a2200)', badgeColor:'#f5c400', emoji:'🗺️' }
    };

    function buildSearchIndex(){
        var items = [];
        (C.workshops||[]).forEach(function(w){
            items.push({
                title:w.title, cat:'Workshop', emoji:'🎓',
                color:catColors.Workshop.color, badge:'Workshop', badgeColor:catColors.Workshop.badgeColor,
                url:w.url, desc:w.desc, tags:[w.engine,w.difficulty,w.ageRange].filter(Boolean),
                keywords:((w.title||'')+' '+(w.desc||'')+' '+(w.tags||[]).join(' ')+' '+(w.engine||'')).toLowerCase(),
                engine:w.engine, difficulty:w.difficulty, ageRange:w.ageRange
            });
        });
        (C.games||[]).forEach(function(g){
            items.push({
                title:g.title, cat:'Game', emoji:g.emoji||'🎮',
                color:catColors.Game.color, badge:'Game', badgeColor:catColors.Game.badgeColor,
                url:g.url, desc:g.desc, tags:[g.category,g.kids?'Kids':'',g.age||''].filter(Boolean),
                keywords:((g.title||'')+' '+(g.desc||'')+' '+(g.tag||'')+' '+(g.character||'')).toLowerCase(),
                category:g.category, character:g.character
            });
        });
        (C.tools||[]).forEach(function(t){
            items.push({
                title:t.title, cat:'Tool', emoji:'🛠️',
                color:catColors.Tool.color, badge:'Tool', badgeColor:catColors.Tool.badgeColor,
                url:t.url, desc:t.desc, tags:[t.category].concat(t.tags||[]).slice(0,3),
                keywords:((t.title||'')+' '+(t.desc||'')+' '+(t.tags||[]).join(' ')+' '+((t.aliases||[]).join(' '))).toLowerCase(),
                category:t.category
            });
        });
        (C.books||[]).forEach(function(b){
            items.push({
                title:b.title, cat:'Book', emoji:b.emoji||'📚',
                color:catColors.Book.color, badge:b.status==='coming-soon'?'Coming Soon':'Book', badgeColor:catColors.Book.badgeColor,
                url:b.url, desc:b.desc, tags:[b.theme,b.ageRange].filter(Boolean),
                keywords:((b.title||'')+' '+(b.desc||'')+' '+(b.theme||'')+' '+(b.character||'')).toLowerCase(),
                character:b.character
            });
        });
        return items;
    }

    var ALL = buildSearchIndex();

    var activeType = null, activeEngine = null;

    var esc = function(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };

    /* A1769: intent search. A child searches for what they want to do
       ("make a game", "draw a character", "no install"), not for a page
       title. Add plain-language synonyms to each result's searchable text so
       the existing AND ranking keeps working without weaker matches. */
    var STOPWORDS = { a:1, an:1, the:1, to:1, for:1, of:1, my:1, me:1, with:1, and:1, in:1, on:1, how:1, do:1, i:1, can:1, you:1, is:1, it:1, no:1 };
    var RELATED = [
        { re:/pixel|sprite/, words:'art draw drawing character sprite pixel colour color' },
        { re:/art|draw|colour|color/, words:'art draw drawing colour color' },
        { re:/character/, words:'character' },
        { re:/game maker|gdd|game idea|arcade|game design/, words:'make a game game design gdd idea build' },
        { re:/sound|music|audio|sfx|drum|beat/, words:'music sound audio beat song' },
        { re:/3d|model|buildlab|builder|blender/, words:'3d model modelling modeling blender build' },
        { re:/level|map|world|tile/, words:'level map world tile design' },
        { re:/story|narrative|dialogue|comic/, words:'story writing narrative read' },
        { re:/quiz|millionaire|trivia/, words:'quiz trivia questions' },
        { re:/school|chromebook|offline|no install|browser/, words:'school chromebook no install offline' },
        { re:/free|no account/, words:'free no account' },
        { re:/beginner|first|easy|start/, words:'beginner easy first start' },
        { re:/roblox/, words:'roblox lua' },
        { re:/minecraft/, words:'minecraft mod modding' },
        { re:/python/, words:'python pygame code' },
        { re:/unity/, words:'unity c# code' },
        { re:/unreal/, words:'unreal blueprint code' },
        { re:/godot/, words:'godot gdscript code' },
        { re:/scratch/, words:'scratch blocks code' },
        { re:/pico-?8/, words:'pico8 code' },
        { re:/gamemaker|gml/, words:'gamemaker gml code' },
        { re:/gdevelop/, words:'gdevelop code' },
        { re:/defold/, words:'defold lua code' },
        { re:/java|c\+\+|cpp/, words:'java cpp code' },
        { re:/coding|programming|code/, words:'coding code programming' },
        { re:/workshop|course|lesson|tutorial|learn/, words:'learn course lesson tutorial workshop' },
        { re:/tool|studio|maker|generator|editor|designer/, words:'tool create make build' },
        { re:/book|read/, words:'read book story' }
    ];
    var INTENT_RULES = [
        { re:/pixel|sprite/, cat:'Tool', words:'pixel sprite art' },
        { re:/character|sprite/, cat:'Tool', words:'character draw' },
        { re:/sound|audio|music|sfx|drum|beat/, cat:'Tool', words:'music sound audio beat song' },
        { re:/game maker|gdd|game idea|arcade game maker/, words:'make a game game maker game design' },
        { re:/school|chromebook|no install|offline/, words:'school chromebook no install offline' },
        { re:/roblox/, words:'roblox lua' },
        { re:/minecraft/, words:'minecraft mod modding' },
        { re:/python/, words:'python code' },
        { re:/unity/, words:'unity code' },
        { re:/unreal/, words:'unreal code' },
        { re:/godot/, words:'godot code' },
        { re:/scratch/, words:'scratch code' }
    ];
    function enrichKeywords(item){
        var text = ((item.title||'') + ' ' + (item.desc||'') + ' ' + (item.url||'') + ' ' + (item.tags||[]).join(' ')).toLowerCase();
        var extra = [], intent = [];
        RELATED.forEach(function(r){ if(r.re.test(text)) extra.push(r.words); });
        INTENT_RULES.forEach(function(r){ if(r.re.test(text) && (!r.cat || item.cat === r.cat)) intent.push(r.words); });
        item.keywords = ((item.keywords||'') + ' ' + extra.join(' ')).toLowerCase();
        item.intent = ((item.intent||'') + ' ' + intent.join(' ')).toLowerCase();
        return item;
    }
    ALL.forEach(enrichKeywords);

    function renderAll(list, query){
        var grid = document.getElementById('resultsGrid');
        var empty = document.getElementById('emptyState');
        var countEl = document.getElementById('resultsCount');
        grid.innerHTML = '';
        if(list.length===0){grid.style.display='none';empty.classList.add('show');}
        else{grid.style.display='';empty.classList.remove('show');}
        if(countEl){
            if(query){
                countEl.textContent = '';
                var frag = document.createDocumentFragment();
                frag.appendChild(document.createTextNode('Found '));
                var sp = document.createElement('span'); sp.textContent = list.length; frag.appendChild(sp);
                frag.appendChild(document.createTextNode(' result'+(list.length!==1?'s':'')+' for "'));
                var qEl = document.createElement('strong'); qEl.textContent = query; frag.appendChild(qEl);
                frag.appendChild(document.createTextNode('"'));
                countEl.appendChild(frag);
            } else countEl.innerHTML = 'Showing all <span>'+list.length+'</span> projects';
        }
        list.forEach(function(p){
            var card = document.createElement('a');
            card.href = p.url;
            card.className = 'result-card';
            card.innerHTML =
                '<div class="rc-thumb" style="background:'+esc(p.color)+';">'+esc(p.emoji)+'<span class="rc-badge" style="background:'+esc(p.badgeColor)+';">'+esc(p.badge)+'</span></div>'+
                '<div class="rc-body">'+
                    '<div class="rc-cat">'+esc(p.cat)+'</div>'+
                    '<div class="rc-title">'+esc(p.title)+'</div>'+
                    '<div class="rc-desc">'+esc(p.desc)+'</div>'+
                    '<div class="rc-tags">'+p.tags.map(function(t){return '<span class="rc-tag">'+esc(t)+'</span>';}).join('')+'</div>'+
                    '<span class="rc-cta">View Project →</span>'+
                '</div>';
            grid.appendChild(card);
        });
    }

    function doSearch(){
        var q = document.getElementById('searchInput').value.toLowerCase().trim();
        document.getElementById('clearBtn').classList.toggle('visible', q.length>0);
        var pool = ALL;
        if(window.SITE_INDEX) pool = pool.concat(window.SITE_INDEX);
        if(!q && !activeType && !activeEngine){renderAll(ALL,'');return;}
        var terms = /\bno install/.test(q)
            ? ['no install']
            : q.split(/\s+/).filter(function(t){return t && !STOPWORDS[t];});
        var seen = {};
        var scored = [];
        pool.forEach(function(p){
            var u = p.url.replace(/^(\.\.\/)+/,'');
            if(seen[u]) return; seen[u]=1;
            if(activeType && p.cat !== activeType) return;
            if(activeEngine && (!p.engine || p.engine !== activeEngine)) return;
            if(!terms.length){scored.push({p:p,s:0});return;}
            var t = (p.title||'').toLowerCase();
            var d = (p.desc||'').toLowerCase();
            var k = (p.keywords||'').toLowerCase();
            var intent = (p.intent||'').toLowerCase();
            var c = (p.cat||'').toLowerCase();
            var tags = (p.tags||[]).map(function(x){return String(x).toLowerCase();});
            var score = 0;
            for(var i=0;i<terms.length;i++){
                var term = terms[i], hit = 0;
                if(t.indexOf(term)!==-1) hit = 5;
                else if(intent.indexOf(term)!==-1) hit = 4;
                else if(k.indexOf(term)!==-1) hit = 3;
                else if(d.indexOf(term)!==-1) hit = 2;
                else if(tags.some(function(x){return x.indexOf(term)!==-1;})) hit = 2;
                else if(c.indexOf(term)!==-1) hit = 1;
                if(!hit) return;
                score += hit;
                if(intent.indexOf(term)!==-1) score += 3;
                if(t.indexOf(term)===0 || t.indexOf(' '+term)!==-1) score += 2;
            }
            if(/\bno install/.test(q) && /school|chromebook/.test(t)) score += 6;
            if(/\bmusic\b/.test(q) && /sound|audio|music/.test(t)) score += 5;
            if(/\bdraw\b/.test(q) && /pixel|character|sprite/.test(t)) score += 5;
            scored.push({p:p,s:score});
        });
        scored.sort(function(a,b){return b.s-a.s;});
        renderAll(scored.map(function(x){return x.p;}), q);
    }

    function quickSearch(term, chip){
        document.querySelectorAll('.tag-chip').forEach(function(c){c.classList.remove('active');});
        if(chip) chip.classList.add('active');
        document.getElementById('searchInput').value = term;
        doSearch();
    }

    window.quickSearch = quickSearch;

    function showAllResults(){ quickSearch('',null); document.getElementById('searchInput').value=''; }
    window.showAllResults = showAllResults;

    function filterType(type, btn){
        if(activeType === type){ activeType = null; btn.classList.remove('active'); }
        else {
            document.querySelectorAll('.filter-type-btn').forEach(function(b){b.classList.remove('active');});
            activeType = type;
            btn.classList.add('active');
        }
        doSearch();
    }

    function filterEngine(engine, btn){
        if(activeEngine === engine){ activeEngine = null; btn.classList.remove('active'); }
        else {
            document.querySelectorAll('.filter-engine-btn').forEach(function(b){b.classList.remove('active');});
            activeEngine = engine;
            btn.classList.add('active');
        }
        doSearch();
    }

    window.filterType = filterType;
    window.filterEngine = filterEngine;

    function clearSearch(){
        document.getElementById('searchInput').value='';
        document.getElementById('clearBtn').classList.remove('visible');
        document.querySelectorAll('.tag-chip,.filter-type-btn,.filter-engine-btn').forEach(function(c){c.classList.remove('active');});
        activeType = null; activeEngine = null;
        renderAll(ALL,'');
    }
    window.clearSearch = clearSearch;

    /* Full-site index augmentation */
    (function(){
        var CAT_STYLE = {
            'games':     { cat:'Game',    emoji:'🎮', color:'linear-gradient(135deg,#0a0a1a,#1a1035)', badgeColor:'#4e7d80' },
            'workshops': { cat:'Workshop',emoji:'🎓', color:'linear-gradient(135deg,#0a1628,#1a2640)', badgeColor:'#c47f00' },
            'books':     { cat:'Book',    emoji:'📚', color:'linear-gradient(135deg,#2a2838,#3d3952)', badgeColor:'#6b4fa0' },
            'tools':     { cat:'Tool',    emoji:'🛠️', color:'linear-gradient(135deg,#0a0a0c,#18101e)', badgeColor:'#7c3aed' },
            'pages':     { cat:'Page',    emoji:'📄', color:'linear-gradient(135deg,#1a1a24,#2a2838)', badgeColor:'#5a5449' }
        };
        var norm = function(u){return u.replace(/^(\.\.\/)+/,'').replace(/^\//,'');};
        var known = {};
        ALL.forEach(function(p){known[norm(p.url)]=1;});
        var inferEngine = function(p){
            var haystack = ((p.url||'')+' '+(p.title||'')+' '+(p.desc||'')).toLowerCase();
            if(haystack.indexOf('godot')!==-1||haystack.indexOf('gdscript')!==-1) return 'Godot';
            if(haystack.indexOf('unity')!==-1||haystack.indexOf('c#')!==-1) return 'Unity';
            if(haystack.indexOf('unreal')!==-1||haystack.indexOf('blueprint')!==-1) return 'Unreal';
            if(haystack.indexOf('scratch')!==-1) return 'Scratch';
            if(haystack.indexOf('python')!==-1||haystack.indexOf('pygame')!==-1) return 'Python';
            if(haystack.indexOf('roblox')!==-1||haystack.indexOf('lua')!==-1) return 'Roblox';
            return '';
        };
        window.SITE_INDEX = [];
        fetch('/search-index.json').then(function(r){return r.ok?r.json():Promise.reject();}).then(function(idx){
            window.SITE_INDEX = (idx.pages||[]).filter(function(p){return !known[p.url];}).map(function(p){
                var parts = p.url.split('/');
                var style = CAT_STYLE[parts[0]] || CAT_STYLE['pages'];
                var fileName = (parts[parts.length-1]||'').replace(/\.html$/,'').replace(/-/g,' ');
                var engine = inferEngine(p);
                return {
                    title: p.title || fileName, cat: style.cat, emoji: style.emoji,
                    color: style.color, badge: style.cat, badgeColor: style.badgeColor,
                    url: '/' + p.url, desc: p.desc || 'Part of the free JVDesignStudio collection.',
                    tags: [style.cat, engine].filter(Boolean), keywords: (p.title+' '+p.desc+' '+p.url+' '+((p.aliases||[]).join(' '))).toLowerCase(),
                    engine: engine
                };
            }).map(enrichKeywords);
            if(document.getElementById('searchInput').value.trim()) doSearch();
        }).catch(function(){});
    })();

    document.getElementById('searchInput').addEventListener('input', doSearch);

    window.addEventListener('DOMContentLoaded', function(){
        var saved = localStorage.getItem('jvds-theme');
        if(saved==='dark'){document.documentElement.setAttribute('data-theme','dark');}
        var revealObs = new IntersectionObserver(function(entries){
            entries.forEach(function(entry){
                if(entry.isIntersecting){entry.target.classList.add('visible');revealObs.unobserve(entry.target);}
            });
        },{threshold:0.06});
        document.querySelectorAll('.reveal').forEach(function(el){revealObs.observe(el);});
        renderAll(ALL,'');
        var params = new URLSearchParams(window.location.search);
        var q = params.get('q');
        if(q){document.getElementById('searchInput').value=q;doSearch();}
        else document.getElementById('searchInput').focus();
    });
})();
