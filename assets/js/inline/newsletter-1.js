/* A3157: hide the fallback signup once the Beehiiv iframe loads, and send the
   fallback email form without leaving the page when fetch is available. */
(function () {
  var embed = document.getElementById('beehiiv-embed');
  var fallback = document.getElementById('nlFallback');
  var form = document.getElementById('nlFallbackForm');
  var status = document.getElementById('nlFallbackStatus');

  function markReady() {
    if (fallback) fallback.classList.add('is-ready');
  }

  if (embed && fallback) {
    if (embed.querySelector('iframe')) {
      markReady();
    } else if (typeof MutationObserver !== 'undefined') {
      var observer = new MutationObserver(function () {
        if (embed.querySelector('iframe')) {
          markReady();
          observer.disconnect();
        }
      });
      observer.observe(embed, { childList: true, subtree: true });
    }
  }

  if (!form || !status) return;

  form.addEventListener('submit', function (event) {
    if (!window.fetch) return;
    event.preventDefault();
    status.className = 'nl-fallback-status';
    status.textContent = 'Sending...';
    fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' }
    }).then(function (response) {
      if (!response.ok) throw new Error('form failed');
      return response.json().catch(function () { return {}; });
    }).then(function () {
      form.reset();
      status.className = 'nl-fallback-status ok';
      status.textContent = 'Thanks. You are on the list, look out for the confirmation email.';
    }).catch(function () {
      status.className = 'nl-fallback-status err';
      status.textContent = 'That did not send. Please use the direct sign-up link above, or try again.';
    });
  });
})();
