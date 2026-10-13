const {run}=require('./canvas-workshop-suite');
run('/workshops/pico8-platformer-workshop.html',{steps:6}).catch(e=>{console.error(e);process.exit(1);});

