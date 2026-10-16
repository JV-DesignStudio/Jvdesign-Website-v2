#!/usr/bin/env node
/*
 * scripts/generate-engine-hubs.js (A1540)
 *
 * Renders one engine hub page per engine: workshops/engine-<id>.html
 * from content/engine-hubs.json joined with content/workshops.json.
 *
 * The config holds the order and the words (sections, series, curated outcome
 * notes); titles, links, difficulty and age always come from the workshop data,
 * so a hub can never drift from the catalogue. Each workshop id appears in one
 * section only, so nothing is repeated on the page.
 *
 * The page ships finished: nav/footer partials are inlined and the CSP gets
 * per-page script hashes (same result as build.js + scripts/csp-hashes.js), so
 * the output is self-contained and stable under a later `npm run build`.
 *
 * Run:   node scripts/generate-engine-hubs.js
 * Check: node scripts/generate-engine-hubs.js --check   (CI, no writes)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const CONFIG = path.join(ROOT, 'content', 'engine-hubs.json');
const WORKSHOPS = path.join(ROOT, 'content', 'workshops.json');
const PARTIALS = path.join(ROOT, 'partials');
const OUTDIR = path.join(ROOT, 'workshops');
const SITE = 'https://jvdesignstudio.co.uk';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function readPartial(name) {
  return fs.readFileSync(path.join(PARTIALS, name + '.html'), 'utf8').trim();
}

function marker(name, content) {
  return '<!-- BUILD:' + name + ' -->\n' + content + '\n<!-- /BUILD:' + name + ' -->';
}

// Same transform scripts/csp-hashes.js applies: hash every inline script and
// fold the hashes into the page CSP (drops 'unsafe-inline').
function applyCsp(page) {
  const cspRx = /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")(.*?)(")/i;
  const m = cspRx.exec(page);
  if (!m) return page;
  const hashes = [];
  const scriptRx = /<script(?!\s[^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi;
  let s;
  while ((s = scriptRx.exec(page))) {
    const body = s[1];
    if (!body.trim()) continue;
    hashes.push("'sha256-" + crypto.createHash('sha256').update(body.replace(/\r\n?/g, '\n')).digest('base64') + "'");
  }
  const hashStr = hashes.length ? ' ' + [...new Set(hashes)].join(' ') : '';
  const csp = m[2].replace(/script-src\s[^;]*/, (dir) => {
    let d = dir.replace(/\s*'unsafe-inline'\s*/g, ' ').replace(/\s*'sha256-[^']*'\s*/g, ' ').replace(/\s+/g, ' ').trim();
    if (hashStr) d = d.replace(/^(script-src\s+'self')/, '$1' + hashStr);
    return d;
  });
  return page.replace(m[0], m[1] + csp + m[3]);
}

function load() {
  const config = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  const workshops = JSON.parse(fs.readFileSync(WORKSHOPS, 'utf8'));
  const byId = new Map(workshops.map((w) => [w.id, w]));
  return { config, byId };
}

// Honest age band across everything shown, e.g. "Ages 7 and up" or "Ages 7 to 14".
function ageBand(ids, byId) {
  let min = Infinity, max = 0, open = false;
  for (const id of ids) {
    const w = byId.get(id);
    if (!w || !w.ageRange) continue;
    const m = String(w.ageRange).match(/(\d+)/g);
    if (!m) continue;
    const lo = parseInt(m[0], 10);
    min = Math.min(min, lo);
    if (/\+/.test(w.ageRange)) open = true;
    else if (m[1] != null) max = Math.max(max, parseInt(m[1], 10));
    else max = Math.max(max, lo);
  }
  if (min === Infinity) return '';
  return open ? 'Ages ' + min + ' and up' : 'Ages ' + min + ' to ' + max;
}

function coverFor(w, engine) {
  if (w.cover) {
    return '<img class="course-cover" src="' + esc(w.cover) + '" alt="" width="480" height="270" loading="lazy" decoding="async">';
  }
  return '<span class="course-cover course-cover--browser" aria-hidden="true">' + engine.emoji + '</span>';
}

function card(w, engine, opts) {
  const href = w.id + '.html';
  const meta = [engine.engine, cap(w.difficulty), 'Ages ' + w.ageRange].filter(Boolean).join(' · ');
  const tag = opts.badge ? opts.badge + ' · ' + meta : meta;
  const desc = (w.desc && w.desc.trim()) ? w.desc : (opts.note || ('A guided ' + engine.name + ' build-along.'));
  const install = opts.install === true ? 'true' : 'false';
  return '      <a href="' + esc(href) + '" class="course-card" data-install="' + install + '" data-level="' + esc(w.difficulty) + '">\n'
    + '        ' + coverFor(w, engine) + '\n'
    + '        <div class="course-body">\n'
    + '          <div class="course-tag">' + esc(tag) + '</div>\n'
    + '          <div class="course-title">' + esc(w.title) + '</div>\n'
    + '          <div class="course-desc">' + esc(desc) + '</div>\n'
    + '        </div>\n'
    + '      </a>';
}

function installPill(install, engine) {
  if (install === true) return '<span class="hub-install hub-install--app">Needs the free ' + esc(engine.name) + ' app</span>';
  if (install === false) return '<span class="hub-install hub-install--none">Nothing to install</span>';
  return '';
}

function sectionHead(icon, title, blurb, pill, count, id) {
  return '  <div class="ws-section-head">\n'
    + '    <span class="ws-section-icon" aria-hidden="true">' + icon + '</span>\n'
    + '    <div>\n'
    + '      <h2 class="ws-section-label" id="' + id + '">' + esc(title) + '</h2>\n'
    + (blurb ? '      <p class="ws-section-sub">' + esc(blurb) + '</p>\n' : '')
    + (pill ? '      ' + pill + '\n' : '')
    + '    </div>\n'
    + (count ? '    <span class="ws-section-count">' + esc(count) + '</span>\n' : '')
    + '  </div>';
}

function say(voice, engine) {
  const line = engine[voice];
  if (!line) return '';
  const img = '<img src="/assets/mascots/' + voice + '-badge.webp" alt="' + cap(voice) + '" width="38" height="38" loading="lazy">';
  return '  <div class="hub-say hub-say--' + voice + '">\n'
    + '    ' + img + '\n'
    + '    <p><strong>' + cap(voice) + ' says:</strong> ' + esc(line) + '</p>\n'
    + '  </div>';
}

function renderSections(engine, byId, showInstallPill) {
  const blocks = [];
  engine.sections.forEach((s, si) => {
    const cards = s.workshops.map((wid, i) => {
      const w = byId.get(wid);
      if (!w) throw new Error('engine-hubs.json: unknown workshop id "' + wid + '" in section "' + s.id + '" for ' + engine.id);
      let badge = '';
      if (s.kind === 'start' && s.workshops.length > 1) badge = 'Step ' + (i + 1) + ' of ' + s.workshops.length;
      else if (s.kind === 'series') badge = 'Episode ' + (i + 1);
      const note = engine.notes && engine.notes[wid];
      return card(w, engine, { badge, note, install: s.install });
    });
    const count = s.workshops.length + ' workshop' + (s.workshops.length === 1 ? '' : 's');
    blocks.push('  <section class="hub-section" data-hub-section aria-labelledby="s-' + s.id + '">\n'
      + sectionHead(s.icon || '📦', s.title, s.blurb, showInstallPill ? installPill(s.install, engine) : '', count, 's-' + s.id) + '\n'
      + '  <div class="courses-grid" data-hub-grid>\n' + cards.join('\n') + '\n  </div>\n'
      + '  </section>');
    if (s.kind === 'start') blocks.push(say('pip', engine));
  });
  return blocks.filter(Boolean).join('\n\n');
}

function renderPage(engine, byId) {
  const id = engine.id;
  const allIds = [...new Set(engine.sections.flatMap((s) => s.workshops))];
  const total = allIds.length;
  const band = ageBand(allIds, byId);

  const hasPart = allIds.map((wid) => {
    const w = byId.get(wid);
    return { '@type': 'Course', name: w.title, url: SITE + '/workshops/' + w.id + '.html', isAccessibleForFree: true };
  });

  // Only show a filter when it actually narrows the list, and only show the
  // per-section install pill when install differs between sections. An engine
  // where everything runs in the browser (Scratch) gets neither, since repeating
  // "Nothing to install" and a "Beginner" filter on every card helps no one.
  const installs = engine.sections.map((s) => s.install === true);
  const hasApp = installs.some(Boolean);
  const mixedInstall = hasApp && installs.some((v) => v === false);
  const levels = new Set(allIds.map((wid) => (byId.get(wid) || {}).difficulty).filter(Boolean));
  const mixedLevel = levels.size > 1;
  const filters = [];
  if (mixedInstall) filters.push({ id: 'install', label: 'Nothing to install' });
  if (mixedLevel) filters.push({ id: 'level', label: 'Beginner' });
  const filterBar = filters.length
    ? '  <div class="hub-filter" id="hubFilter" role="group" aria-label="Filter ' + esc(engine.name) + ' workshops">\n'
      + '    <span class="hub-filter-label">Show:</span>\n'
      + '    <button type="button" data-filter="all" aria-pressed="true">All</button>\n'
      + filters.map((f) => '    <button type="button" data-filter="' + f.id + '" aria-pressed="false">' + esc(f.label) + '</button>').join('\n') + '\n'
      + '    <span class="hub-filter-count" id="hubFilterCount" role="status" aria-live="polite"></span>\n'
      + '  </div>'
    : '';

  const title = engine.name + ' Workshops: Free Beginner Tutorials and Series | JVDesignStudio';
  const description = hasApp
    ? 'Every free ' + engine.name + ' workshop in one place: start in the browser with nothing installed, then build a full game in the free '
      + engine.name + ' app. ' + total + ' workshops, ' + band.toLowerCase() + '.'
    : 'Every free ' + engine.name + ' workshop in one place. Build games right in the browser, nothing to install. '
      + total + ' workshops, ' + band.toLowerCase() + '.';

  const jsonld = [
    {
      '@context': 'https://schema.org', '@type': 'CollectionPage', name: engine.name + ' Workshops',
      description, url: SITE + '/workshops/engine-' + id + '.html', isAccessibleForFree: true, hasPart
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: 'Workshops', item: SITE + '/workshop' },
        { '@type': 'ListItem', position: 3, name: engine.name, item: SITE + '/workshops/engine-' + id + '.html' }
      ]
    }
  ].map((o) => '<script type="application/ld+json">' + JSON.stringify(o) + '</script>').join('\n');

  const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<script src="/assets/js/theme-init.js"></script>
<link rel="manifest" href="../manifest.json">
<meta name="theme-color" content="${engine.color}">
<script defer src="../analytics-loader.js"></script>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}/workshops/engine-${id}.html">
<meta name="robots" content="index, follow">
<meta name="jvds-kind" content="engine-hub">
<meta property="og:type" content="website">
<meta property="og:site_name" content="JVDesignStudio">
<meta property="og:url" content="${SITE}/workshops/engine-${id}.html">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${SITE}/og/learn.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="../logo.png" type="image/png">
${marker('head-icons', readPartial('head-icons'))}
<link rel="stylesheet" href="/assets/fonts/fonts.css">
<link rel="stylesheet" href="../style-shared.css?v=17">
<link rel="stylesheet" href="../style-workshop-bundle.css?v=18">
<link rel="stylesheet" href="/style-mascots.css">
<link rel="stylesheet" href="../style-workshop-hub.css?v=2">
<style>
.hub-crumbs{max-width:1100px;margin:0 auto;padding:14px 20px 0;font-size:.85rem;color:var(--text-secondary)}
.hub-crumbs a{color:var(--teal-dk);font-weight:700}
.hub-crumbs a:hover{text-decoration:underline}
.hub-hero{max-width:1000px;margin:0 auto;padding:10px 20px 8px;text-align:center}
.hub-hero-badge{display:inline-flex;align-items:center;gap:8px;font-size:.78rem;font-weight:800;letter-spacing:.02em;padding:6px 14px;border-radius:999px;background:color-mix(in srgb,var(--hub-color) 16%,var(--bg-secondary));border:1px solid var(--hub-color);color:var(--text-primary);margin-bottom:14px}
.hub-hero h1{font-family:Fredoka,'Baloo 2',cursive;font-size:clamp(1.8rem,5vw,2.6rem);line-height:1.1;margin:0 0 10px;color:var(--text-primary)}
.hub-hero h1 em{color:var(--hub-color);font-style:normal}
.hub-hero-sub{max-width:640px;margin:0 auto 16px;color:var(--text-secondary);font-size:1.02rem;line-height:1.6}
.hub-facts{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.hub-fact{font-size:.76rem;font-weight:800;padding:5px 12px;border-radius:999px;background:var(--bg-secondary);border:1.5px solid var(--border-lt);color:var(--text-secondary)}
.hub-filter{max-width:1100px;margin:12px auto 0;padding:0 20px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.hub-filter-label{font-size:.82rem;font-weight:800;color:var(--text-secondary)}
.hub-filter button{font:inherit;font-size:.82rem;font-weight:800;padding:7px 14px;border-radius:999px;border:1.5px solid var(--border-lt);background:var(--bg-secondary);color:var(--text-secondary);cursor:pointer}
.hub-filter button:hover{border-color:var(--teal)}
.hub-filter button[aria-pressed="true"]{background:var(--teal-dk);border-color:var(--teal-dk);color:#fff}
.hub-filter-count{font-size:.82rem;color:var(--text-secondary)}
.hub-say{max-width:820px;margin:18px auto 0;display:flex;gap:12px;align-items:flex-start;background:var(--bg-secondary);border:1.5px solid var(--teal);border-radius:14px;padding:14px 18px}
.hub-say--pip{border-color:var(--tan)}
.hub-say img{flex:0 0 38px;border-radius:50%}
.hub-say p{margin:0;font-size:.92rem;line-height:1.55;color:var(--text-primary)}
.hub-body{max-width:1100px;margin:0 auto;padding:8px 0}
.hub-section{padding:26px 20px 8px}
.hub-section[hidden]{display:none}
.hub-section .ws-section-head{align-items:flex-start}
.hub-section .ws-section-label{margin:0;font-family:Fredoka,'Baloo 2',cursive;font-size:clamp(1.2rem,3vw,1.5rem);color:var(--text-primary)}
.hub-section .ws-section-sub{margin:4px 0 0}
.hub-install{display:inline-flex;align-items:center;margin-top:8px;font-size:.74rem;font-weight:800;padding:4px 11px;border-radius:999px;background:var(--bg-tertiary);color:var(--text-primary);border:1.5px solid var(--border-lt)}
.hub-install--none{border-color:var(--teal)}
.hub-install--app{border-color:var(--tan)}
.course-card[hidden]{display:none}
.course-cover{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:10px;margin-bottom:12px;background:color-mix(in srgb,var(--hub-color) 12%,var(--bg-secondary))}
.course-cover--browser{display:flex;align-items:center;justify-content:center;font-size:2.6rem;line-height:1}
.hub-foot{max-width:820px;margin:26px auto 44px;padding:0 20px;text-align:center;color:var(--text-secondary)}
.hub-foot a{color:var(--teal);font-weight:800}
@media(max-width:640px){.hub-say{flex-direction:column;align-items:center;text-align:center}}
</style>
${jsonld}
</head>
<body>
${marker('nav-content', readPartial('nav-content'))}

<main id="main-content">
  <nav class="hub-crumbs" aria-label="Breadcrumb">
    <a href="/workshop">All workshops</a> <span aria-hidden="true">/</span> ${esc(engine.name)}
  </nav>

  <section class="hub-hero" style="--hub-color:${engine.color}">
    <span class="hub-hero-badge"><span aria-hidden="true">${engine.emoji}</span> ${esc(engine.name)} engine hub</span>
    <h1>Learn <em>${esc(engine.name)}</em>, one game at a time</h1>
    <p class="hub-hero-sub">${esc(engine.tagline)}</p>
    <div class="hub-facts">
      <span class="hub-fact">${esc(band)}</span>
      <span class="hub-fact">Free, no account</span>
      <span class="hub-fact">${total} workshops</span>
      ${hasApp ? '' : '<span class="hub-fact">Nothing to install</span>'}
    </div>
  </section>

${say('lumo', engine)}

${filterBar}

  <div class="hub-body">
${renderSections(engine, byId, mixedInstall)}
  </div>

  <p class="hub-foot">Everything else, plus every other engine, lives in the <a href="/workshop">full workshop hub</a>. ${esc(engine.install)}</p>
</main>

${marker('footer-content', readPartial('footer-content'))}
<script defer src="/mascots.js"></script>
<script defer src="/feedback-widget.js"></script>
<script defer src="/jvds-funnel.js"></script>
<script defer src="/assets/js/engine-hub.js"></script>
</body>
</html>
`;

  return applyCsp(page);
}

function generate({ checkOnly = false } = {}) {
  const { config, byId } = load();
  const results = [];
  for (const engine of config.engines) {
    const file = path.join(OUTDIR, 'engine-' + engine.id + '.html');
    const want = renderPage(engine, byId);
    const have = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    const changed = have !== want;
    if (changed && !checkOnly) fs.writeFileSync(file, want);
    results.push({ file: path.relative(ROOT, file).split(path.sep).join('/'), changed });
  }
  return results;
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const results = generate({ checkOnly });
  const changed = results.filter((r) => r.changed);
  if (checkOnly) {
    if (changed.length) {
      console.log('  [FAIL] engine hub drift: ' + changed.map((r) => r.file).join(', '));
      console.log('         regenerate with node scripts/generate-engine-hubs.js');
      process.exit(1);
    }
    console.log('  [PASS] engine hubs in sync (' + results.length + ' page' + (results.length === 1 ? '' : 's') + ')');
    return;
  }
  console.log(changed.length
    ? '  [OK] wrote ' + changed.map((r) => r.file).join(', ')
    : '  [PASS] engine hubs already in sync (' + results.length + ')');
}

if (require.main === module) main();
module.exports = { generate };
