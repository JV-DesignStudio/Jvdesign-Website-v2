const {run}=require('./workshop-page-check');
run('/workshops/blender-cube-workshop.html',{next:'blender-character-workshop.html',challenge:false,reflect:true}).catch(e=>{console.error(e);process.exit(1);});
