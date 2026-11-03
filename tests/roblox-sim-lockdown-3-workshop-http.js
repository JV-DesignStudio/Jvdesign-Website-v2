const {run}=require('./workshop-page-check');
run('/workshops/roblox-sim-lockdown-3-workshop.html',{next:'engine-roblox.html'}).catch(e=>{console.error(e);process.exit(1);});
