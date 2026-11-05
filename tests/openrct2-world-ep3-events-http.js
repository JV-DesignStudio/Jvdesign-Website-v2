const { run } = require('./workshop-finish-check');
run('/workshops/openrct2-world-ep3-events.html').catch((e) => { console.error(e); process.exit(1); });
