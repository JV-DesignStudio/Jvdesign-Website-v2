// tools/sfx-generator-landing.html is a redirect stub to Sound Studio since the A133 audio merge.
// A2147: the old landing page promised MP3 and engine snippets that Audio Studio never emitted.
require('./redirect-stub-check')({ from: '/tools/sfx-generator-landing.html', to: '/tools/sound-studio.html', title: 'Audio Studio', selector: '#app' })
  .catch(e => { console.error('Harness error:', e); process.exit(1); });
