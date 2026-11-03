const {run}=require('./workshop-page-check');
run('/workshops/blender-scene-workshop.html',{next:'engine-blender.html',challenge:false,reflect:true}).catch(e=>{console.error(e);process.exit(1);});
