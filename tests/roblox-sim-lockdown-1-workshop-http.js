const {run}=require('./workshop-page-check');
run('/workshops/roblox-sim-lockdown-1-workshop.html',{next:'roblox-sim-lockdown-2-workshop.html'}).catch(e=>{console.error(e);process.exit(1);});
