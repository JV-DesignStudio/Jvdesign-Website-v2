const {run}=require('./canvas-workshop-suite');
run('/workshops/godot-autoclicker-workshop.html',{steps:7}).catch(e=>{console.error(e);process.exit(1);});
