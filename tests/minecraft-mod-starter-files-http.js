const {run}=require('./workshop-page-check');
run('/workshops/minecraft-mod-starter-files.html',{next:'minecraft-mod-studio.html'}).catch(e=>{console.error(e);process.exit(1);});
