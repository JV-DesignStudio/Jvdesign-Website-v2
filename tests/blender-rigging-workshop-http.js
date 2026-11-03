const {run}=require('./workshop-page-check');
run('/workshops/blender-rigging-workshop.html',{next:'blender-animation-workshop.html',challenge:false,reflect:true}).catch(e=>{console.error(e);process.exit(1);});
