const {run}=require('./workshop-page-check');
run('/workshops/tinkercad-cheatsheet.html',{next:'tinkercad-ep1-spinner.html',challenge:false,reflect:true}).catch(e=>{console.error(e);process.exit(1);});
