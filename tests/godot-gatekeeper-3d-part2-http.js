const {run}=require('./workshop-page-check');
run('/workshops/godot-gatekeeper-3d-part2.html',{next:'engine-godot.html',challenge:false}).catch(e=>{console.error(e);process.exit(1);});
