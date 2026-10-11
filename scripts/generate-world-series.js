#!/usr/bin/env node
/*
 * generate-world-series.js
 * Emits the dedicated episode pages for the "World Workshop" series
 * (OpenRCT2, MUGEN, Minecraft) so every episode matches the Stardew/Terraria
 * bar: hero, XP bar, progress, step cards with a goal, a worked list, an
 * optional "fill in the blanks", a quiz gate and a finish banner.
 *
 * Pages are generated from scripts/world-series-data.js using the shared
 * workshop-engine.js, exactly like the hand-written series pages.
 *
 * Run:   node scripts/generate-world-series.js
 * Check: node scripts/generate-world-series.js --check   (CI drift guard)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'workshops');
const BASE = 'https://jvdesignstudio.co.uk';

const SERIES = require('./world-series-data.js');

const NUM_COLORS = ['orange', 'green', 'teal', 'purple', 'pink', 'blue'];

function b64(s) { return Buffer.from(String(s)).toString('base64'); }
function enc(answer) { return b64(encodeURIComponent(answer)); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// A step's fill sentence can contain [answer|size] tokens; each becomes a blank.
function fillSentence(html) {
  return String(html).replace(/\[([^\[\]|]+)\|(\d+)\]/g, (m, a, s) =>
    `<input class="cf-blank" data-a="${enc(a)}" placeholder="Type here..." size="${s}">`);
}

function callout(c) {
  const icon = c.icon || '💡';
  const cls = c.k || 'tip';
  return `  <div class="callout ${cls}" style="margin:0 0 18px">\n    <div class="callout-icon">${icon}</div>\n    <div>${c.html}</div>\n  </div>`;
}

function stepHtml(step, i, total, slug, prevSlug) {
  const n = i + 1;
  const num = step.num || NUM_COLORS[i % NUM_COLORS.length];
  const statusCls = n === 1 ? 'ss-active' : 'ss-todo';
  const statusTxt = n === 1 ? 'Active' : 'Locked';
  const cardCls = n === 1 ? 'step-card open active-step' : 'step-card locked';
  let body = '';
  if (step.goal) body += `      <div class="big-goal">\n        <div class="big-goal-icon">🎯</div>\n        <div class="big-goal-text"><strong>Goal for this step</strong><p>${step.goal}</p></div>\n      </div>\n`;
  if (step.list && step.list.length) {
    body += '      <ul class="steps-list">\n' + step.list.map((li, k) => `        <li><span class="num-badge">${k + 1}</span><span>${li}</span></li>`).join('\n') + '\n      </ul>\n';
  }
  if (step.code) body += `      <pre class="code-block">${esc(step.code)}</pre>\n`;
  if (step.callout) body += callout(step.callout) + '\n';
  if (step.fill) {
    body += `      <div class="concept-fill" id="cf-${n}" data-step="${n}">\n` +
      '        <div class="cf-header">\n          <div class="cf-icon">✏️</div>\n          <div class="cf-title">Fill in the Blanks</div>\n          <div class="cf-xp-badge">+15 XP</div>\n        </div>\n' +
      `        <div class="cf-sentence">${fillSentence(step.fill.sentence)}</div>\n` +
      '        <button class="cf-check-btn" onclick="checkConceptFill(this)">✅ Check Answers</button>\n' +
      '        <div class="cf-feedback"></div>\n      </div>\n';
  }
  if (step.quiz) {
    const q = step.quiz;
    body += `      <div class="quiz-gate" id="quiz-${n}" data-step="${n}" data-k="${b64(String(q.correct))}">\n` +
      '        <div class="quiz-header">\n          <div class="quiz-icon">🧠</div>\n          <div class="quiz-title">Knowledge Check</div>\n          <div class="quiz-xp-badge">+15 XP</div>\n        </div>\n' +
      `        <div class="quiz-question">${q.q}</div>\n` +
      '        <div class="quiz-options">\n' +
      q.opts.map((o, k) => `          <div class="quiz-opt" data-idx="${k}" onclick="selectQuizOpt(this)"><span class="opt-letter">${'ABC'[k]}</span><span>${o}</span></div>`).join('\n') +
      '\n        </div>\n' +
      '        <div class="quiz-feedback"></div>\n' +
      '        <button class="quiz-submit" onclick="checkQuiz(this)">Check Answer</button>\n' +
      `        <button class="quiz-next-btn" onclick="completeStep(${n})">${n < total ? '✅ Correct! Next Step →' : '✅ Finish ' + step.finishWord}</button>\n` +
      '      </div>\n';
  }
  return `  <div class="${cardCls}" id="step-${n}" data-step="${n}">\n` +
    '    <div class="step-header" onclick="toggleStep(this)">\n' +
    `      <div class="step-num sn-${num}">${n}</div>\n` +
    '      <div class="step-title-wrap">\n' +
    `        <div class="step-emoji">${step.emoji || '⭐'}</div>\n` +
    `        <div class="step-title">${step.title}</div>\n` +
    `        <div class="step-blurb">${step.blurb || ''}</div>\n` +
    '      </div>\n' +
    `      <span class="step-status ${statusCls}">${statusTxt}</span>\n` +
    '    </div>\n' +
    '    <div class="step-body">\n' + body + '    </div>\n  </div>';
}

function episodeHtml(series, ep, index, count) {
  const total = ep.steps.length;
  const slug = ep.slug;
  const key = 'jvds-' + slug + '-v2';
  const profile = slug;
  const desc = ep.sub.length > 180 ? ep.sub.slice(0, 177) + '...' : ep.sub;
  const og = `${BASE}/og/${series.og}.png`;
  const page = `${BASE}/workshops/${slug}.html`;
  const prev = index > 0 ? series.episodes[index - 1] : null;
  const next = index + 1 < count ? series.episodes[index + 1] : null;
  const heroBtns = [
    `<a href="#step-1" class="btn-start">${ep.cta || '▶ Start Step 1'}</a>`,
    `<a href="${series.hub}" class="btn-outline">← All Episodes</a>`
  ].join('\n      ');
  const skills = (ep.skills || []).map(s => `<span class="skill-tag"><span>${s[0]}</span> ${s[1]}</span>`).join('\n      ');
  const steps = ep.steps.map((s, i) => stepHtml(s, i, total, slug, prev && prev.slug)).join('\n\n');
  const nextLink = next
    ? `<a href="${next.slug}.html" style="display:inline-block;margin-top:14px;background:#16a34a;color:#fff;font-weight:800;text-decoration:none;padding:10px 18px;border-radius:9px">Next: ${esc(next.title)} →</a>`
    : `<a href="${series.hub}" style="display:inline-block;margin-top:14px;background:#16a34a;color:#fff;font-weight:800;text-decoration:none;padding:10px 18px;border-radius:9px">Back to the ${esc(series.title)} →</a>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<script>(function(){try{var t=localStorage.getItem('jvds-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();</script>
<link rel="manifest" href="../manifest.json">
<meta name="theme-color" content="${series.themeColor}">
<script defer src="../analytics-loader.js"></script>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(ep.title)}: ${esc(ep.heroLine1)} | ${esc(series.title)} | JVDesignStudio</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${page}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="website">
<meta property="og:url" content="${page}">
<meta property="og:title" content="${esc(ep.title)}: ${esc(ep.heroLine1)} | JVDesignStudio">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${og}">
<meta property="og:site_name" content="JVDesignStudio">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${og}">
<link rel="icon" href="../logo.png" type="image/png">
<!-- BUILD:head-icons -->
<!-- /BUILD:head-icons -->

<link rel="preconnect" href="https://www.googletagmanager.com">
<link rel="preconnect" href="https://www.google-analytics.com">
<link rel="stylesheet" href="/assets/fonts/fonts.css">
<link rel="preload" href="../${series.css}?v=1" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="../${series.css}?v=1"></noscript>
<link rel="preload" href="../style-shared.css?v=17" as="style" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="../style-shared.css?v=17"></noscript>
<link rel="stylesheet" href="/style-mascots.css">
<link rel="preload" href="../style-workshop.css?v=17" as="style" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="../style-workshop.css?v=17"></noscript>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Course",
  "name": "${esc(ep.title)}: ${esc(ep.heroLine1)}",
  "description": "${esc(desc)}",
  "provider": { "@type": "Organization", "name": "JVDesignStudio", "url": "https://jvdesignstudio.co.uk" },
  "url": "${page}",
  "isAccessibleForFree": true,
  "educationalLevel": "${esc(ep.level || 'Beginner')}",
  "inLanguage": "en"
}
</script>
<script defer src="../workshop-enhancements.js?v=17"></script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://jvdesignstudio.co.uk/" },
    { "@type": "ListItem", "position": 2, "name": "Workshop", "item": "https://jvdesignstudio.co.uk/workshop" },
    { "@type": "ListItem", "position": 3, "name": "${esc(series.title)}", "item": "${BASE}/workshops/${series.hub}" },
    { "@type": "ListItem", "position": 4, "name": "${esc(ep.title)}", "item": "${page}" }
  ]
}
</script>
  <script src="../migrate-keys.js"></script>
</head>
<body>

<!-- BUILD:nav-content -->
<!-- /BUILD:nav-content -->

<section class="hero" id="main-content">
  <div class="hero-inner">
    <div class="hero-badge">${ep.badge}</div>
    <h1>${esc(ep.heroLine1)}<br><em>${esc(ep.title)}</em></h1>
    <p class="hero-sub">${esc(ep.sub)}</p>
    <div class="hero-pills">
      <span class="pill p-age">👶 ${esc(ep.age || 'Ages 10+')}</span>
      <span class="pill p-time">⏱️ ${esc(ep.mins || '~45 mins')}</span>
      <span class="pill p-tool">${series.pillEmoji} ${esc(series.engine)}</span>
      <span class="pill p-free">✓ Free workshop</span>
    </div>
    <div class="skills-strip">
      ${skills}
    </div>
    <div class="hero-btns">
      ${heroBtns}
    </div>
  </div>
</section>

<div class="xp-wrap">
  <div class="xp-bar">
    <div class="xp-icon">⭐</div>
    <div class="xp-label" id="xpLabel">0 XP</div>
    <div class="xp-track"><div class="xp-fill" id="xpFill"></div></div>
    <div class="xp-level" id="xpLevel">Level 1</div>
    <div class="xp-streak" id="xpStreak"><span class="fire">🔥</span><span id="streakCount">0</span></div>
  </div>
</div>

<div class="progress-wrap">
  <div class="progress-header">
    <span class="progress-label">Your Progress</span>
    <span class="progress-count" id="progressCount">0 / ${total} steps</span>
  </div>
  <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div>
  <div class="step-dots" id="stepDots"></div>
</div>

<main class="workshop">
${(ep.intro || []).map(callout).join('\n')}

${steps}

  <!-- FINISH BANNER -->
  <div class="finish-banner" id="finishBanner">
    <div class="confetti-row">🎉✨🏆🎉</div>
    <div class="finish-title">${esc(ep.finishTitle || 'Episode Complete!')}</div>
    <div class="finish-sub">${esc(ep.finishSub || '')}</div>
    <div class="final-stats">
      <div class="final-stat"><div class="stat-val" id="finalXp">0</div><div class="stat-label">Total XP</div></div>
      <div class="final-stat"><div class="stat-val" id="finalLevel">1</div><div class="stat-label">Level</div></div>
      <div class="final-stat"><div class="stat-val" id="finalStreak">0</div><div class="stat-label">Best Streak</div></div>
      <div class="final-stat"><div class="stat-val" id="finalAccuracy">0%</div><div class="stat-label">Accuracy</div></div>
    </div>
    ${nextLink}
  </div>
</main>

<!-- BUILD:footer-content -->
<!-- /BUILD:footer-content -->

<script>window.WORKSHOP_TOTAL=${total};window.WORKSHOP_KEY='${key}';window.WORKSHOP_PROFILE_ID='${profile}';</script>
<script defer src="workshop-engine.js"></script>
</body>
</html>
`;
}

// The repo's build.js injects the nav/footer/head-icons partials between the
// BUILD markers after generation, so the drift check must ignore the injected
// content and compare only the parts we author.
function normalise(html) {
  return String(html).replace(/<!--\s*BUILD:([\w-]+)\s*-->[\s\S]*?<!--\s*\/BUILD:\1\s*-->/g, '<!-- BUILD:$1 --><!-- /BUILD:$1 -->');
}

function main() {
  const check = process.argv.includes('--check');
  let written = 0, drift = [];
  for (const series of SERIES) {
    series.episodes.forEach((ep, i) => {
      const html = episodeHtml(series, ep, i, series.episodes.length);
      const file = path.join(OUT, ep.slug + '.html');
      let existing = null;
      try { existing = fs.readFileSync(file, 'utf8'); } catch (e) {}
      if (existing !== null && normalise(existing) === normalise(html)) return;
      if (check) { drift.push(ep.slug); return; }
      fs.writeFileSync(file, html);
      written++;
    });
  }
  if (check) {
    if (drift.length) {
      console.log('  [FAIL] world-series drift (' + drift.length + '): ' + drift.slice(0, 6).join(', '));
      process.exit(1);
    }
    console.log('  [PASS] world-series episodes in sync');
    return;
  }
  console.log(`  [OK] world-series: wrote ${written} episode page(s)`);
}

if (require.main === module) main();
module.exports = { main };
