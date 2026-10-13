/* Formspree AJAX submission with 8s timeout + honeypot + offline check */
const form = document.getElementById('nlForm');
if (form) {
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    var hp=document.getElementById('hp_website');
    if(hp && hp.value){ return; }
    if(typeof navigator!=='undefined' && navigator.onLine===false){
      alert('You appear offline - please check your connection and try again, or email josh-couchman@outlook.com directly.');
      return;
    }
    const btn = form.querySelector('.nl-submit');
    btn.textContent = 'Sending...';
    btn.disabled = true;
    let timeoutId;
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      if(controller) timeoutId = setTimeout(()=> controller.abort(), 8000);
      const res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' },
        signal: controller ? controller.signal : undefined
      });
      if(timeoutId) clearTimeout(timeoutId);
      if (res.ok) {
        document.getElementById('formWrap').style.display = 'none';
        document.getElementById('successMsg').classList.add('show');
      } else {
        btn.textContent = '📬 Subscribe';
        btn.disabled = false;
        alert('Something went wrong , please try again or email josh-couchman@outlook.com directly.');
      }
    } catch(err) {
      if(timeoutId) clearTimeout(timeoutId);
      btn.textContent = '📬 Subscribe';
      btn.disabled = false;
      if(err && err.name === 'AbortError') alert('Request timed out after 8s , please try again.');
      else alert('Network error , please check your connection and try again. You can also email josh-couchman@outlook.com directly.');
    }
  });
}
