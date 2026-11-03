const {run}=require('./workshop-page-check');
run('/workshops/unity-multiplayer-workshop.html',{next:'engine-unity.html',challenge:false}).catch(e=>{console.error(e);process.exit(1);});
