const {run}=require('./workshop-page-check');
run('/workshops/minecraft-world-ep8-design-share.html',{next:'engine-minecraft.html'}).catch(e=>{console.error(e);process.exit(1);});
