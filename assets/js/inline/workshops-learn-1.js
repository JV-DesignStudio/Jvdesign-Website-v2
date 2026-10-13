(function(){
  const SK='jvds_teen_stats_v1';
  function load(){ try{ return JSON.parse(localStorage.getItem(SK)) || {visited:[],streak:0,lastDate:null}; }catch(e){ return {visited:[],streak:0,lastDate:null}; } }
  function save(d){ try{ localStorage.setItem(SK, JSON.stringify(d)); }catch(e){} }
  const data = load();

  const today = new Date().toISOString().slice(0,10);
  if(data.lastDate !== today){
    const y = new Date(Date.now()-86400000).toISOString().slice(0,10);
    data.streak = (data.lastDate === y) ? (data.streak||0)+1 : 1;
    data.lastDate = today;
    save(data);
  }

  function render(){
    const strip = document.getElementById('teenStatsStrip');
    if(!strip) return;
    const explored = (data.visited||[]).length;
    const isReturningVisitor = (data.streak||0) > 1;
    strip.style.display = (explored>0 || isReturningVisitor) ? 'inline-flex' : 'none';
    document.getElementById('teenStreakVal').textContent = data.streak||1;
    document.getElementById('teenExploredVal').textContent = explored;
  }
  render();

  document.addEventListener('click', function(e){
    const a = e.target.closest('a[href]');
    if(!a) return;
    const href = a.getAttribute('href');
    if(!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto') || href.includes('learn.html') || href.includes('tiny-learners') || href.includes('learning-lab')) return;
    if(!a.closest('.article-card') && !a.closest('.course-card') && !a.classList.contains('article-read-more')) return;
    if(!data.visited.includes(href)){
      data.visited.push(href);
      save(data);
      render();
    }
  });
})();
