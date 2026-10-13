const {run}=require('./canvas-workshop-suite');
run('/workshops/godot-gdscript-essentials.html',{steps:6}).catch(e=>{console.error(e);process.exit(1);});

