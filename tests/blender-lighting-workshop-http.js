const {run}=require('./workshop-page-check');
run('/workshops/blender-lighting-workshop.html',{next:'blender-scene-workshop.html',challenge:false,reflect:true}).catch(e=>{console.error(e);process.exit(1);});
