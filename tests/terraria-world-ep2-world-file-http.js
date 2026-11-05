const { run } = require('./workshop-finish-check');
run('/workshops/terraria-world-ep2-world-file.html').catch((e) => { console.error(e); process.exit(1); });
