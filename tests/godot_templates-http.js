const { run } = require('./workshop-page-check');
run('/workshops/godot_templates.html', { next: 'godot-rally-workshop.html', challenge: false }).catch((e) => {
  console.error(e);
  process.exit(1);
});
