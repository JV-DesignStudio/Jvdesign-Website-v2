const {run}=require('./workshop-page-check');
run('/workshops/tinkercad-ep3-blocks.html',{next:'tinkercad-ep4-pattern.html',challenge:false,reflect:true}).catch(e=>{console.error(e);process.exit(1);});
