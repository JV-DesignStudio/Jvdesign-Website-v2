const { run } = require('./workshop-finish-check');
run('/workshops/terraria-world-ep5-biomes.html').catch((e) => { console.error(e); process.exit(1); });
