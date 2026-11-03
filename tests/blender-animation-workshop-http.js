const {run}=require('./workshop-page-check');
run('/workshops/blender-animation-workshop.html',{next:'blender-materials-workshop.html',challenge:false,reflect:true}).catch(e=>{console.error(e);process.exit(1);});
