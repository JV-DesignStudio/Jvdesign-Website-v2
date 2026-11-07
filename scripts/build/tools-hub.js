/**
 * scripts/build/tools-hub.js - A669
 *
 * Single source of truth for the toolbox hub. Merges two curated inputs:
 *
 *   content/tools.json      the GENERATED catalog (id/title/desc/url ...)
 *   content/tools-hub.json  hand-curated hub config: pipeline order, CTA
 *                           stats, and each card's presentation metadata
 *
 * and writes the generated partials:
 *
 *   partials/tools-grid.html    the category blocks + tool cards
 *   partials/tools-stats.html   the CTA stat chips
 *   partials/tools-intents.html the four intent paths above the grid (A2272)
 *
 * Add a tool or a merge by editing content/tools-hub.json (and the catalog
 * if it is a new page), then run `npm run build`. The hub cards, counts and
 * search keywords follow automatically.
 */
const fs = require('fs');
const path = require('path');
const { ROOT } = require('../lib/paths');

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const DIFFICULTY_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
const difficultyLabel = d => DIFFICULTY_LABEL[d] || DIFFICULTY_LABEL.beginner;

function relUrl(url) {
  const u = String(url || '');
  return u.startsWith('/') ? '..' + u : u;
}

function searchText(tool, card, pipelineTitle) {
  return [tool.title, card.cardDesc, ...(card.tags || []), ...(card.outputs || []), ...(card.aliases || []), pipelineTitle, tool.id]
    .join(' ').toLowerCase().replace(/\s+/g, ' ').trim();
}

function renderCard(tool, card, pipelineTitle) {
  const name = card.cardTitle || tool.title;
  const thumb = card.image
    ? `<img width="1024" height="572" loading="lazy" src="${esc(card.image)}" alt="${esc(name)} preview">`
    : `<span class="tool-emoji">${card.emoji || '🧰'}</span>`;
  const merged = (card.mergedFrom && card.mergedFrom.length)
    ? `        <p class="tool-merged"><b>Includes</b> ${esc(card.mergedFrom.join(' and '))}.</p>\n`
    : (card.note ? `        <p class="tool-merged">${esc(card.note)}</p>\n` : '');
  const tags = (card.tags || []).map(t => `<span class="tool-tag">${esc(t)}</span>`).join('');
  const outputs = (card.outputs || []).map(o => `<span class="tool-output-badge">${esc(o)}</span>`).join('');
  const limits = card.limits ? `        <p class="tool-limits"><b>Limits</b> ${esc(card.limits)}</p>\n` : '';
  const mouse = card.mouseRecommended ? '            <span class="tool-input-badge">\uD83D\uDDB1\uFE0F Mouse recommended</span>\n' : '';
  const touch = (card.mouseRecommended && card.touchNote) ? `        <p class="tool-touch-note">${esc(card.touchNote)}</p>\n` : '';
  return `<a href="${esc(relUrl(tool.url))}" class="tool-card reveal" data-tool-card data-category="${esc(card.pipeline)}" data-search="${esc(searchText(tool, card, pipelineTitle))}">
    <div class="tool-thumb">
        <span class="tool-year">2026</span>
        ${thumb}
    </div>
    <div class="tool-body">
        <div class="tool-meta">
            <span class="tool-type">${esc(pipelineTitle)}</span>
            <span class="tool-difficulty" data-difficulty="${esc(card.difficulty || 'beginner')}">${esc(difficultyLabel(card.difficulty))}</span>
${mouse}        </div>
        <h3 class="tool-title">${esc(name)}</h3>
        <p class="tool-desc">${esc(card.cardDesc)}</p>
${merged}        <div class="tool-tags">${tags}</div>
        <div class="tool-outputs">${outputs}</div>
${limits}${touch}        <span class="tool-cta">Open Tool →</span>
    </div>
</a>`;
}

function renderQuickStart(path, byId) {
  const quick = path.quickStart;
  if (!Array.isArray(quick) || quick.length !== 3) {
    throw new Error(`tools-hub: intentPath "${path.id}" needs exactly 3 quickStart entries, found ${Array.isArray(quick) ? quick.length : 0}`);
  }
  const kinds = quick.map(o => o.kind).sort().join(',');
  if (kinds !== 'random,remix,template') {
    throw new Error(`tools-hub: intentPath "${path.id}" quickStart must be one template, one remix and one random entry`);
  }
  const links = quick.map(o => {
    const tool = byId[o.tool];
    if (!tool) throw new Error(`tools-hub: intentPath "${path.id}" quickStart names "${o.tool}" which is not in content/tools.json`);
    const href = relUrl(tool.url) + (o.query ? '?' + o.query : '') + (o.hash ? '#' + o.hash : '');
    return `            <a class="intent-quick intent-quick--${esc(o.kind)}" href="${esc(href)}" data-quick="${esc(o.kind)}">${esc(o.label)}</a>`;
  }).join('\n');
  return `        <div class="intent-quickstart" aria-label="Start with something ready">
            <span class="intent-quickstart-label">Skip the blank page</span>
${links}
        </div>`;
}

function renderIntentPaths(cfg, byId) {
  const paths = Array.isArray(cfg.intentPaths) ? cfg.intentPaths : [];
  if (paths.length !== 4) throw new Error(`tools-hub: expected 4 intentPaths, found ${paths.length}`);

  const blocks = paths.map(p => {
    if (!p.id || !p.title || !Array.isArray(p.steps)) {
      throw new Error('tools-hub: every intentPath needs id, title and steps');
    }
    if (p.steps.length !== 3) {
      throw new Error(`tools-hub: intentPath "${p.id}" needs exactly 3 steps, found ${p.steps.length}`);
    }
    const steps = p.steps.map((s, i) => {
      const tool = byId[s.tool];
      if (!tool) throw new Error(`tools-hub: intentPath "${p.id}" step ${i + 1} names "${s.tool}" which is not in content/tools.json`);
      if (!cfg.cards[s.tool]) throw new Error(`tools-hub: intentPath "${p.id}" step ${i + 1} names "${s.tool}" which has no hub card`);
      const isFinish = i === p.steps.length - 1;
      if (isFinish && !/^(share|export)$/i.test(s.finish || '')) {
        throw new Error(`tools-hub: intentPath "${p.id}" must end with finish "Share" or "Export"`);
      }
      if (!isFinish && s.finish) {
        throw new Error(`tools-hub: intentPath "${p.id}" step ${i + 1} has a finish label but is not the last step`);
      }
      const href = relUrl(tool.url) + (s.anchor ? '#' + s.anchor : '');
      const finish = isFinish ? `\n                    <span class="intent-finish">${esc(s.finish)}</span>` : '';
      const limit = s.limit ? `\n                            <span class="intent-limit">${esc(s.limit)}</span>` : '';
      return `                <li class="intent-step${isFinish ? ' intent-step--finish' : ''}">
                    <a href="${esc(href)}" class="intent-step-link">
                        <span class="intent-step-num" aria-hidden="true">${i + 1}</span>
                        <span class="intent-step-body">
                            <strong>${esc(s.title)}</strong>
                            <span>${esc(s.desc)}</span>${limit}
                        </span>${finish}
                    </a>
                </li>`;
    }).join('\n');
    const quick = renderQuickStart(p, byId);

    return `    <article class="intent-path" data-intent="${esc(p.id)}">
        <div class="intent-head">
            <span class="intent-emoji" aria-hidden="true">${p.emoji}</span>
            <h3 class="intent-title">${esc(p.title)}</h3>
            <p class="intent-blurb">${esc(p.blurb)}</p>
        </div>
${quick}
        <ol class="intent-steps">
${steps}
        </ol>
    </article>`;
  });

  return `<div class="intent-grid">\n${blocks.join('\n')}\n</div>\n` +
    (cfg.intentNote ? `<p class="intent-limits-note">${esc(cfg.intentNote)}</p>\n` : '');
}

function build() {
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'tools.json'), 'utf8'));
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'tools-hub.json'), 'utf8'));
  const marketing = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'marketing.json'), 'utf8'));
  const byId = {};
  catalog.forEach(t => { byId[t.id] = t; });

  const ordered = new Set();
  const blocks = [];
  let core = 0, merged = 0;

  for (const p of cfg.pipelines) {
    const cards = p.order.map(id => {
      const tool = byId[id];
      const card = cfg.cards[id];
      if (!tool) throw new Error(`tools-hub: "${id}" is in pipeline "${p.id}" but not in content/tools.json`);
      if (!card) throw new Error(`tools-hub: "${id}" is in pipeline "${p.id}" but has no card in content/tools-hub.json`);
      if (card.pipeline !== p.id) throw new Error(`tools-hub: "${id}" card.pipeline is "${card.pipeline}" but is listed under "${p.id}"`);
      ordered.add(id);
      return renderCard(tool, card, p.title);
    });
    core += cards.length;
    p.order.forEach(id => { merged += (cfg.cards[id].mergedFrom || []).length; });
    blocks.push(`    <div class="tool-category" data-category="${esc(p.id)}">
        <div class="category-header">
            <span class="category-emoji">${p.emoji}</span>
            <span class="category-title">${esc(p.title)}</span>
            <span class="category-count">${cards.length} tool${cards.length === 1 ? '' : 's'}</span>
        </div>
        <div class="tools-grid">
${cards.join('\n')}
        </div>
    </div>`);
  }

  const unlisted = Object.keys(cfg.cards).filter(id => !ordered.has(id));
  if (unlisted.length) throw new Error(`tools-hub: cards not in any pipeline: ${unlisted.join(', ')}`);

  const stats = [
    `<span class="cta-stat-chip">${esc(marketing.tools.display)} Free Tools</span>`,
    `<span class="cta-stat-chip">${core} Core Tools</span>`,
    `<span class="cta-stat-chip">${merged} Tools Merged In</span>`,
    ...(cfg.staticStats || []).map(s => `<span class="cta-stat-chip">${esc(s)}</span>`),
  ].join('\n        ');

  const intents = renderIntentPaths(cfg, byId);

  const dir = path.join(ROOT, 'partials');
  fs.writeFileSync(path.join(dir, 'tools-grid.html'), blocks.join('\n\n') + '\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'tools-stats.html'), '        ' + stats + '\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'tools-intents.html'), intents, 'utf8');
  return { core, merged, intents: cfg.intentPaths.length };
}

function runToolsHub() {
  const { core, merged, intents } = build();
  console.log(`  tools hub: ${core} core tools, ${merged} merged in, ${intents} intent paths`);
  return { core, merged, intents };
}

if (require.main === module) {
  runToolsHub();
  console.log('Wrote partials/tools-grid.html and partials/tools-stats.html');
}

module.exports = { runToolsHub };
