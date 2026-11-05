const { run } = require('./workshop-finish-check');
run('/workshops/openrct2-world-ep8-design-share.html').catch((e) => { console.error(e); process.exit(1); });
