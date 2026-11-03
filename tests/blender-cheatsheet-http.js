const {run}=require('./workshop-page-check');
run('/workshops/blender-cheatsheet.html',{next:'blender-cube-workshop.html',challenge:false,reflect:true}).catch(e=>{console.error(e);process.exit(1);});
