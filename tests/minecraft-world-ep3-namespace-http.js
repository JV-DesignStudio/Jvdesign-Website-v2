const {run}=require('./workshop-page-check');
run('/workshops/minecraft-world-ep3-namespace.html',{next:'minecraft-world-ep4-functions.html'}).catch(e=>{console.error(e);process.exit(1);});
