/* JVDesignStudio workshop step restore (A2037)
   Bespoke step workshops call loadProgress() on boot, which restores XP and the
   completed set, but not the cards themselves. A learner who came back the next
   day saw an empty workshop even though their progress was saved.

   This script is loaded by pages that declare <body data-steps-key="..."> and
   redraws the saved state: completed cards, the next open step, and the finish
   screen when every step is done. It only reads, it never rewrites a learner's
   saved work. */
(function () {
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function restore() {
    var body = document.body;
    if (!body) return;
    var key = body.getAttribute('data-steps-key');
    if (!key) return;

    var data;
    try { data = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return; }
    if (!data || !Array.isArray(data.completed) || !data.completed.length) return;

    var done = {};
    data.completed.forEach(function (n) { done[+n] = true; });

    var cards = document.querySelectorAll('.step-card');
    var total = data.total || cards.length;
    var firstOpen = null;

    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var match = (card.id || '').match(/^step-(\d+)$/);
      if (!match) continue;
      var num = +match[1];

      if (done[num]) {
        card.classList.remove('active-step', 'open', 'locked');
        card.classList.add('completed');
        var status = card.querySelector('.step-status');
        if (status) {
          status.className = 'step-status ss-done';
          status.textContent = '\u2713 Done';
        }
        var bodyEl = card.querySelector('.step-body');
        if (bodyEl) bodyEl.style.display = 'none';
      } else if (!firstOpen) {
        firstOpen = card;
      }
    }

    if (firstOpen) {
      firstOpen.classList.remove('locked');
      firstOpen.classList.add('active-step', 'open');
      var openStatus = firstOpen.querySelector('.step-status');
      if (openStatus && !openStatus.classList.contains('ss-done')) {
        openStatus.className = 'step-status ss-active';
        openStatus.textContent = 'Current';
      }
    }

    if (data.completed.length >= total) {
      var banner = document.getElementById('finishBanner');
      if (!banner) return;
      /* Some pages reveal the banner by adding .show, others by setting
         display. Do both so the finish screen is really on screen. */
      if (typeof window.showFinish === 'function') {
        try { window.showFinish(); } catch (e) {}
      }
      banner.classList.add('show');
      banner.style.display = 'block';
    }
  }

  ready(restore);
})();
