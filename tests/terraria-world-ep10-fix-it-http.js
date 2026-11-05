const { run } = require('./workshop-finish-check');
run('/workshops/terraria-world-ep10-fix-it.html').catch((e) => { console.error(e); process.exit(1); });
