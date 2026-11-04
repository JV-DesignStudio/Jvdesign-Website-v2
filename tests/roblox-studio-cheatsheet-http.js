const { run } = require('./roblox-page-load');
run([{ page: '/workshops/roblox-studio-cheatsheet.html', redirectsTo: '/tools/roblox-cheatsheet.html' }])
  .catch((e) => { console.error(e); process.exit(1); });
