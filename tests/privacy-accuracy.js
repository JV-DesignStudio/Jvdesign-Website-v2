#!/usr/bin/env node
/* A1435 privacy accuracy guard.

   1. The public policy must keep describing what the site actually does:
      consent-gated GA4, localStorage saves, the Formspree forms (newsletter,
      contact, feedback), children, and the per-app policies.
   2. No page may load Google Analytics directly. Every page goes through
      analytics-loader.js, which defaults consent to denied.

   Run: node tests/privacy-accuracy.js
*/
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let fails = 0;
const check = (n, ok, d = '') => { console.log('  ' + (ok ? '[PASS] ' : '[FAIL] ') + n + (d ? '  ' + d : '')); if (!ok) fails++; };

const policy = fs.readFileSync(path.join(ROOT, 'pages', 'privacy-policy.html'), 'utf8');
for (const [name, re] of [
  ['policy names Google Analytics (GA4)', /Google Analytics \(GA4\)/i],
  ['policy explains cookie consent', /consent/i],
  ['policy describes localStorage saves', /localStorage/i],
  ['policy describes the contact form', /contact form/i],
  ['policy describes the feedback form', /feedback form/i],
  ['policy describes the newsletter', /newsletter/i],
  ['policy discloses Formspree', /Formspree/i],
  ['policy has a children section', /children/i],
  ['policy links the per-app policies', /arcade-privacy/],
]) check(name, re.test(policy));

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) return /node_modules|\.git|\.claude|\.worktrees|quest-board-deploy|tmp|vendor/.test(e.name) ? [] : walk(p);
  return e.name.endsWith('.html') ? [p] : [];
});

const gtagDirect = /googletagmanager\.com\/gtag\/js/;
const offenders = walk(ROOT).filter((f) => gtagDirect.test(fs.readFileSync(f, 'utf8')));
check('no page loads gtag.js directly, only analytics-loader.js', offenders.length === 0, offenders.slice(0, 4).map((f) => path.relative(ROOT, f)).join(', '));

const loader = fs.readFileSync(path.join(ROOT, 'analytics-loader.js'), 'utf8');
check('analytics-loader defaults consent to denied', /analytics_storage:\s*'denied'/.test(loader));
check('analytics-loader only loads gtag after consent', /hasConsent|_loadGtag/.test(loader));

const q = fs.readFileSync(path.join(ROOT, 'questlog-pwa', 'privacy-policy.html'), 'utf8');
check('QuestLog policy uses the consent-gated loader', /analytics-loader\.js/.test(q) && !gtagDirect.test(q));
check('QuestLog policy loads the cookie banner', /cookie-consent\.js/.test(q));

console.log(fails ? `\nprivacy-accuracy: FAIL (${fails})` : '\nprivacy-accuracy: PASS');
process.exit(fails ? 1 : 0);
