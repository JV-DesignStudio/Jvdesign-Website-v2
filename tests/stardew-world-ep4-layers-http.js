const { run } = require('./workshop-finish-check');
run('/workshops/stardew-world-ep4-layers.html').catch((e) => { console.error(e); process.exit(1); });
