const {run}=require('./canvas-workshop-suite');
run('/workshops/godot_tutorial.html',{steps:6}).catch(e=>{console.error(e);process.exit(1);});

