#!/usr/bin/env node
/*
 * build.js — JVDesignStudio static include system.
 * Walks every .html file in the project (recursively) and replaces the content
 * between <!-- BUILD:name --> ... <!-- /BUILD:name --> markers with the matching
 * partial from /partials. Also normalises the "Skip to main content" link so each
 * page has exactly one (the nav-content partial provides it).
 */
const fs   = require('fs');
const path = require('path');

const ROOT     = __dirname;
const PARTIALS = path.join(ROOT, 'partials');
const IGNORE_DIRS = new Set(['node_modules', '.git', '.claude', 'partials', 'quest-board-deploy']);

// Load all partials once
const partials = {};
fs.readdirSync(PARTIALS).forEach(f => {
    if (!f.endsWith('.html')) return;
    partials[f.replace('.html', '')] = fs.readFileSync(path.join(PARTIALS, f), 'utf8');
});

// Unified nav: map nav-tools to nav-content so all pages get the same nav
if (partials['nav-tools'] && partials['nav-content']) {
    partials['nav-tools'] = partials['nav-content'];
}

function makeMarkerRegex(name) {
    return new RegExp(`<!--\\s*BUILD:${name}\\s*-->[\\s\\S]*?<!--\\s*/BUILD:${name}\\s*-->`, 'g');
}

// Recursively collect .html files, skipping ignored directories.
function walk(dir) {
    let out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (IGNORE_DIRS.has(entry.name)) continue;
            out = out.concat(walk(path.join(dir, entry.name)));
        } else if (entry.isFile() && entry.name.endsWith('.html')) {
            out.push(path.join(dir, entry.name));
        }
    }
    return out;
}

// Remove duplicate page-level "skip to main content" links that sit before the
// nav-content marker (the partial re-adds exactly one inside the marker).
function dedupeSkipLinks(src) {
    const markerIdx = src.indexOf('<!-- BUILD:nav-content -->');
    if (markerIdx === -1) return src;
    const head = src.slice(0, markerIdx)
        .replace(/[ \t]*<a href="#main-content" class="skip-link">Skip to main content<\/a>[ \t]*\r?\n?/g, '');
    return head + src.slice(markerIdx);
}

let changed = 0, unchanged = 0;

walk(ROOT).forEach(filePath => {
    let src = fs.readFileSync(filePath, 'utf8');
    const original = src;

    Object.entries(partials).forEach(([name, content]) => {
        const re = makeMarkerRegex(name);
        if (re.test(src)) {
            src = src.replace(re, `<!-- BUILD:${name} -->\n${content.trim()}\n<!-- /BUILD:${name} -->`);
        }
    });

    src = dedupeSkipLinks(src);

    if (src !== original) {
        fs.writeFileSync(filePath, src, 'utf8');
        console.log('  updated:', path.relative(ROOT, filePath));
        changed++;
    } else {
        unchanged++;
    }
});

console.log(`\nDone. ${changed} file(s) updated, ${unchanged} unchanged.`);

// Soft link-integrity check: surface broken internal links after every build.
// Non-fatal (this repo auto-commits), but prints a clear warning so regressions
// don't slip in silently. Run `npm run validate:links` for the gating exit code.
try {
    const { execFileSync } = require('child_process');
    execFileSync(process.execPath, [path.join(ROOT, 'validate-links.js')], { stdio: 'inherit' });
} catch (e) {
    console.log('\n⚠  validate-links reported broken links (see above). Fix before deploying.');
}
