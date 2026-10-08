// Site-wide character quote strip: appears on a normal content page and is
// suppressed on creator workspaces (tools/games).
const suite = require('./character-quotes-suite');

(async () => {
  const which = process.argv[2] || 'content';
  if (which === 'tool') {
    await suite.runStrip({ page: '/tools/colour-palette.html', expectStrip: false });
  } else {
    await suite.runStrip({ page: '/index.html', expectStrip: true });
  }
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
