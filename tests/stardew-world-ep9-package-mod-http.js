const { run } = require('./workshop-finish-check');
run('/workshops/stardew-world-ep9-package-mod.html').catch((e) => { console.error(e); process.exit(1); });
