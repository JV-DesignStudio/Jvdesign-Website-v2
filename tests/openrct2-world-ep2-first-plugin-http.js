const { run } = require('./workshop-finish-check');
run('/workshops/openrct2-world-ep2-first-plugin.html').catch((e) => { console.error(e); process.exit(1); });
