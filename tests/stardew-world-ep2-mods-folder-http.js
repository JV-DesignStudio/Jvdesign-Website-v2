const { run } = require('./workshop-finish-check');
run('/workshops/stardew-world-ep2-mods-folder.html').catch((e) => { console.error(e); process.exit(1); });
