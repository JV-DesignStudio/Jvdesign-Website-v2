const {run}=require('./canvas-workshop-suite');
run('/workshops/godot-racing-workshop-2.html',{steps:6}).catch(e=>{console.error(e);process.exit(1);});

