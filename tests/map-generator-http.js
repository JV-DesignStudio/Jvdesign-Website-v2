// tools/map-generator.html is a redirect stub to World Builder (level-designer) since the A133 merge.
// A202: check the redirect contract; World Builder features are covered by test:level.
require('./redirect-stub-check')({ from: '/tools/map-generator.html', to: '/tools/level-designer.html', title: 'World Builder', selector: '#tilePalette' })
  .catch(e => { console.error('Harness error:', e); process.exit(1); });
