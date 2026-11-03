const {run}=require('./workshop-page-check');
run('/workshops/roblox-obby-workshop.html',{next:'roblox-tycoon-workshop.html'}).catch(e=>{console.error(e);process.exit(1);});
