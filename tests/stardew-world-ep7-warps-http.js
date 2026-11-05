const { run } = require('./workshop-finish-check');
run('/workshops/stardew-world-ep7-warps.html').catch((e) => { console.error(e); process.exit(1); });
