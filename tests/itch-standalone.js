// Standalone itch builds: each one is a single index.html plus a zip with the
// page at the root. See scripts/build-itch-standalone.cjs.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ITCH = path.join(ROOT, '..', 'itch');
const SLUGS = [
  'stardust-snake', 'bread-blocks', 'ember-smash', 'bubble-pop-galaxy',
  'paper-toss-deluxe', 'pip_star_connect', 'dungeon-delve', 'voidrush',
  'arcane-citadel', 'call-of-the-cards', 'cozy-creatures', 'cozy-biscuit-clicker',
  'cozy-cafe-match', 'rustfall', 'sky-high-with-friends', 'tower-defence'
];

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

// Read the zip central directory and return the entry names.
function zipEntries(file) {
  const buf = fs.readFileSync(file);
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('no end-of-central-directory record');
  const count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  const names = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(offset) !== 0x02014b50) throw new Error('bad central directory');
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    names.push(buf.slice(offset + 46, offset + 46 + nameLen).toString('utf8'));
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

for (const slug of SLUGS) {
  const dir = path.join(ITCH, slug);
  const index = path.join(dir, 'index.html');
  const zip = path.join(ITCH, slug + '.zip');
  const present = fs.existsSync(index);
  check(slug + ': index.html exists', present);
  if (!present) continue;

  const html = fs.readFileSync(index, 'utf8');
  const markup = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  check(slug + ': no external script tag', !/<script[^>]+src=/i.test(markup));
  const relativeAttr = [...markup.matchAll(/\b(?:src|href|srcset)="(\.\.\/[^"]*|\.\/[^"]*)"/gi)].map((m) => m[1]);
  check(slug + ': no site-relative path', relativeAttr.length === 0, relativeAttr.slice(0, 3).join(' '));
  const srcAttrs = [...markup.matchAll(/\bsrc="([^"]+)"/gi)].map((m) => m[1]);
  check(slug + ': no remote src', !srcAttrs.some((u) => /^https?:/i.test(u)), srcAttrs.filter((u) => /^https?:/i.test(u)).join(' '));
  check(slug + ': styles inlined', !/<link[^>]*rel="stylesheet"/i.test(markup));

  const zipOk = fs.existsSync(zip);
  check(slug + ': zip exists', zipOk, zipOk ? (fs.statSync(zip).size + ' bytes') : 'missing');
  if (zipOk) {
    try {
      const names = zipEntries(zip);
      check(slug + ': zip has index.html at root', names.includes('index.html'), names.slice(0, 4).join(', '));
    } catch (e) {
      check(slug + ': zip is readable', false, e.message);
    }
  }

  check(slug + ': cover 630x500 exists', fs.existsSync(path.join(dir, 'cover-630x500.png')));
}

if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
console.log('\nALL ITCH STANDALONE CHECKS PASSED (' + SLUGS.length + ' games)');
