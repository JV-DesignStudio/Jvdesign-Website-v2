/**
 * scripts/lib/build-lock.js
 *
 * A tiny cross-process lock so two agents cannot run the build / drift
 * generators at the same time and clobber the shared generated files
 * (content/*.json, content-data.js, search-index.json, sitemap.xml,
 * board-data.json, partials/*).
 *
 * Usage:
 *   const release = require('../lib/build-lock').acquire('npm run build');
 *   ... work ...
 *   release();               // also released automatically on process exit
 *
 * A lock older than STALE_MS is treated as stale (a crashed run) and taken over.
 */
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./paths');

const LOCK = path.join(ROOT, '.build.lock');
const STALE_MS = 10 * 60 * 1000; // 10 minutes

function acquire(label = 'build') {
  try {
    const st = fs.statSync(LOCK);
    const age = Date.now() - st.mtimeMs;
    if (age < STALE_MS) {
      let who = '';
      try { who = fs.readFileSync(LOCK, 'utf8').trim(); } catch {}
      const mins = Math.round((age / 60000) * 10) / 10;
      const err = new Error(
        `build lock held by ${who || 'another process'} (${mins}m). ` +
        `Retry shortly, or delete ${path.relative(ROOT, LOCK)} if it is stale.`
      );
      err.code = 'BUILD_LOCKED';
      throw err;
    }
    fs.unlinkSync(LOCK); // stale - take it over
  } catch (e) {
    if (e.code === 'BUILD_LOCKED') throw e;
    // ENOENT: no lock present, good
  }

  fs.writeFileSync(LOCK, `${label} pid=${process.pid} at=${new Date().toISOString()}\n`);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    try { fs.unlinkSync(LOCK); } catch {}
  };
  process.on('exit', release);
  process.on('SIGINT', () => { release(); process.exit(130); });
  return release;
}

module.exports = { acquire, LOCK };
