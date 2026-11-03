const {run}=require('./workshop-page-check');
run('/workshops/roblox-simulator-workshop.html',{next:'roblox-battle-workshop.html'}).catch(e=>{console.error(e);process.exit(1);});
