const { run } = require('./workshop-finish-check');
run('/workshops/terraria-world-ep11-play-share.html').catch((e) => { console.error(e); process.exit(1); });
