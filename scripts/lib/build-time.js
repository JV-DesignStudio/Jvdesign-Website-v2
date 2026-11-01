'use strict';
/*
 * build-time.js - one reproducible timestamp for every generated file.
 *
 * A build must be reproducible: the same source and configuration should
 * produce byte-identical output. Wall-clock `new Date()` breaks that and
 * leaves generated files dirty on every run. This helper resolves one value:
 *
 *   1. SOURCE_DATE_EPOCH (seconds) when set, the reproducible-build standard
 *   2. the current commit date (git log -1 --format=%cI)
 *   3. a fixed epoch when git is unavailable, never the wall clock
 */
const path = require('path');
const { execSync } = require('child_process');

let cached = null;

function buildTime() {
  if (cached) return cached;

  const epoch = process.env.SOURCE_DATE_EPOCH;
  if (epoch && /^\d+$/.test(epoch)) {
    cached = new Date(Number(epoch) * 1000).toISOString();
    return cached;
  }

  try {
    const iso = execSync('git log -1 --format=%cI', {
      cwd: path.resolve(__dirname, '..', '..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (iso) {
      cached = new Date(iso).toISOString();
      return cached;
    }
  } catch {}

  cached = '1970-01-01T00:00:00.000Z';
  return cached;
}

module.exports = { buildTime };
