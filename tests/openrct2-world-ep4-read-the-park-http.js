const { run } = require('./workshop-finish-check');
run('/workshops/openrct2-world-ep4-read-the-park.html').catch((e) => { console.error(e); process.exit(1); });
