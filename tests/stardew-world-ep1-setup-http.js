const { run } = require('./workshop-finish-check');
run('/workshops/stardew-world-ep1-setup.html').catch((e) => { console.error(e); process.exit(1); });
