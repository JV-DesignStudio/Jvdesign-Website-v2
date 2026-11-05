const { run } = require('./workshop-page-check');
run('/workshops/godot-rally-workshop.html', { next: 'engine-godot.html', challenge: false }).catch((e) => {
  console.error(e);
  process.exit(1);
});
