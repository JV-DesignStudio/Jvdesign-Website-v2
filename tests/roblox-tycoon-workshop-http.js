const {run}=require('./workshop-page-check');
run('/workshops/roblox-tycoon-workshop.html',{next:'roblox-simulator-workshop.html'}).catch(e=>{console.error(e);process.exit(1);});
