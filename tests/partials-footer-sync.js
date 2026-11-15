// partials-footer-sync.js (A3056): every built page carries the current footer.
// The A3054 voice change lives in partials/footer-content.html, so a page that
// still embeds the old footer is an unbuilt page. This guard catches that drift
// and the stale classroom line without re-running the whole build.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', '.worktrees', 'quest-board-deploy', 'reports', '.asset-drafts']);
const OLD_LINE = 'practical for classrooms to use';
const NEW_LINE = 'easy to use at home';

const partial = fs.readFileSync(path.join(ROOT, 'partials', 'footer-content.html'), 'utf8').trim();
let failures = 0;
const check = (name, ok, detail = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : '')); if (!ok) failures++; };

const footerOf = (html) => {
  const start = html.indexOf('<footer class="site-footer">');
  if (start === -1) return null;
  const end = html.indexOf('</footer>', start);
  if (end === -1) return null;
  return html.slice(start, end + 9);
};
const partialFooter = footerOf(partial);
check('footer partial has a footer element', !!partialFooter);

let pages = 0;
let withFooter = 0;
const stale = [];
const mismatched = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!entry.name.endsWith('.html')) continue;
    pages++;
    const html = fs.readFileSync(full, 'utf8');
    if (html.includes(OLD_LINE)) stale.push(path.relative(ROOT, full));
    // Only pages that actually embed the shared partial are expected to match it.
    if (!html.includes('partials-footer-content-1.js')) continue;
    const footer = footerOf(html);
    if (!footer) continue;
    withFooter++;
    if (footer !== partialFooter) mismatched.push(path.relative(ROOT, full));
  }
}

walk(ROOT);

check('footer partial carries the A3054 home wording', partial.includes(NEW_LINE) && !partial.includes(OLD_LINE));
check('scanned a real set of pages', pages > 250, pages + ' html pages');
check('built pages were found', withFooter > 250, withFooter + ' pages with the shared footer');
check('no page still carries the old classroom footer line', stale.length === 0, stale.slice(0, 5).join(', ') + (stale.length > 5 ? ' (+' + (stale.length - 5) + ')' : ''));
check('every shared footer matches partials/footer-content.html', mismatched.length === 0, mismatched.slice(0, 5).join(', ') + (mismatched.length > 5 ? ' (+' + (mismatched.length - 5) + ')' : ''));

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL FOOTER SYNC CHECKS PASSED');
process.exit(failures ? 1 : 0);
