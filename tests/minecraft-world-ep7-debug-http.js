const {run}=require('./workshop-page-check');
run('/workshops/minecraft-world-ep7-debug.html',{next:'minecraft-world-ep8-design-share.html'}).catch(e=>{console.error(e);process.exit(1);});
