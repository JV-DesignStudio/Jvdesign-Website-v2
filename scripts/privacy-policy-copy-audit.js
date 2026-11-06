#!/usr/bin/env node
/*
 * privacy-policy-copy-audit.js
 *
 * Guards the privacy policy copy against drifting into placeholder wording that
 * contradicts how the site is actually built: a static, serverless site with no
 * accounts, localStorage-only saves, and no advertising or tracking networks.
 * The measurement only happens through consent-gated Google Analytics.
 *
 * Run: node scripts/privacy-policy-copy-audit.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const POLICY = path.join(ROOT, 'pages', 'privacy-policy.html');
const html = fs.readFileSync(POLICY, 'utf8');

let failures = 0;
const check = (name, ok, detail) => {
  console.log((ok ? '  [PASS] ' : '  [FAIL] ') + name + (detail && !ok ? '  ' + detail : ''));
  if (!ok) failures++;
};

check('policy describes a serverless architecture', /serverless/i.test(html));
check('policy says there are no accounts', /no accounts/i.test(html));
check('policy says there is no sign-up', /no sign-up/i.test(html));
check('policy describes localStorage saves', /localStorage/i.test(html));
check('policy promises no advertising or tracking networks on the site',
  /no advertising or tracking networks/i.test(html));
check('policy names consent-gated Google Analytics (GA4)',
  /Google Analytics \(GA4\)/i.test(html) && /only if you accept cookies|consent/i.test(html));

const placeholderWording = [
  [/create an account/i, 'asks the reader to create an account'],
  [/account settings/i, 'mentions account settings'],
  [/log in to your account/i, 'mentions logging in to an account'],
  [/when you register/i, 'mentions registration'],
  [/sell your data/i, 'claims to sell data'],
  [/our advertising partners/i, 'mentions advertising partners']
];
for (const [re, what] of placeholderWording) {
  const hit = html.match(re);
  check('no placeholder wording: ' + what, !hit, hit ? '"' + hit[0] + '"' : '');
}

const bodyStart = html.indexOf('<div class="container">');
const bodyEnd = html.indexOf('<!-- BUILD:footer-content -->');
const body = bodyStart >= 0 && bodyEnd > bodyStart ? html.slice(bodyStart, bodyEnd) : html;
check('policy body has no em/en dashes', !/[\u2013\u2014]/.test(body));

console.log(failures === 0
  ? '\nprivacy-policy-copy-audit: PASS'
  : `\nprivacy-policy-copy-audit: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
