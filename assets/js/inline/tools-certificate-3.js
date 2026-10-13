/* JVDSCert: path-certificate support (A800). Pure helpers are exposed for tests. */
window.JVDSCert = {
 parse: function(search) {
  var q = new URLSearchParams(search || '');
  var items = (q.get('items') || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean);
  return { title: q.get('title') || '', name: q.get('name') || '', path: q.get('path') || '', items: items };
 },
 resolve: function(params, paths, workshops) {
  var byId = {};
  (workshops || []).forEach(function(w){ byId[w.id] = w; });
  var path = null;
  (paths || []).forEach(function(p){ if (p.id === params.path) path = p; });
  var certTitle = params.title;
  var items = params.items.slice();
  if (path) {
   if (path.certificate) certTitle = path.certificate;
   if (!params.items.length) {
    path.levels.forEach(function(l){ (l.workshops || []).forEach(function(w){ items.push(w); }); });
   }
  }
  var itemTitles = items.map(function(id){ return byId[id] ? byId[id].title : id; });
  return { name: params.name, title: certTitle, pathId: params.path, items: items, itemTitles: itemTitles };
 }
};
(function(){
 function $(id){ return document.getElementById(id); }
 var nameInput = $('certName');
 var seriesSelect = $('certSeries');
 var dateInput = $('certDate');
 var nameDisplay = $('certNameDisplay');
 var seriesDisplay = $('certSeriesDisplay');
 var dateDisplay = $('certDateDisplay');
 var itemsWrap = $('certItemsWrap');
 var itemsList = $('certItemsList');

 /* Auto-fill today's date */
 var today = new Date();
 var yyyy = today.getFullYear();
 var mm = String(today.getMonth()+1).padStart(2,'0');
 var dd = String(today.getDate()).padStart(2,'0');
 if (dateInput) dateInput.value = yyyy+'-'+mm+'-'+dd;
 if (dateDisplay) dateDisplay.textContent = 'Date: '+dd+'/'+mm+'/'+yyyy;

 function renderItems(titles) {
  if (!itemsWrap || !itemsList) return;
  itemsList.innerHTML = '';
  titles.forEach(function(t){
   var li = document.createElement('li');
   li.textContent = t;
   itemsList.appendChild(li);
  });
  itemsWrap.hidden = titles.length === 0;
 }
 function applyParams(params, paths, workshops) {
  var data = window.JVDSCert.resolve(params, paths, workshops);
  var name = data.name;
  if (!name) { try { name = localStorage.getItem('jvds-player-name') || ''; } catch (e) { name = ''; } }
  if (name) {
   if (nameInput) nameInput.value = name;
   if (nameDisplay) nameDisplay.textContent = name;
  }
  if (data.title) {
   if (seriesDisplay) seriesDisplay.textContent = data.title;
   if (seriesSelect) {
    var match = Array.prototype.some.call(seriesSelect.options, function(o){ return o.value === data.title; });
    if (match) seriesSelect.value = data.title;
   }
  }
  renderItems(data.itemTitles);
  return data;
 }

 /* Prefill from ?title= ?name= ?path= ?items= (pixel-studio passes ?title=,
    the workshop hub passes ?path= with completed workshop ids). */
 var params = window.JVDSCert.parse(window.location.search);
 if (params.title || params.name || params.path || params.items.length) {
  if (typeof fetch === 'function' && (params.path || params.items.length)) {
   Promise.all([
    fetch('../content/paths.json').then(function(r){ return r.json(); }).catch(function(){ return []; }),
    fetch('../content/workshops.json').then(function(r){ return r.json(); }).catch(function(){ return []; })
   ]).then(function(arr){ applyParams(params, arr[0], arr[1]); }).catch(function(){ applyParams(params, [], []); });
  } else {
   applyParams(params, [], []);
  }
 }

 if (nameInput) nameInput.addEventListener('input', function(){
  if (nameDisplay) nameDisplay.textContent = nameInput.value || 'Your Name';
 });
 if (seriesSelect) seriesSelect.addEventListener('change', function(){
  if (seriesDisplay) seriesDisplay.textContent = seriesSelect.value;
 });
 if (dateInput) dateInput.addEventListener('change', function(){
  var d = new Date(dateInput.value+'T00:00:00');
  var dd2 = String(d.getDate()).padStart(2,'0');
  var mm2 = String(d.getMonth()+1).padStart(2,'0');
  if (dateDisplay) dateDisplay.textContent = 'Date: '+dd2+'/'+mm2+'/'+d.getFullYear();
 });
})();
