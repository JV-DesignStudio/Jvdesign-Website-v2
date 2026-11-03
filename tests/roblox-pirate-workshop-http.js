const {run}=require('./workshop-page-check');
run('/workshops/roblox-pirate-workshop.html',{next:'roblox-creator-journey.html'}).catch(e=>{console.error(e);process.exit(1);});
