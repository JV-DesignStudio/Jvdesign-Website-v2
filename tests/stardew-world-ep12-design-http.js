const { run } = require('./workshop-finish-check');
run('/workshops/stardew-world-ep12-design.html').catch((e) => { console.error(e); process.exit(1); });
