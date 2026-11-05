const { run } = require('./workshop-finish-check');
run('/workshops/mugen-world-ep2-fighter-files.html').catch((e) => { console.error(e); process.exit(1); });
