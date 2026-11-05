const { run } = require('./workshop-finish-check');
run('/workshops/stardew-world-ep8-new-area.html').catch((e) => { console.error(e); process.exit(1); });
