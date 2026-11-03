const {run}=require('./workshop-page-check');
run('/workshops/minecraft-setup-check.html',{next:'minecraft-mod-starter-files.html'}).catch(e=>{console.error(e);process.exit(1);});
