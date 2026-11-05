const { run } = require('./workshop-finish-check');
run('/workshops/terraria-world-ep7-tunnels.html').catch((e) => { console.error(e); process.exit(1); });
