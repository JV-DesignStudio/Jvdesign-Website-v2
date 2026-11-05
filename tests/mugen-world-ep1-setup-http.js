const { run } = require('./workshop-finish-check');
run('/workshops/mugen-world-ep1-setup.html').catch((e) => { console.error(e); process.exit(1); });
