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
 *   partials/tools-grid.html   the category blocks + tool cards
 *   partials/tools-stats.html  the CTA stat chips
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
  return `<a href="${esc(relUrl(tool.url))}" class="tool-card reveal" data-tool-card data-category="${esc(card.pipeline)}" data-search="${esc(searchText(tool, card, pipelineTitle))}">
    <div class="tool-thumb">
        <span class="tool-year">2026</span>
        ${thumb}
    </div>
    <div class="tool-body">
        <span class="tool-type">${esc(pipelineTitle)}</span>
        <h3 class="tool-title">${esc(name)}</h3>
        <p class="tool-desc">${esc(card.cardDesc)}</p>
${merged}        <div class="tool-tags">${tags}</div>
        <div class="tool-outputs">${outputs}</div>
        <span class="tool-cta">Open Tool →</span>
    </div>
</a>`;
}

function build() {
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'tools.json'), 'utf8'));
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'tools-hub.json'), 'utf8'));
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
    `<span class="cta-stat-chip">${core} Core Tools</span>`,
    `<span class="cta-stat-chip">${merged} Tools Merged In</span>`,
    ...(cfg.staticStats || []).map(s => `<span class="cta-stat-chip">${esc(s)}</span>`),
  ].join('\n        ');

  const dir = path.join(ROOT, 'partials');
  fs.writeFileSync(path.join(dir, 'tools-grid.html'), blocks.join('\n\n') + '\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'tools-stats.html'), '        ' + stats + '\n', 'utf8');
  return { core, merged };
}

function runToolsHub() {
  const { core, merged } = build();
  console.log(`  tools hub: ${core} core tools, ${merged} merged in`);
  return { core, merged };
}

if (require.main === module) {
  runToolsHub();
  console.log('Wrote partials/tools-grid.html and partials/tools-stats.html');
}

module.exports = { runToolsHub };
