/**
 * scripts/build/tools-hub.js - A669
 *
 * Single source of truth for the toolbox hub. Reads content/tools.json
 * (the curated catalog plus each tool's `hub` card metadata) and writes
 * the generated partials:
 *
 *   partials/tools-grid.html   the category blocks + tool cards
 *   partials/tools-stats.html  the CTA stat chips
 *
 * Adds a tool or a merge by editing content/tools.json only, then run
 * `npm run build` (or `npm run build -- --only=tools`). The hub cards,
 * counts and search keywords follow automatically.
 */
const fs = require('fs');
const path = require('path');
const { ROOT } = require('../lib/paths');

const PIPELINES = [
  { id: 'asset pipeline', emoji: '🎨', title: 'Asset Pipeline', order: ['pixel-studio', 'sprite-animator', 'bitmap-font-maker', 'trading-card-designer'] },
  { id: 'audio pipeline', emoji: '🎵', title: 'Audio Pipeline', order: ['sound-studio'] },
  { id: 'level & world data', emoji: '🧱', title: 'Level & World Data', order: ['buildlab', 'level-designer', 'particle-designer'] },
  { id: 'design docs & narrative', emoji: '📋', title: 'Design Docs & Narrative', order: ['gdd-builder', 'story-editor'] },
  { id: 'prototype, debug & ship', emoji: '🚀', title: 'Prototype, Debug & Ship', order: ['arcade-game-maker', 'code-snippet-generator', 'error-guide', 'quest-board', 'icon-generator'] },
];

// Curated marketing stats that are not derivable from the catalog.
const STATIC_STATS = ['24 Quick References', '8 Export Formats', 'Always Free'];

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function searchText(tool) {
  const h = tool.hub;
  return [tool.title, h.cardDesc, ...(h.tags || []), ...(h.outputs || []), ...(h.aliases || []), h.pipeline, tool.id]
    .join(' ').toLowerCase().replace(/\s+/g, ' ').trim();
}

function relUrl(url) {
  const u = String(url || '');
  return u.startsWith('/') ? '..' + u : u;
}

function renderCard(tool) {
  const h = tool.hub;
  const name = h.cardTitle || tool.title;
  const thumb = h.image
    ? `<img width="1024" height="572" loading="lazy" src="${esc(h.image)}" alt="${esc(name)} preview">`
    : `<span class="tool-emoji">${h.emoji || '🧰'}</span>`;
  const merged = (h.mergedFrom && h.mergedFrom.length)
    ? `        <p class="tool-merged"><b>Includes</b> ${esc(h.mergedFrom.join(' and '))}.</p>\n`
    : (h.note ? `        <p class="tool-merged">${esc(h.note)}</p>\n` : '');
  const tags = (h.tags || []).map(t => `<span class="tool-tag">${esc(t)}</span>`).join('');
  const outputs = (h.outputs || []).map(o => `<span class="tool-output-badge">${esc(o)}</span>`).join('');
  return `<a href="${esc(relUrl(tool.url))}" class="tool-card reveal" data-tool-card data-category="${esc(h.pipeline)}" data-search="${esc(searchText(tool))}">
    <div class="tool-thumb">
        <span class="tool-year">2026</span>
        ${thumb}
    </div>
    <div class="tool-body">
        <span class="tool-type">${esc(PIPELINES.find(p => p.id === h.pipeline).title)}</span>
        <h3 class="tool-title">${esc(name)}</h3>
        <p class="tool-desc">${esc(h.cardDesc)}</p>
${merged}        <div class="tool-tags">${tags}</div>
        <div class="tool-outputs">${outputs}</div>
        <span class="tool-cta">Open Tool →</span>
    </div>
</a>`;
}

function build() {
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'tools.json'), 'utf8'));
  const byId = {};
  catalog.forEach(t => { byId[t.id] = t; });

  const ordered = new Set();
  const blocks = [];
  let core = 0, merged = 0;

  for (const p of PIPELINES) {
    const tools = p.order.map(id => {
      const t = byId[id];
      if (!t || !t.hub) throw new Error(`tools-hub: "${id}" is in pipeline "${p.id}" but has no hub metadata in content/tools.json`);
      if (t.hub.pipeline !== p.id) throw new Error(`tools-hub: "${id}" hub.pipeline is "${t.hub.pipeline}" but is listed under "${p.id}"`);
      ordered.add(id);
      return t;
    });
    core += tools.length;
    tools.forEach(t => { merged += (t.hub.mergedFrom || []).length; });
    const cards = tools.map(renderCard).join('\n');
    blocks.push(`    <div class="tool-category" data-category="${esc(p.id)}">
        <div class="category-header">
            <span class="category-emoji">${p.emoji}</span>
            <span class="category-title">${p.title}</span>
            <span class="category-count">${tools.length} tool${tools.length === 1 ? '' : 's'}</span>
        </div>
        <div class="tools-grid">
${cards}
        </div>
    </div>`);
  }

  const unlisted = catalog.filter(t => t.hub && !ordered.has(t.id)).map(t => t.id);
  if (unlisted.length) throw new Error(`tools-hub: hub tools not in any pipeline: ${unlisted.join(', ')}`);

  const stats = [
    `<span class="cta-stat-chip">${core} Core Tools</span>`,
    `<span class="cta-stat-chip">${merged} Tools Merged In</span>`,
    ...STATIC_STATS.map(s => `<span class="cta-stat-chip">${esc(s)}</span>`),
  ].join('\n        ');

  const dir = path.join(ROOT, 'partials');
  fs.writeFileSync(path.join(dir, 'tools-grid.html'), blocks.join('\n\n') + '\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'tools-stats.html'), '        ' + stats + '\n', 'utf8');
  return { core, merged };
}

function runToolsHub() {
  const { core, merged } = build();
  console.log(`  tools hub: ${core} core tools, ${merged} merged in, ${PIPELINES.length} pipelines`);
  return { core, merged };
}

if (require.main === module) {
  runToolsHub();
  console.log('Wrote partials/tools-grid.html and partials/tools-stats.html');
}

module.exports = { runToolsHub };
