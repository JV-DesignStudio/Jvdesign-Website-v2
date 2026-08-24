(function(){
  var CONSENT_KEY = 'jvds-cookie-consent';
  var saved = localStorage.getItem(CONSENT_KEY);

  if(saved === 'accepted'){ grant(); return; }
  if(saved === 'declined'){ return; }

  // Build banner
  var banner = document.createElement('div');
  banner.id = 'cookie-banner';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Cookie consent');
  banner.innerHTML = [
    '<div style="max-width:900px;margin:0 auto;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">',
    '<p style="flex:1;min-width:220px;margin:0;font-size:.85rem;line-height:1.5;color:#403B33;">',
    '🍪 We use <a href="/pages/privacy-policy.html" style="color:#BC4749;font-weight:700;">cookies</a> to understand how people use this site (Google Analytics). No personal data is sold.',
    '</p>',
    '<div style="display:flex;gap:8px;flex-shrink:0;">',
    '<button id="cookie-accept" style="background:#BC4749;color:white;border:none;border-radius:10px;padding:9px 20px;font-weight:700;font-size:.85rem;cursor:pointer;box-shadow:0 3px 0 #9b3a3c;">Accept</button>',
    '<button id="cookie-decline" style="background:transparent;color:#5a5449;border:1.5px solid #D2B48C;border-radius:10px;padding:9px 18px;font-weight:600;font-size:.85rem;cursor:pointer;">Decline</button>',
    '</div>',
    '</div>'
  ].join('');

  Object.assign(banner.style, {
    position:'fixed', bottom:'0', left:'0', right:'0', zIndex:'9999',
    background:'#F0EAD6', borderTop:'2px solid #D2B48C',
    padding:'14px 24px', boxShadow:'0 -4px 20px rgba(64,59,51,.12)',
    fontFamily:'"Inter",sans-serif'
  });

  document.body.appendChild(banner);

  // Reserve space at the bottom of the page so the fixed banner never covers
  // footer links or a page's last interactive elements.
  var prevPad = document.body.style.paddingBottom;
  function reserveSpace(){ document.body.style.paddingBottom = (banner.offsetHeight + 8) + 'px'; }
  function releaseSpace(){ document.body.style.paddingBottom = prevPad; }
  reserveSpace();
  window.addEventListener('resize', reserveSpace);

  function dismiss(){
    window.removeEventListener('resize', reserveSpace);
    releaseSpace();
    banner.remove();
  }

  document.getElementById('cookie-accept').addEventListener('click', function(){
    localStorage.setItem(CONSENT_KEY, 'accepted');
    grant();
    dismiss();
  });

  document.getElementById('cookie-decline').addEventListener('click', function(){
    localStorage.setItem(CONSENT_KEY, 'declined');
    dismiss();
  });

  function grant(){
    if(typeof gtag === 'function'){
      gtag('consent', 'update', {analytics_storage: 'granted'});
    }
  }
})();
