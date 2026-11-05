const { run } = require('./workshop-finish-check');
run('/workshops/openrct2-world-ep5-guests.html').catch((e) => { console.error(e); process.exit(1); });
