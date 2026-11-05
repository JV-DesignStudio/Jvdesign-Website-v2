const { run } = require('./workshop-finish-check');
run('/workshops/night-watch-part3-workshop.html').catch((e) => { console.error(e); process.exit(1); });
