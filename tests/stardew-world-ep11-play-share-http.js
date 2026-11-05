const { run } = require('./workshop-finish-check');
run('/workshops/stardew-world-ep11-play-share.html').catch((e) => { console.error(e); process.exit(1); });
