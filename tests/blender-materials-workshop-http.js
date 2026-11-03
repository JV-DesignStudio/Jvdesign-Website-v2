const {run}=require('./workshop-page-check');
run('/workshops/blender-materials-workshop.html',{next:'blender-lighting-workshop.html',challenge:false,reflect:true}).catch(e=>{console.error(e);process.exit(1);});
