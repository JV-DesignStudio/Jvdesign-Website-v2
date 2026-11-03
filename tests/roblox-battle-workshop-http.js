const {run}=require('./workshop-page-check');
run('/workshops/roblox-battle-workshop.html',{next:'roblox-horror-workshop.html'}).catch(e=>{console.error(e);process.exit(1);});
