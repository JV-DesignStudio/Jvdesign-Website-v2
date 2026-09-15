// tools/music-maker.html is a redirect stub to Sound Studio since the A133 audio merge.
// A202: check the redirect contract; Sound Studio features are covered by test:sound.
require('./redirect-stub-check')({ from: '/tools/music-maker.html', to: '/tools/sound-studio.html', title: 'Audio Studio', selector: '#app' })
  .catch(e => { console.error('Harness error:', e); process.exit(1); });
