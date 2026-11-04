const { run } = require('./js-final-mission');
run('/workshops/race-builder.html').catch((e) => { console.error(e); process.exit(1); });
