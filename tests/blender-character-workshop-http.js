const {run}=require('./workshop-page-check');
run('/workshops/blender-character-workshop.html',{next:'blender-rigging-workshop.html',challenge:false,reflect:true}).catch(e=>{console.error(e);process.exit(1);});
