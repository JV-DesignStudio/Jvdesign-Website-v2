const { run } = require('./workshop-finish-check');
run('/workshops/openrct2-world-ep7-test-debug.html').catch((e) => { console.error(e); process.exit(1); });
