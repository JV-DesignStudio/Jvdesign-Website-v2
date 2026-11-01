// tools/level-designer-landing.html is a retired landing page for World Builder.
// It now redirects to the single canonical tool page (A1962).
require('./redirect-stub-check')({
  from: '/tools/level-designer-landing.html',
  to: '/tools/level-designer.html',
  title: 'World Builder',
  selector: '#tilePalette'
});
