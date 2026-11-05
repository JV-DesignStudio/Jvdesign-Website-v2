const { run } = require('./workshop-finish-check');
run('/workshops/night-watch-part2-workshop.html').catch((e) => { console.error(e); process.exit(1); });
