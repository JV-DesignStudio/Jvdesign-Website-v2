/* analytics-loader.js , single source of truth for GA4 bootstrap.
 *
 * Replaces the two inline <script> tags that were previously pasted into the
 * <head> of every page. Preserves the exact original behaviour and ordering:
 *   1. init dataLayer + gtag()
 *   2. Consent Mode v2 default = denied (set BEFORE anything is sent)
 *   3. gtag('js') / gtag('config')
 *   4. async-load the gtag library, which then drains the queued calls
 *
 * cookie-consent.js flips analytics_storage to 'granted' on user accept.
 *
 * To change the property, edit GA_MEASUREMENT_ID here , one place, not 248 pages.
 */
(function () {
  var GA_MEASUREMENT_ID = 'G-3JBXCCNY4C';

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;

  // Consent Mode v2 - default denied until explicit choice
  gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied' });
  gtag('js', new Date());

  function hasConsent(){
    try{
      var c=document.cookie.match(/(?:^|; )jvds-cookie-consent=([^;]*)/);
      if(c && decodeURIComponent(c[1])==='accepted') return true;
      if(localStorage.getItem('jvds-cookie-consent')==='accepted') return true;
    }catch(e){}
    return false;
  }

  function loadGtag(){
    if(window._gtagLoaded) return;
    window._gtagLoaded=true;
    gtag('config', GA_MEASUREMENT_ID, { anonymize_ip: true });
    var s=document.createElement('script');
    s.async=true;
    s.src='https://www.googletagmanager.com/gtag/js?id='+GA_MEASUREMENT_ID;
    document.head.appendChild(s);
  }
  window._loadGtag=loadGtag;

  // Only load the external gtag library after explicit accept
  if(hasConsent()){
    gtag('consent','update',{analytics_storage:'granted'});
    loadGtag();
  }
  // cookie-consent.js will call window._loadGtag() on accept
})();
