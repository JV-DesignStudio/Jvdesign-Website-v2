#!/usr/bin/env node
/**
 * A2183: partial injection must not drop blocks that other build steps stamp
 * inside a partial region. The WS-FINISH finish screens live inside
 * footer-content, so a plain reinjection used to wipe them.
 */
const { injectPartial } = require('../scripts/build/partials');

let failed = 0;
function check(name, ok, detail) {
  if (ok) console.log('PASS ' + name + (detail ? ' , ' + detail : ''));
  else { failed++; console.error('FAIL ' + name + (detail ? ' , ' + detail : '')); }
}

const page = [
  '<main><p>lesson</p></main>',
  '',
  '<!-- BUILD:footer-content -->',
  '<!-- WS-FINISH:START -->',
  '<section id="wsFinish">finished when</section>',
  '<!-- WS-FINISH:END -->',
  '<footer>old footer</footer>',
  '<!-- /BUILD:footer-content -->',
  ''
].join('\n');

const out = injectPartial(page, 'footer-content', '<footer>new footer</footer>');
check('new footer is injected', out.includes('<footer>new footer</footer>'));
check('old footer is replaced', !out.includes('old footer'));
check('WS-FINISH block survives', out.includes('<!-- WS-FINISH:START -->') && out.includes('id="wsFinish"'));

const count = (s) => (s.match(/<!-- WS-FINISH:START -->/g) || []).length;
check('block is not duplicated', count(out) === 1, 'count=' + count(out));

const again = injectPartial(out, 'footer-content', '<footer>new footer</footer>');
check('second build is a no-op', again === out);

const plain = injectPartial('<div><!-- BUILD:nav --><nav>old</nav><!-- /BUILD:nav --></div>', 'nav', '<nav>new</nav>');
check('plain region still replaces', plain === '<div><!-- BUILD:nav -->\n<nav>new</nav>\n<!-- /BUILD:nav --></div>', plain);

if (failed) { console.error('\npartials-preserve-finish: ' + failed + ' failure(s)'); process.exit(1); }
console.log('\npartials-preserve-finish: PASS');
